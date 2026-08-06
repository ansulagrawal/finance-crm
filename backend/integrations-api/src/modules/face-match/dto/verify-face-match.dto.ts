import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUrl } from 'class-validator';

export class VerifyFaceMatchDto {
  @ApiProperty({
    description: 'Lead ID this face match check belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  /** Selfie image URL. */
  @ApiProperty({ description: 'URL of the live selfie image' })
  @IsUrl()
  firstImageUrl: string;

  /** Digilocker Aadhaar photo (or fallback selfie) URL. */
  @ApiProperty({
    description:
      'URL of the Digilocker Aadhaar photo (or fallback selfie) to match against',
  })
  @IsUrl()
  secondImageUrl: string;
}
