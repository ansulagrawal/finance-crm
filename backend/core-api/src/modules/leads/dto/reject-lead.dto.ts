import { IsInt, IsOptional, IsString } from 'class-validator';

export class RejectLeadDto {
  @IsInt()
  rejectionReasonId: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
