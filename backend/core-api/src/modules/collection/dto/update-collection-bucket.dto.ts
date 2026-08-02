import { PartialType } from '@nestjs/swagger';
import { CreateCollectionBucketDto } from './create-collection-bucket.dto';

export class UpdateCollectionBucketDto extends PartialType(
  CreateCollectionBucketDto,
) {}
