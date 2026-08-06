import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class RequestConsentDto {
  @ApiProperty({ description: 'Lead ID this AA consent request belongs to' })
  @IsInt()
  leadId: number;

  @ApiProperty({
    description: 'Customer mobile number the consent URL is sent to',
    example: '9000000001',
  })
  @IsNotEmpty()
  mobileNumber: string;
}
