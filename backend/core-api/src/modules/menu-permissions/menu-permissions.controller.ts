import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser, Roles } from '@finance-crm/common';
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
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { GrantExportPermissionDto } from './dto/grant-export-permission.dto';
import { GrantMisPermissionDto } from './dto/grant-mis-permission.dto';
import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuPermissionsService } from './menu-permissions.service';

@ApiTags('Menu Permissions')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('menu-items')
export class MenuItemsController {
  constructor(
    private readonly menuPermissionsService: MenuPermissionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List menu items, optionally filtered by role type',
  })
  list(@Query() query: ListMenuItemsQueryDto) {
    return this.menuPermissionsService.list(query);
  }

  @Get('grouped')
  @ApiOperation({ summary: 'List menu items grouped by section' })
  listGrouped(@Query() query: ListMenuItemsQueryDto) {
    return this.menuPermissionsService.listGrouped(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new menu item' })
  create(
    @Body() dto: CreateMenuItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menuPermissionsService.create(dto, user.sub);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Menu item ID', type: Number })
  @ApiOperation({ summary: 'Get a menu item by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.menuPermissionsService.findById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Menu item ID', type: Number })
  @ApiOperation({ summary: 'Update a menu item' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMenuItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menuPermissionsService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Menu item ID', type: Number })
  @ApiOperation({ summary: 'Delete a menu item' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.menuPermissionsService.remove(id);
  }
}

@ApiTags('Menu Permissions')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('export-permissions')
export class ExportPermissionsController {
  constructor(
    private readonly menuPermissionsService: MenuPermissionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List export permissions, optionally filtered by user',
  })
  list(@Query('userId', new ParseIntPipe({ optional: true })) userId?: number) {
    return this.menuPermissionsService.listExportPermissions(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Grant an export permission to a user' })
  grant(
    @Body() dto: GrantExportPermissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menuPermissionsService.grantExportPermission(dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Export permission ID', type: Number })
  @ApiOperation({ summary: 'Revoke an export permission' })
  revoke(@Param('id', ParseIntPipe) id: number) {
    return this.menuPermissionsService.revokeExportPermission(id);
  }
}

@ApiTags('Menu Permissions')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('mis-permissions')
export class MisPermissionsController {
  constructor(
    private readonly menuPermissionsService: MenuPermissionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List MIS report permissions, optionally filtered by user',
  })
  list(@Query('userId', new ParseIntPipe({ optional: true })) userId?: number) {
    return this.menuPermissionsService.listMisPermissions(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Grant an MIS report permission to a user' })
  grant(
    @Body() dto: GrantMisPermissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menuPermissionsService.grantMisPermission(dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'MIS permission ID', type: Number })
  @ApiOperation({ summary: 'Revoke an MIS report permission' })
  revoke(@Param('id', ParseIntPipe) id: number) {
    return this.menuPermissionsService.revokeMisPermission(id);
  }
}
