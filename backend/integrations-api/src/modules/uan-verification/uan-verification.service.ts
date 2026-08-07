import { findOrFail } from '@finance-crm/common';
import { ApiCallStatus, Lead, UanVerificationLog } from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { VerifyUanDto } from './dto/verify-uan.dto';

/** Signzy UAN/EPFO employment verification — ports
 * `payday_uan_verification_api.php`, `POST v3/api/advance-employment-verification`. */
@Injectable()
export class UanVerificationService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(UanVerificationLog)
    private readonly logRepository: Repository<UanVerificationLog>,
    private readonly signzy: SignzyClientService,
  ) {}

  async verify(dto: VerifyUanDto): Promise<UanVerificationLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    const result = await this.signzy.post(
      'v3/api/advance-employment-verification',
      {
        mobileNumber: dto.mobileNumber,
        panNumber: dto.panNumber,
        uanNumber: '',
        dateOfBirth: '',
        employeeName: '',
        employerName: '',
        nameMatchMethod: '',
        ttl: 0,
        cutOffTime: '15',
        employmentLookupPeriod: '90',
      },
    );

    const response = result.data as {
      result?: {
        uan?: string[];
        summary?: { recentEmployerData?: { establishmentName?: string } };
      };
    };
    const uan = response?.result?.uan ?? [];

    const log = this.logRepository.create({
      lead,
      pancard: dto.panNumber,
      request: result.requestJson,
      response: result.responseJson,
      uanFound: uan.length > 0,
      uanNumbers: uan.length > 0 ? uan.join(',') : null,
      employerName:
        response?.result?.summary?.recentEmployerData?.establishmentName ??
        null,
      status: response?.result
        ? ApiCallStatus.SUCCESS
        : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.logRepository.save(log);
  }
}
