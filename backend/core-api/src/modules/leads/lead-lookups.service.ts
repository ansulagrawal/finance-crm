import {
  MaritalStatus,
  MasterStatus,
  Occupation,
  Qualification,
  RejectionReason,
  Religion,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

@Injectable()
export class LeadLookupsService {
  constructor(
    @InjectRepository(MaritalStatus)
    private readonly maritalStatusRepository: Repository<MaritalStatus>,
    @InjectRepository(Qualification)
    private readonly qualificationRepository: Repository<Qualification>,
    @InjectRepository(Occupation)
    private readonly occupationRepository: Repository<Occupation>,
    @InjectRepository(Religion)
    private readonly religionRepository: Repository<Religion>,
    @InjectRepository(RejectionReason)
    private readonly rejectionReasonRepository: Repository<RejectionReason>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
  ) {}

  listMasterStatuses(stage?: string): Promise<MasterStatus[]> {
    return this.masterStatusRepository.find({
      where: stage
        ? { isActive: true, isDeleted: false, stageCode: stage }
        : { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  listMaritalStatuses(): Promise<MaritalStatus[]> {
    return this.maritalStatusRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  listQualifications(): Promise<Qualification[]> {
    return this.qualificationRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  listOccupations(): Promise<Occupation[]> {
    return this.occupationRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  listReligions(): Promise<Religion[]> {
    return this.religionRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  listRejectionReasons(): Promise<RejectionReason[]> {
    return this.rejectionReasonRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }
}
