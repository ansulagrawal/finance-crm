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
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CompanyHolidaysService } from './company-holidays.service';
import { CreateCompanyHolidayDto } from './dto/create-company-holiday.dto';

@ApiTags('Company Holidays')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('company-holidays')
export class CompanyHolidaysController {
  constructor(
    private readonly companyHolidaysService: CompanyHolidaysService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List the holiday calendar' })
  list() {
    return this.companyHolidaysService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Add a holiday to the calendar' })
  create(@Body() dto: CreateCompanyHolidayDto) {
    return this.companyHolidaysService.create(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Company holiday ID', type: Number })
  @ApiOperation({ summary: 'Remove a holiday from the calendar' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companyHolidaysService.remove(id);
  }
}
