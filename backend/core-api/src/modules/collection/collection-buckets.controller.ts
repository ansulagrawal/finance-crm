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
import { CollectionBucketPermissionService } from './collection-bucket-permission.service';
import { CreateCollectionBucketDto } from './dto/create-collection-bucket.dto';
import { GrantCollectionBucketPermissionDto } from './dto/grant-collection-bucket-permission.dto';
import { UpdateCollectionBucketDto } from './dto/update-collection-bucket.dto';

@ApiTags('Collection Buckets')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('collection-buckets')
export class CollectionBucketsController {
  constructor(
    private readonly bucketPermissionService: CollectionBucketPermissionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List DPD collection buckets' })
  list() {
    return this.bucketPermissionService.listBuckets();
  }

  @Post()
  @ApiOperation({ summary: 'Create a DPD collection bucket' })
  create(@Body() dto: CreateCollectionBucketDto) {
    return this.bucketPermissionService.createBucket(dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Collection bucket ID', type: Number })
  @ApiOperation({ summary: 'Get a DPD collection bucket by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.bucketPermissionService.findBucket(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Collection bucket ID', type: Number })
  @ApiOperation({ summary: 'Update a DPD collection bucket' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCollectionBucketDto,
  ) {
    return this.bucketPermissionService.updateBucket(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Collection bucket ID', type: Number })
  @ApiOperation({ summary: 'Delete a DPD collection bucket' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bucketPermissionService.removeBucket(id);
  }
}

@ApiTags('Collection Buckets')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('collection-bucket-permissions')
export class CollectionBucketPermissionsController {
  constructor(
    private readonly bucketPermissionService: CollectionBucketPermissionService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List DPD collection bucket permissions, optionally filtered by user',
  })
  list(@Query('userId', new ParseIntPipe({ optional: true })) userId?: number) {
    return this.bucketPermissionService.listPermissions(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Grant a DPD collection bucket to a user' })
  grant(
    @Body() dto: GrantCollectionBucketPermissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bucketPermissionService.grantPermission(dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Bucket permission ID', type: Number })
  @ApiOperation({ summary: 'Revoke a DPD collection bucket permission' })
  revoke(@Param('id', ParseIntPipe) id: number) {
    return this.bucketPermissionService.revokePermission(id);
  }
}
