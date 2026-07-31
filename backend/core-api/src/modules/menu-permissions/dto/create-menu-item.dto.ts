import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMenuItemDto {
  @ApiProperty({
    description: 'Role type ID this menu item is visible to',
    example: 1,
  })
  @IsInt()
  roleTypeId: number;

  @ApiProperty({
    description: 'Menu section ID this item belongs to',
    example: 1,
  })
  @IsInt()
  sectionId: number;

  /** Required: legacy `master_lms_menu.role` is NOT NULL. */
  @ApiProperty({
    description: 'Display label for the section',
    example: 'Leads',
  })
  @IsString()
  @MinLength(1)
  sectionLabel: string;

  @ApiProperty({ description: 'Menu item name', example: 'All Leads' })
  @IsString()
  @MinLength(1)
  name: string;

  /** Required: legacy `master_lms_menu.stage` is NOT NULL. */
  @ApiProperty({
    description: 'Workflow stage this menu item applies to',
    example: 'screening',
  })
  @IsString()
  @MinLength(1)
  stage: string;

  @ApiProperty({
    description: 'Frontend route path the menu item links to',
    example: '/leads',
  })
  @IsString()
  @MinLength(1)
  routeLink: string;

  @ApiPropertyOptional({
    description: 'Icon name/identifier',
    example: 'users',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  /** Required: legacy `master_lms_menu.box_bg_color` is NOT NULL. */
  @ApiProperty({
    description: 'Background color for the menu box',
    example: '#4F46E5',
  })
  @IsString()
  @MinLength(1)
  boxBgColor: string;

  @ApiPropertyOptional({
    description: 'Sort order among sibling menu items',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  /** Required: legacy `master_lms_menu.company_id` is NOT NULL. */
  @ApiProperty({
    description: 'Company ID this menu item belongs to',
    example: 1,
  })
  @IsInt()
  companyId: number;

  /** Required: legacy `master_lms_menu.product_id` is NOT NULL. */
  @ApiProperty({
    description: 'Product ID this menu item belongs to',
    example: 1,
  })
  @IsInt()
  productId: number;
}
