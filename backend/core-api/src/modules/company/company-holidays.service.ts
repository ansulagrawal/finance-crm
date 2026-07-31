import { findOrFail } from '@finance-crm/common';
import { CompanyHoliday } from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CreateCompanyHolidayDto } from './dto/create-company-holiday.dto';

@Injectable()
export class CompanyHolidaysService {
  constructor(
    @InjectRepository(CompanyHoliday)
    private readonly companyHolidayRepository: Repository<CompanyHoliday>,
  ) {}

  list(): Promise<CompanyHoliday[]> {
    return this.companyHolidayRepository.find({
      order: { holidayDate: 'ASC' },
    });
  }

  create(dto: CreateCompanyHolidayDto): Promise<CompanyHoliday> {
    const holiday = this.companyHolidayRepository.create({
      holidayDate: dto.holidayDate,
      name: dto.name,
    });
    return this.companyHolidayRepository.save(holiday);
  }

  /** For the repayment-date working-day adjustment
   * (`adjustForNonWorkingDay()`) — a `YYYY-MM-DD` set is cheaper to check
   * against in a loop than repeated DB round-trips per candidate date. */
  async getActiveHolidayDates(): Promise<Set<string>> {
    const holidays = await this.companyHolidayRepository.find({
      where: { isActive: true, isDeleted: false },
    });
    return new Set(holidays.map((h) => h.holidayDate));
  }

  async remove(id: number): Promise<void> {
    const holiday = await findOrFail(
      this.companyHolidayRepository,
      id,
      'Company holiday',
    );
    holiday.isActive = false;
    holiday.isDeleted = true;
    await this.companyHolidayRepository.save(holiday);
  }
}
