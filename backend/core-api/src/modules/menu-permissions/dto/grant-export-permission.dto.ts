import { IsInt, IsOptional } from 'class-validator';

export class GrantExportPermissionDto {
  @IsInt()
  userId: number;

  @IsInt()
  exportId: number;

  @IsOptional()
  @IsInt()
  userRoleId?: number;
}
