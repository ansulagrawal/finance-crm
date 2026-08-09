import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CollectionExportsController } from './collection-exports.controller';
import { CollectionExportsService } from './collection-exports.service';

@Module({
  imports: [CommonModule],
  controllers: [CollectionExportsController],
  providers: [CollectionExportsService],
})
export class CollectionExportsModule {}
