import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class UploadBankAnalysisDto {
  @ApiProperty()
  @IsInt()
  leadId: number;

  @ApiProperty({
    description:
      'Document ID of the uploaded bank statement (documentType must be BANK STATEMENT)',
  })
  @IsInt()
  documentId: number;
}
