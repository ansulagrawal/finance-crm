import { IsInt, IsOptional } from 'class-validator';

export class GrantMisPermissionDto {
  @IsInt()
  userId: number;

  @IsInt()
  misId: number;

  @IsOptional()
  @IsInt()
  userRoleId?: number;
}
