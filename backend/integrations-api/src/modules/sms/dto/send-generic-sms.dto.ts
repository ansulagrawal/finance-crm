import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class SendGenericSmsDto {
  @ApiProperty({ description: 'Lead ID this SMS belongs to' })
  @IsInt()
  leadId: number;

  @ApiProperty({ description: 'Recipient mobile number' })
  @IsString()
  mobile: string;

  @ApiProperty({ description: 'SMS message text' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'Vapio DLT template id for this message' })
  @IsString()
  templateId: string;

  @ApiProperty({
    description:
      'Free-form type id for the sms_logs row (matches legacy convention — no shared enum, each caller picks its own id)',
  })
  @IsInt()
  typeId: number;
}
