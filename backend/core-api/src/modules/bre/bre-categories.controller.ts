import { Roles } from '@finance-crm/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { BreService } from './bre.service';
import { CreateBreCategoryDto } from './dto/create-bre-category.dto';
import { UpdateBreCategoryDto } from './dto/update-bre-category.dto';

@ApiTags('BRE Categories')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('bre-categories')
export class BreCategoriesController {
  constructor(private readonly breService: BreService) {}

  @Get()
  @ApiOperation({ summary: 'List all BRE (business rule engine) categories' })
  list() {
    return this.breService.listCategories();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new BRE category' })
  create(@Body() dto: CreateBreCategoryDto) {
    return this.breService.createCategory(dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'BRE category ID', type: Number })
  @ApiOperation({ summary: 'Get a BRE category by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.breService.findCategoryById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'BRE category ID', type: Number })
  @ApiOperation({ summary: 'Update a BRE category' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBreCategoryDto,
  ) {
    return this.breService.updateCategory(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'BRE category ID', type: Number })
  @ApiOperation({ summary: 'Delete a BRE category' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.breService.removeCategory(id);
  }
}
