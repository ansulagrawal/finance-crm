import {
  AddressApiStatus,
  AddressDistanceLog,
  AddressLatLongLog,
  Lead,
  LeadCustomer,
  ReverseGeocodeLog,
} from '@finance-crm/database';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoogleMapsClientService } from '../google-maps/google-maps-client.service';
import { AddressDistanceService } from './address-distance.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: unknown) => x),
    ...overrides,
  };
}

describe('AddressDistanceService', () => {
  let service: AddressDistanceService;
  let leadRepository: ReturnType<typeof repo>;
  let leadCustomerRepository: ReturnType<typeof repo>;
  let addressLatLongLogRepository: ReturnType<typeof repo>;
  let reverseGeocodeLogRepository: ReturnType<typeof repo>;
  let logRepository: ReturnType<typeof repo>;
  let distanceMatrix: jest.Mock;

  const lead = { id: 42 } as Lead;

  beforeEach(async () => {
    leadRepository = repo({ findOneBy: jest.fn().mockResolvedValue(lead) });
    leadCustomerRepository = repo();
    addressLatLongLogRepository = repo();
    reverseGeocodeLogRepository = repo();
    logRepository = repo();
    distanceMatrix = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AddressDistanceService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(LeadCustomer),
          useValue: leadCustomerRepository,
        },
        {
          provide: getRepositoryToken(AddressLatLongLog),
          useValue: addressLatLongLogRepository,
        },
        {
          provide: getRepositoryToken(ReverseGeocodeLog),
          useValue: reverseGeocodeLogRepository,
        },
        {
          provide: getRepositoryToken(AddressDistanceLog),
          useValue: logRepository,
        },
        { provide: GoogleMapsClientService, useValue: { distanceMatrix } },
      ],
    }).compile();

    service = moduleRef.get(AddressDistanceService);
  });

  it('throws when no successful Aadhaar address-to-lat/long log exists', async () => {
    addressLatLongLogRepository.findOne.mockResolvedValue(null);

    await expect(service.calculate({ leadId: 42 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws when no successful live-location log exists', async () => {
    addressLatLongLogRepository.findOne.mockResolvedValue({
      latitude: '19.07',
      longitude: '72.87',
    });
    reverseGeocodeLogRepository.findOne.mockResolvedValue(null);

    await expect(service.calculate({ leadId: 42 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('computes and stores the distance on success', async () => {
    addressLatLongLogRepository.findOne.mockResolvedValue({
      latitude: '19.07',
      longitude: '72.87',
    });
    reverseGeocodeLogRepository.findOne.mockResolvedValue({
      latitude: '19.20',
      longitude: '72.97',
    });
    distanceMatrix.mockResolvedValue({
      distanceKm: 18.42,
      requestJson: '{}',
      responseJson: '{}',
    });
    const customer = { residenceDistanceKm: null };
    leadCustomerRepository.findOne.mockResolvedValue(customer);

    const result = await service.calculate({ leadId: 42 });

    expect(distanceMatrix).toHaveBeenCalledWith(
      '19.07',
      '72.87',
      '19.20',
      '72.97',
    );
    expect(result.status).toBe(AddressApiStatus.SUCCESS);
    expect(result.message).toBe('18.42');
    expect(customer.residenceDistanceKm).toBe('18.42');
    expect(leadCustomerRepository.save).toHaveBeenCalledWith(customer);
  });

  it('logs a FAILURE status and does not touch LeadCustomer when Google Maps fails', async () => {
    addressLatLongLogRepository.findOne.mockResolvedValue({
      latitude: '19.07',
      longitude: '72.87',
    });
    reverseGeocodeLogRepository.findOne.mockResolvedValue({
      latitude: '19.20',
      longitude: '72.97',
    });
    distanceMatrix.mockRejectedValue(new Error('Google API down'));

    const result = await service.calculate({ leadId: 42 });

    expect(result.status).toBe(AddressApiStatus.FAILURE);
    expect(result.errorMessage).toBe('Google API down');
    expect(leadCustomerRepository.save).not.toHaveBeenCalled();
  });
});
