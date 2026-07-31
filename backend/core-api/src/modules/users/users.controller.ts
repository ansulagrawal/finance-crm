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
import { AssignUserRoleDto } from './dto/assign-user-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListActivityLogsQueryDto } from './dto/list-activity-logs-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users with pagination and filters' })
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get('by-role')
  @Roles()
  @ApiOperation({
    summary:
      'List active users holding a given role (minimal {id, name} shape, for assignment pickers) — open to any authenticated user',
  })
  listByRole(@Query('role') role: string) {
    return this.usersService.listByRole(role);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiOperation({ summary: 'Get a user by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiOperation({ summary: 'Update a user' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiOperation({ summary: 'Soft-delete a user' })
  softDelete(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.softDelete(id);
  }

  @Patch(':id/activate')
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiOperation({ summary: 'Activate a user account' })
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.setActive(id, true);
  }

  @Patch(':id/deactivate')
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiOperation({ summary: 'Deactivate a user account' })
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.setActive(id, false);
  }

  @Patch(':id/unlock')
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiOperation({ summary: 'Unlock a user account that was locked out' })
  unlock(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.unlock(id);
  }

  @Get(':id/roles')
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiOperation({ summary: 'List roles assigned to a user' })
  listRoles(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.listRoles(id);
  }

  @Post(':id/roles')
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiOperation({ summary: 'Assign a role to a user' })
  assignRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignUserRoleDto,
  ) {
    return this.usersService.assignRole(id, dto);
  }

  @Patch(':id/roles/:userRoleId')
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiParam({
    name: 'userRoleId',
    description: 'User role assignment ID',
    type: Number,
  })
  @ApiOperation({ summary: 'Update a user role assignment' })
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Param('userRoleId', ParseIntPipe) userRoleId: number,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(id, userRoleId, dto);
  }

  @Delete(':id/roles/:userRoleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiParam({
    name: 'userRoleId',
    description: 'User role assignment ID',
    type: Number,
  })
  @ApiOperation({ summary: 'Remove a role assignment from a user' })
  removeRole(
    @Param('id', ParseIntPipe) id: number,
    @Param('userRoleId', ParseIntPipe) userRoleId: number,
  ) {
    return this.usersService.removeRole(id, userRoleId);
  }

  @Get(':id/activity-logs')
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiOperation({ summary: 'List activity log entries for a specific user' })
  listActivityLogs(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ListActivityLogsQueryDto,
  ) {
    return this.usersService.listActivityLogs({ ...query, userId: id });
  }
}
