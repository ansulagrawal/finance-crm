import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { ActivityLogsController } from './activity-logs.controller';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { UserRoleLocationsController } from './user-role-locations.controller';
import { UserRoleLocationsService } from './user-role-locations.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [CommonModule],
  providers: [UsersService, RolesService, UserRoleLocationsService],
  controllers: [
    UsersController,
    RolesController,
    UserRoleLocationsController,
    ActivityLogsController,
  ],
})
export class UsersModule {}
