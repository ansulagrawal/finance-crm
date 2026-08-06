import { findOrFail } from '@finance-crm/common';
import { ApiCallStatus, FaceMatchLog, Lead } from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { VerifyFaceMatchDto } from './dto/verify-face-match.dto';

const SIGNZY_PROVIDER = 1;
const VERIFY_FACE_MATCH_METHOD = 1;

/** Signzy face match — ports `payday_face_match_verification_api.php`
 * (`GET_FACE_MATCH_VERFICATION`), `POST v3/face/match`. */
@Injectable()
export class FaceMatchService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(FaceMatchLog)
    private readonly logRepository: Repository<FaceMatchLog>,
    private readonly signzy: SignzyClientService,
  ) {}

  async verify(dto: VerifyFaceMatchDto): Promise<FaceMatchLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    const result = await this.signzy.post('v3/face/match', {
      firstImage: dto.firstImageUrl,
      secondImage: dto.secondImageUrl,
    });
    const response = result.data as {
      result?: { matchPercentage?: number; message?: string };
    };
    const matchPercentage = response?.result?.matchPercentage;

    const log = this.logRepository.create({
      lead,
      provider: SIGNZY_PROVIDER,
      method: VERIFY_FACE_MATCH_METHOD,
      matchPercentage:
        matchPercentage !== undefined ? String(matchPercentage) : null,
      request: result.requestJson,
      response: result.responseJson,
      status:
        matchPercentage !== undefined
          ? ApiCallStatus.SUCCESS
          : ApiCallStatus.API_ERROR,
      errors: result.errorMessage ?? response?.result?.message ?? null,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.logRepository.save(log);
  }
}
