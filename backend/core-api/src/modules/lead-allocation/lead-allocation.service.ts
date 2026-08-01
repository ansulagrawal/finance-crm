import { UserLeadAllocationLog } from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, type Repository } from 'typeorm';
import { DeclareLeadAllocationDto } from './dto/declare-lead-allocation.dto';

function todayBounds(): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  return [start, end];
}

/**
 * Ports `LoginController::leadAllocation()` — a CR1/CR2 user's self-declared
 * "I'm active today, fresh or repeat cases" toggle (legacy `profile.php`'s
 * `#insert_lead_allocation` form), read back by
 * `CollectionReportsService.currentBucketStatus()`. Each declaration is a new
 * row (legacy inserts, never updates), so "today's status" is the latest
 * active row created today.
 */
@Injectable()
export class LeadAllocationService {
  constructor(
    @InjectRepository(UserLeadAllocationLog)
    private readonly allocationLogRepository: Repository<UserLeadAllocationLog>,
  ) {}

  declare(
    dto: DeclareLeadAllocationDto,
    userId: number,
  ): Promise<UserLeadAllocationLog> {
    const log = this.allocationLogRepository.create({
      userId,
      userStatus: dto.userStatus,
      userCaseType: dto.userCaseType,
      createdAt: new Date(),
    });
    return this.allocationLogRepository.save(log);
  }

  getToday(userId: number): Promise<UserLeadAllocationLog | null> {
    const [start, end] = todayBounds();
    return this.allocationLogRepository.findOne({
      where: {
        userId,
        isActive: true,
        isDeleted: false,
        createdAt: Between(start, end),
      },
      order: { id: 'DESC' },
    });
  }
}
