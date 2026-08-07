import {
  AddressApiStatus,
  AddressLatLongLog,
  AddressType,
  Lead,
  LeadCustomer,
} from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DigitapClientService } from '../digitap/digitap-client.service';
import { AddressLatLongService } from './address-lat-long.service';

describe('AddressLatLongService', () => {
  let service: AddressLatLongService;
  let digitapPostJson: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let leadCustomerRepository: { findOne: jest.Mock; save: jest.Mock };
  let logRepository: { create: jest.Mock; save: jest.Mock };

  const lead = { id: 42 } as Lead;

  beforeEach(async () => {
    digitapPostJson = jest.fn();
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    leadCustomerRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    logRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AddressLatLongService,
        {
          provide: DigitapClientService,
          useValue: { postJson: digitapPostJson },
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(LeadCustomer),
          useValue: leadCustomerRepository,
        },
        {
          provide: getRepositoryToken(AddressLatLongLog),
          useValue: logRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(AddressLatLongService);
  });

  it('posts the real Digitap address-to-lat-long request shape', async () => {
    digitapPostJson.mockResolvedValue({
      data: { code: 200, model: { latitude: '19.0760', longitude: '72.8777' } },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.getLatLong({
      leadId: 42,
      address: '123 Main St, Mumbai, MH 400001',
      addressType: AddressType.CURRENT,
    });

    expect(digitapPostJson).toHaveBeenCalledWith(
      'https://api.digitap.ai/ent/v1/address-to-lat-long',
      expect.objectContaining({ address: '123 Main St, Mumbai, MH 400001' }),
    );
    expect(result.status).toBe(AddressApiStatus.SUCCESS);
    expect(result.latitude).toBe('19.0760');
    expect(result.longitude).toBe('72.8777');
  });

  it('marks the log as FAILURE when no latitude/longitude is returned', async () => {
    digitapPostJson.mockResolvedValue({
      data: { code: 400 },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.getLatLong({
      leadId: 42,
      address: 'incomplete address',
      addressType: AddressType.AADHAAR,
    });

    expect(result.status).toBe(AddressApiStatus.FAILURE);
  });

  it('writes the resolved coordinates onto lead_customer for a successful AADHAAR lookup', async () => {
    digitapPostJson.mockResolvedValue({
      data: { code: 200, model: { latitude: '19.0760', longitude: '72.8777' } },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });
    const leadCustomer = { leadId: 42 };
    leadCustomerRepository.findOne.mockResolvedValue(leadCustomer);

    await service.getLatLong({
      leadId: 42,
      address: 'Aadhaar address, Mumbai, MH 400001',
      addressType: AddressType.AADHAAR,
    });

    expect(leadCustomerRepository.findOne).toHaveBeenCalledWith({
      where: { leadId: 42 },
    });
    expect(leadCustomerRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        aaAadhaarAddressCoordinates: '19.0760,72.8777',
      }),
    );
  });

  it('does not write onto lead_customer for a successful CURRENT (non-Aadhaar) lookup', async () => {
    digitapPostJson.mockResolvedValue({
      data: { code: 200, model: { latitude: '19.0760', longitude: '72.8777' } },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    await service.getLatLong({
      leadId: 42,
      address: '123 Main St, Mumbai, MH 400001',
      addressType: AddressType.CURRENT,
    });

    expect(leadCustomerRepository.findOne).not.toHaveBeenCalled();
    expect(leadCustomerRepository.save).not.toHaveBeenCalled();
  });

  it('does not fail when no matching lead_customer exists yet', async () => {
    digitapPostJson.mockResolvedValue({
      data: { code: 200, model: { latitude: '19.0760', longitude: '72.8777' } },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    await expect(
      service.getLatLong({
        leadId: 42,
        address: 'Aadhaar address, Mumbai, MH 400001',
        addressType: AddressType.AADHAAR,
      }),
    ).resolves.toBeDefined();
    expect(leadCustomerRepository.save).not.toHaveBeenCalled();
  });
});
