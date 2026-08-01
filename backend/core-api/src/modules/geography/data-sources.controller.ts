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
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';
import { GeographyService } from './geography.service';

@ApiTags('Data Sources')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('data-sources')
export class DataSourcesController {
  constructor(private readonly geographyService: GeographyService) {}

  @Get()
  @Roles()
  @ApiOperation({ summary: 'List lead data sources' })
  list() {
    return this.geographyService.listDataSources();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new lead data source' })
  create(@Body() dto: CreateDataSourceDto) {
    return this.geographyService.createDataSource(dto);
  }

  @Get(':id')
  @Roles()
  @ApiParam({ name: 'id', description: 'Data source ID', type: Number })
  @ApiOperation({ summary: 'Get a data source by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.geographyService.findDataSourceById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Data source ID', type: Number })
  @ApiOperation({ summary: 'Update a data source' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDataSourceDto,
  ) {
    return this.geographyService.updateDataSource(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Data source ID', type: Number })
  @ApiOperation({ summary: 'Delete a data source' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.geographyService.removeDataSource(id);
  }
}
