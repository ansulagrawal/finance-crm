import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class ListMenuItemsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roleTypeId?: number;
}
