import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CollectionReportsController } from './collection-reports.controller';
import { CollectionReportsService } from './collection-reports.service';

@Module({
  imports: [CommonModule],
  controllers: [CollectionReportsController],
  providers: [CollectionReportsService],
})
export class CollectionReportsModule {}
