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
import { CreateReportCatalogDto } from './dto/create-report-catalog.dto';
import { UpdateReportCatalogDto } from './dto/update-report-catalog.dto';
import { ReportCatalogsService } from './report-catalogs.service';

@ApiTags('Report Catalogs')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('export-catalogs')
export class ExportCatalogsController {
  constructor(private readonly reportCatalogsService: ReportCatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'List the CSV export catalog' })
  list() {
    return this.reportCatalogsService.listExports();
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Export catalog ID', type: Number })
  @ApiOperation({ summary: 'Get a CSV export catalog entry by ID' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.reportCatalogsService.getExport(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new CSV export catalog entry' })
  create(@Body() dto: CreateReportCatalogDto) {
    return this.reportCatalogsService.createExport(dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Export catalog ID', type: Number })
  @ApiOperation({ summary: 'Update a CSV export catalog entry' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReportCatalogDto,
  ) {
    return this.reportCatalogsService.updateExport(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Export catalog ID', type: Number })
  @ApiOperation({ summary: 'Soft-delete a CSV export catalog entry' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reportCatalogsService.removeExport(id);
  }
}

@ApiTags('Report Catalogs')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('mis-report-catalogs')
export class MisReportCatalogsController {
  constructor(private readonly reportCatalogsService: ReportCatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'List the MIS report catalog' })
  list() {
    return this.reportCatalogsService.listMisReports();
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'MIS report catalog ID', type: Number })
  @ApiOperation({ summary: 'Get a MIS report catalog entry by ID' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.reportCatalogsService.getMisReport(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new MIS report catalog entry' })
  create(@Body() dto: CreateReportCatalogDto) {
    return this.reportCatalogsService.createMisReport(dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'MIS report catalog ID', type: Number })
  @ApiOperation({ summary: 'Update a MIS report catalog entry' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReportCatalogDto,
  ) {
    return this.reportCatalogsService.updateMisReport(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'MIS report catalog ID', type: Number })
  @ApiOperation({ summary: 'Soft-delete a MIS report catalog entry' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reportCatalogsService.removeMisReport(id);
  }
}
