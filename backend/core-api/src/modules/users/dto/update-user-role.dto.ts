import { IsBoolean, IsIn, IsInt, IsOptional } from 'class-validator';

export class UpdateUserRoleDto {
  @IsOptional()
  @IsInt()
  supervisorRoleId?: number;

  /** `L1`/`L2`/`L3`/`L4` — legacy `user_roles.user_role_level` is a string code, not a numeric level. */
  @IsOptional()
  @IsIn(['L1', 'L2', 'L3', 'L4'])
  level?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
