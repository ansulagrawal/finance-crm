import { ArrayNotEmpty, IsInt } from 'class-validator';

export class AllocateAuditDto {
  @ArrayNotEmpty()
  @IsInt({ each: true })
  leadIds: number[];
}
