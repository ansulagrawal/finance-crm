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
import { CreateCityDto } from './dto/create-city.dto';
import { CreateStateDto } from './dto/create-state.dto';
import { UpdateStateDto } from './dto/update-state.dto';
import { GeographyService } from './geography.service';

@ApiTags('States')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('states')
export class StatesController {
  constructor(private readonly geographyService: GeographyService) {}

  @Get()
  @Roles()
  @ApiOperation({ summary: 'List states' })
  list() {
    return this.geographyService.listStates();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new state' })
  create(@Body() dto: CreateStateDto) {
    return this.geographyService.createState(dto);
  }

  @Get(':id')
  @Roles()
  @ApiParam({ name: 'id', description: 'State ID', type: Number })
  @ApiOperation({ summary: 'Get a state by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.geographyService.findStateById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'State ID', type: Number })
  @ApiOperation({ summary: 'Update a state' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStateDto) {
    return this.geographyService.updateState(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'State ID', type: Number })
  @ApiOperation({ summary: 'Delete a state' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.geographyService.removeState(id);
  }

  @Get(':id/cities')
  @Roles()
  @ApiParam({ name: 'id', description: 'State ID', type: Number })
  @ApiOperation({ summary: 'List cities belonging to a state' })
  listCities(@Param('id', ParseIntPipe) id: number) {
    return this.geographyService.listCities(id);
  }

  @Post(':id/cities')
  @ApiParam({ name: 'id', description: 'State ID', type: Number })
  @ApiOperation({ summary: 'Create a city under a state' })
  createCity(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCityDto,
  ) {
    return this.geographyService.createCity(id, dto);
  }
}
