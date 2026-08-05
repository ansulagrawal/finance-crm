import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUrl } from 'class-validator';

export class OcrDocumentDto {
  @ApiProperty({
    description: 'Lead ID this OCR extraction belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  /** URL of the uploaded document image to OCR. */
  @ApiProperty({
    description: 'URL of the uploaded document image to run OCR extraction on',
  })
  @IsUrl()
  documentUrl: string;
}
