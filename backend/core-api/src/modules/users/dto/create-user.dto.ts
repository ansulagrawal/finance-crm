import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/** Mirrors the `users.company_id` / `users.product_id` column defaults. */
export const DEFAULT_COMPANY_ID = 1;
export const DEFAULT_PRODUCT_ID = 1;

export class CreateUserDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'Priya Sharma',
  })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    description: 'Email address, used as login identifier',
    example: 'priya@financecrm.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'Initial password (min 8 chars, at least one letter and one number)',
    example: 'Passw0rd',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one number',
  })
  password: string;

  @ApiProperty({ description: 'Mobile number', example: '9876543210' })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'mobile must be 10 digits' })
  mobile: string;

  @ApiPropertyOptional({
    description: 'Username, if distinct from email',
    example: 'priya.sharma',
  })
  @IsOptional()
  @IsString()
  username?: string;

  /**
   * Optional, defaulting to 1 — matching the `users.company_id` column's own
   * NOT NULL DEFAULT 1. Requiring it here while the CRM's create-user form
   * offers no way to choose a company just made the form unsubmittable.
   * `mobile` above stays required on purpose: that column is NOT NULL with no
   * default, and all 184 migrated users have one.
   */
  @ApiPropertyOptional({
    description: 'Company ID the user belongs to. Defaults to 1.',
    example: 1,
    default: DEFAULT_COMPANY_ID,
  })
  @IsOptional()
  @IsInt()
  companyId?: number = DEFAULT_COMPANY_ID;

  /** Same reasoning as `companyId` — `users.product_id` is NOT NULL DEFAULT 1. */
  @ApiPropertyOptional({
    description: 'Product ID the user is scoped to. Defaults to 1.',
    example: 1,
    default: DEFAULT_PRODUCT_ID,
  })
  @IsOptional()
  @IsInt()
  productId?: number = DEFAULT_PRODUCT_ID;
}
