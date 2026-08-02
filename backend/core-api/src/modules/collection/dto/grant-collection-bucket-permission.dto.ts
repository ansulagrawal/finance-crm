import { IsInt, IsOptional } from 'class-validator';

export class GrantCollectionBucketPermissionDto {
  @IsInt()
  userId: number;

  @IsInt()
  bucketId: number;

  @IsOptional()
  @IsInt()
  userRoleId?: number;
}
