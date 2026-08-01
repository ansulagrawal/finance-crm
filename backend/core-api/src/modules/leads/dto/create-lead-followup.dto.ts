import { IsString, MinLength } from 'class-validator';

export class CreateLeadFollowupDto {
  @IsString()
  @MinLength(1)
  remarks: string;
}
