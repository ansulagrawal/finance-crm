import { UserRoleLocationType } from '@finance-crm/database';
import { IsEnum, IsInt } from 'class-validator';

export class CreateUserRoleLocationDto {
  @IsEnum(UserRoleLocationType)
  locationType: UserRoleLocationType;

  @IsInt()
  locationId: number;
}
