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
import { CreateUserRoleLocationDto } from './dto/create-user-role-location.dto';
import { UserRoleLocationsService } from './user-role-locations.service';

@ApiTags('User Role Locations')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('user-roles/:userRoleId/locations')
export class UserRoleLocationsController {
  constructor(
    private readonly userRoleLocationsService: UserRoleLocationsService,
  ) {}

  @Get()
  @ApiParam({ name: 'userRoleId', description: 'User role ID', type: Number })
  @ApiOperation({ summary: 'List location assignments for a user role' })
  list(@Param('userRoleId', ParseIntPipe) userRoleId: number) {
    return this.userRoleLocationsService.list(userRoleId);
  }

  @Post()
  @ApiParam({ name: 'userRoleId', description: 'User role ID', type: Number })
  @ApiOperation({ summary: 'Assign a location scope to a user role' })
  create(
    @Param('userRoleId', ParseIntPipe) userRoleId: number,
    @Body() dto: CreateUserRoleLocationDto,
  ) {
    return this.userRoleLocationsService.create(userRoleId, dto);
  }

  @Delete(':locationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'userRoleId', description: 'User role ID', type: Number })
  @ApiParam({
    name: 'locationId',
    description: 'User role location ID',
    type: Number,
  })
  @ApiOperation({ summary: 'Remove a location assignment from a user role' })
  remove(
    @Param('userRoleId', ParseIntPipe) userRoleId: number,
    @Param('locationId', ParseIntPipe) locationId: number,
  ) {
    return this.userRoleLocationsService.remove(userRoleId, locationId);
  }
}
