import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [CommonModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
