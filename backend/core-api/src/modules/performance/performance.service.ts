import { findOrFail } from '@finance-crm/common';
import {
  User,
  UserTargetAllocation,
  UserTargetAllocationType,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { UpsertUserTargetDto } from './dto/upsert-user-target.dto';

export interface UserPerformance {
  userId: number;
  type: UserTargetAllocationType;
  targetCases: number;
  targetAmount: number;
  targetFollowups: number;
  achievedCases: number;
  achievedAmount: number;
  achievedFollowups: number;
}

/**
 * Ports `Performance_Model.php` onto the real `user_target_allocation_log`
 * shape: unlike the pre-restart entity (which added a monthly
 * `targetMonth` column and computed "achieved" live from
 * `CreditAnalysisMemo`), legacy stores one rolling row per
 * (user, SANCTION|COLLECTION type) with no time window at all, and the
 * achieved-to-date figures are updated directly on the row by the legacy
 * cron — this service trusts those stored columns rather than
 * recomputing them, matching how legacy actually works. Keeping the
 * achieved figures in sync going forward is automation-worker's job
 * (a future cron), not core-api's.
 */
@Injectable()
export class PerformanceService {
  constructor(
    @InjectRepository(UserTargetAllocation)
    private readonly targetRepository: Repository<UserTargetAllocation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async upsertTarget(dto: UpsertUserTargetDto): Promise<UserTargetAllocation> {
    const user = await findOrFail(this.userRepository, dto.userId, 'User');

    let target = await this.targetRepository.findOne({
      where: { user: { id: dto.userId }, type: dto.type },
    });
    if (!target) {
      target = this.targetRepository.create({
        user,
        type: dto.type,
        createdAt: new Date(),
      });
    }
    if (dto.targetCases !== undefined) target.targetCases = dto.targetCases;
    if (dto.targetAmount !== undefined) target.targetAmount = dto.targetAmount;
    if (dto.targetFollowups !== undefined) {
      target.targetFollowups = dto.targetFollowups;
    }
    target.updatedAt = new Date();
    return this.targetRepository.save(target);
  }

  async getPerformance(
    userId: number,
    type: UserTargetAllocationType,
  ): Promise<UserPerformance> {
    await findOrFail(this.userRepository, userId, 'User');
    const target = await this.targetRepository.findOne({
      where: { user: { id: userId }, type },
    });

    return {
      userId,
      type,
      targetCases: target?.targetCases ?? 0,
      targetAmount: target?.targetAmount ?? 0,
      targetFollowups: target?.targetFollowups ?? 0,
      achievedCases: target?.achievedCases ?? 0,
      achievedAmount: target?.achievedAmount ?? 0,
      achievedFollowups: target?.achievedFollowups ?? 0,
    };
  }
}
