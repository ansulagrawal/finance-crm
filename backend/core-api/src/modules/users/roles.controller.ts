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
import { CreateRoleTypeDto } from './dto/create-role-type.dto';
import { UpdateRoleTypeDto } from './dto/update-role-type.dto';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List role types' })
  list() {
    return this.rolesService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new role type' })
  create(@Body() dto: CreateRoleTypeDto) {
    return this.rolesService.create(dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Role type ID', type: Number })
  @ApiOperation({ summary: 'Get a role type by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Role type ID', type: Number })
  @ApiOperation({ summary: 'Update a role type' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleTypeDto,
  ) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Role type ID', type: Number })
  @ApiOperation({ summary: 'Delete a role type' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(id);
  }
}
