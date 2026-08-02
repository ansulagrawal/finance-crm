import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CollectionBucketPermissionService } from './collection-bucket-permission.service';
import {
  CollectionBucketPermissionsController,
  CollectionBucketsController,
} from './collection-buckets.controller';
import { CollectionFollowupsController } from './collection-followups.controller';
import { CollectionLookupsController } from './collection-lookups.controller';
import { CollectionVisitsController } from './collection-visits.controller';
import { CollectionService } from './collection.service';
import { CustomerBlacklistController } from './customer-blacklist.controller';
import { CustomerBlacklistCheckService } from './customer-blacklist-check.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [CommonModule],
  providers: [
    CollectionService,
    CustomerBlacklistCheckService,
    CollectionBucketPermissionService,
  ],
  controllers: [
    CollectionLookupsController,
    PaymentsController,
    CollectionFollowupsController,
    CollectionVisitsController,
    CustomerBlacklistController,
    CollectionBucketsController,
    CollectionBucketPermissionsController,
  ],
  exports: [CustomerBlacklistCheckService, CollectionBucketPermissionService],
})
export class CollectionModule {}
