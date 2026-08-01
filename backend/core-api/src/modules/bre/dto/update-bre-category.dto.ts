import { PartialType } from '@nestjs/swagger';
import { CreateBreCategoryDto } from './create-bre-category.dto';

export class UpdateBreCategoryDto extends PartialType(CreateBreCategoryDto) {}
