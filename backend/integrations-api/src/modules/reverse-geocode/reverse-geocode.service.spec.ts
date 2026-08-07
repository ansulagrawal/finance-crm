import { ApiCallStatus, Lead, ReverseGeocodeLog } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoogleMapsClientService } from '../google-maps/google-maps-client.service';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { ReverseGeocodeService } from './reverse-geocode.service';

describe('ReverseGeocodeService', () => {
  let service: ReverseGeocodeService;
  let signzyPost: jest.Mock;
  let googleReverseGeocode: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let logRepository: { create: jest.Mock; save: jest.Mock };

  const lead = { id: 42 } as Lead;

  beforeEach(async () => {
    signzyPost = jest.fn();
    googleReverseGeocode = jest.fn();
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    logRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReverseGeocodeService,
        { provide: SignzyClientService, useValue: { post: signzyPost } },
        {
          provide: GoogleMapsClientService,
          useValue: { reverseGeocode: googleReverseGeocode },
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(ReverseGeocodeLog),
          useValue: logRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(ReverseGeocodeService);
  });

  it('posts the real Signzy reverse-geocode request shape with the x-client-unique-id header', async () => {
    signzyPost.mockResolvedValue({
      data: {
        latitude: '19.0760',
        longitude: '72.8777',
        address: 'Mumbai, Maharashtra, India',
      },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.resolve({
      leadId: 42,
      latitude: '19.0760',
      longitude: '72.8777',
    });

    expect(signzyPost).toHaveBeenCalledWith(
      'v3/geocoding/reverse-geocode',
      { latitude: '19.0760', longitude: '72.8777' },
      { 'x-client-unique-id': 'it@financecrm.com' },
    );
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
    expect(result.latitude).toBe('19.0760');
    expect(result.longitude).toBe('72.8777');
    expect(googleReverseGeocode).not.toHaveBeenCalled();
  });

  it('falls back to Google Maps when Signzy returns no coordinates', async () => {
    signzyPost.mockResolvedValue({
      data: {},
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });
    googleReverseGeocode.mockResolvedValue({
      address: 'Mumbai, Maharashtra, India',
      requestJson: '{"latitude":"19.0760","longitude":"72.8777"}',
      responseJson: '{"results":[]}',
    });

    const result = await service.resolve({
      leadId: 42,
      latitude: '19.0760',
      longitude: '72.8777',
    });

    expect(googleReverseGeocode).toHaveBeenCalledWith('19.0760', '72.8777');
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
    expect(result.errors).toBeNull();
  });

  it('marks the log as API_ERROR when both Signzy and the Google Maps fallback fail', async () => {
    signzyPost.mockResolvedValue({
      data: {},
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });
    googleReverseGeocode.mockRejectedValue(new Error('No results'));

    const result = await service.resolve({
      leadId: 42,
      latitude: '19.0760',
      longitude: '72.8777',
    });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
  });

  it('surfaces the SignzyClientService error message when the underlying call fails and the fallback also fails', async () => {
    signzyPost.mockResolvedValue({
      data: null,
      requestJson: '{}',
      responseJson: '',
      errorMessage: 'connect ECONNREFUSED',
    });
    googleReverseGeocode.mockRejectedValue(new Error('No results'));

    const result = await service.resolve({
      leadId: 42,
      latitude: '19.0760',
      longitude: '72.8777',
    });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
    expect(result.errors).toBe('connect ECONNREFUSED');
  });
});
