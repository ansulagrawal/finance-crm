import { UserRole, UserRoleLocation } from '@finance-crm/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CreateUserRoleLocationDto } from './dto/create-user-role-location.dto';

@Injectable()
export class UserRoleLocationsService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(UserRoleLocation)
    private readonly userRoleLocationRepository: Repository<UserRoleLocation>,
  ) {}

  async list(userRoleId: number): Promise<UserRoleLocation[]> {
    await this.getUserRoleOrFail(userRoleId);
    return this.userRoleLocationRepository.find({
      where: { userRole: { id: userRoleId } },
      order: { id: 'ASC' },
    });
  }

  async create(
    userRoleId: number,
    dto: CreateUserRoleLocationDto,
  ): Promise<UserRoleLocation> {
    const userRole = await this.getUserRoleOrFail(userRoleId);
    const location = this.userRoleLocationRepository.create({
      userRole,
      locationType: dto.locationType,
      locationId: dto.locationId,
    });
    return this.userRoleLocationRepository.save(location);
  }

  async remove(userRoleId: number, locationId: number): Promise<void> {
    const location = await this.userRoleLocationRepository.findOne({
      where: { id: locationId, userRole: { id: userRoleId } },
    });
    if (!location) {
      throw new NotFoundException(
        `Location ${locationId} not found for role assignment ${userRoleId}`,
      );
    }
    location.isActive = false;
    location.isDeleted = true;
    await this.userRoleLocationRepository.save(location);
  }

  private async getUserRoleOrFail(userRoleId: number): Promise<UserRole> {
    const userRole = await this.userRoleRepository.findOne({
      where: { id: userRoleId },
    });
    if (!userRole) {
      throw new NotFoundException(`Role assignment ${userRoleId} not found`);
    }
    return userRole;
  }
}
