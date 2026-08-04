import { ApiCallStatus, Lead, SmsLog } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SmsService } from './sms.service';
import { SMS_SENDER } from './sms.tokens';

describe('SmsService', () => {
  let service: SmsService;
  let send: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let smsLogRepository: { create: jest.Mock; save: jest.Mock };

  const lead = { id: 42 } as Lead;

  beforeEach(async () => {
    send = jest.fn();
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    smsLogRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: SMS_SENDER, useValue: { send } },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(SmsLog), useValue: smsLogRepository },
      ],
    }).compile();

    service = moduleRef.get(SmsService);
  });

  it('sends the real OTP template shape via the configured sender', async () => {
    send.mockResolvedValue({
      success: true,
      responseBody: '{"status":"OK"}',
      errorMessage: null,
      isNetworkError: false,
    });

    const result = await service.sendOtp({
      leadId: 42,
      mobile: '9999999999',
      otp: '123456',
    });

    expect(send).toHaveBeenCalledWith({
      mobile: '9999999999',
      message:
        '123456 is your OTP. Valid for 10 min. Please Do not share with anyone. Acme Leasing & Finance Pvt Ltd',
      templateId: '1107176535879044251',
    });
    expect(result.apiStatus).toBe(ApiCallStatus.SUCCESS);
  });

  it('marks the log as API_ERROR when the sender reports a non-network failure', async () => {
    send.mockResolvedValue({
      success: false,
      responseBody: '{"status":"FAIL"}',
      errorMessage: 'Vapio did not return status=OK',
      isNetworkError: false,
    });

    const result = await service.sendOtp({
      leadId: 42,
      mobile: '9999999999',
      otp: '123456',
    });

    expect(result.apiStatus).toBe(ApiCallStatus.API_ERROR);
  });

  it('marks the log as NETWORK_ERROR when the sender reports a network failure', async () => {
    send.mockResolvedValue({
      success: false,
      responseBody: '',
      errorMessage: 'connect ECONNREFUSED',
      isNetworkError: true,
    });

    const result = await service.sendOtp({
      leadId: 42,
      mobile: '9999999999',
      otp: '123456',
    });

    expect(result.apiStatus).toBe(ApiCallStatus.NETWORK_ERROR);
    expect(result.errors).toContain('connect ECONNREFUSED');
  });

  describe('sendGenericSms', () => {
    it('sends the caller-supplied message/templateId shape via the configured sender', async () => {
      send.mockResolvedValue({
        success: true,
        responseBody: '{"status":"OK"}',
        errorMessage: null,
        isNetworkError: false,
      });

      const result = await service.sendGenericSms({
        leadId: 42,
        mobile: '9999999999',
        message: 'Payment reminder text',
        templateId: '1707177191819066667',
        typeId: 3,
      });

      expect(send).toHaveBeenCalledWith({
        mobile: '9999999999',
        message: 'Payment reminder text',
        templateId: '1707177191819066667',
      });
      expect(result.apiStatus).toBe(ApiCallStatus.SUCCESS);
      expect(result.typeId).toBe(3);
      expect(result.templateSource).toBeNull();
    });
  });
});
