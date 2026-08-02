import { IsEnum } from 'class-validator';
import { FieldVerificationTrack } from '../field-verification.types';

export class InitiateFieldVerificationDto {
  @IsEnum(FieldVerificationTrack)
  track: FieldVerificationTrack;
}
