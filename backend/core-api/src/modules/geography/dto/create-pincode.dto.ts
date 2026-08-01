import { IsInt, IsString, MinLength } from 'class-validator';

export class CreatePincodeDto {
  @IsString()
  @MinLength(1)
  value: string;

  /** Required: legacy declares `master_pincode.m_pincode_city_id` NOT NULL. */
  @IsInt()
  cityId: number;
}
