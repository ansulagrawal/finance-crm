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
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { BreService } from './bre.service';
import { CreateBreRuleDto } from './dto/create-bre-rule.dto';
import { UpdateBreRuleDto } from './dto/update-bre-rule.dto';

@ApiTags('BRE Rules')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('bre-rules')
export class BreRulesController {
  constructor(private readonly breService: BreService) {}

  @Get()
  @ApiOperation({ summary: 'List BRE rules, optionally filtered by category' })
  list(
    @Query('categoryId', new ParseIntPipe({ optional: true }))
    categoryId?: number,
  ) {
    return this.breService.listRules(categoryId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new BRE rule' })
  create(@Body() dto: CreateBreRuleDto) {
    return this.breService.createRule(dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'BRE rule ID', type: Number })
  @ApiOperation({ summary: 'Get a BRE rule by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.breService.findRuleById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'BRE rule ID', type: Number })
  @ApiOperation({ summary: 'Update a BRE rule' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBreRuleDto) {
    return this.breService.updateRule(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'BRE rule ID', type: Number })
  @ApiOperation({ summary: 'Delete a BRE rule' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.breService.removeRule(id);
  }
}
