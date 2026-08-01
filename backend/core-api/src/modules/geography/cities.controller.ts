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
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UpdateCityDto } from './dto/update-city.dto';
import { GeographyService } from './geography.service';

@ApiTags('Cities')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('cities')
export class CitiesController {
  constructor(private readonly geographyService: GeographyService) {}

  @Get()
  @Roles()
  @ApiOperation({ summary: 'List cities, optionally filtered by state' })
  list(
    @Query('stateId', new ParseIntPipe({ optional: true })) stateId?: number,
  ) {
    return this.geographyService.listCities(stateId);
  }

  @Get(':id')
  @Roles()
  @ApiParam({ name: 'id', description: 'City ID', type: Number })
  @ApiOperation({ summary: 'Get a city by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.geographyService.findCityById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'City ID', type: Number })
  @ApiOperation({ summary: 'Update a city' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCityDto) {
    return this.geographyService.updateCity(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'City ID', type: Number })
  @ApiOperation({ summary: 'Delete a city' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.geographyService.removeCity(id);
  }
}
