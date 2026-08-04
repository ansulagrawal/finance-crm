import { ApiCallStatus, EmailLog, Lead } from '@finance-crm/database';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { EMAIL_SENDER } from './email.tokens';

describe('EmailService', () => {
  let service: EmailService;
  let send: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let emailLogRepository: { create: jest.Mock; save: jest.Mock };

  const lead = { id: 42 } as Lead;

  beforeEach(async () => {
    send = jest.fn().mockResolvedValue(undefined);
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    emailLogRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: EMAIL_SENDER, useValue: { send } },
        {
          provide: ConfigService,
          useValue: { get: (_key: string, fallback?: string) => fallback },
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(EmailLog), useValue: emailLogRepository },
      ],
    }).compile();

    service = moduleRef.get(EmailService);
  });

  it('sends the real thank-you email shape via the configured sender', async () => {
    const result = await service.sendThankYouEmail({
      leadId: 42,
      email: 'customer@example.com',
      name: 'Test Customer',
      referenceNo: 'REF-123',
    });

    expect(send).toHaveBeenCalledTimes(1);
    const [message] = send.mock.calls[0];
    expect(message.to).toBe('customer@example.com');
    expect(message.subject).toBe('Thank You. - salaryontime');
    expect(message.html).toContain('Dear Test Customer');
    expect(message.html).toContain('REF-123');
    expect(result.apiStatus).toBe(ApiCallStatus.SUCCESS);
  });

  it('escapes HTML in the interpolated name/reference (legacy does not)', async () => {
    await service.sendThankYouEmail({
      leadId: 42,
      email: 'customer@example.com',
      name: '<script>alert(1)</script>',
      referenceNo: 'REF-123',
    });

    const [message] = send.mock.calls[0];
    expect(message.html).not.toContain('<script>alert(1)</script>');
    expect(message.html).toContain('&lt;script&gt;');
  });

  it('marks the log as NETWORK_ERROR when the send fails', async () => {
    send.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const result = await service.sendThankYouEmail({
      leadId: 42,
      email: 'customer@example.com',
      name: 'Test Customer',
      referenceNo: 'REF-123',
    });

    expect(result.apiStatus).toBe(ApiCallStatus.NETWORK_ERROR);
    expect(result.errors).toContain('connect ECONNREFUSED');
  });

  describe('sendGenericEmail', () => {
    it('sends the caller-supplied subject/html verbatim and logs the caller-supplied typeId', async () => {
      const result = await service.sendGenericEmail({
        leadId: 42,
        email: 'customer@example.com',
        subject: 'Happy Birthday!',
        html: '<p>Many happy returns</p>',
        typeId: 7,
      });

      const [message] = send.mock.calls[0];
      expect(message.subject).toBe('Happy Birthday!');
      expect(message.html).toBe('<p>Many happy returns</p>');
      expect(result.typeId).toBe(7);
      expect(result.apiStatus).toBe(ApiCallStatus.SUCCESS);
    });
  });
});
