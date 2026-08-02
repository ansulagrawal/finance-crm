import { IsEnum, IsInt } from 'class-validator';
import { FieldVerificationTrack } from '../field-verification.types';

export class AllocateFieldVerificationDto {
  @IsEnum(FieldVerificationTrack)
  track: FieldVerificationTrack;

  @IsInt()
  allocatedToUserId: number;
}
