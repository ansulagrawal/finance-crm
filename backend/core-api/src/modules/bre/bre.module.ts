import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CollectionModule } from '../collection/collection.module';
import { BreService } from './bre.service';
import { BreCategoriesController } from './bre-categories.controller';
import { BreEvaluationService } from './bre-evaluation.service';
import { BreResultsController } from './bre-results.controller';
import { BreRulesController } from './bre-rules.controller';

@Module({
  imports: [CommonModule, CollectionModule],
  providers: [BreService, BreEvaluationService],
  controllers: [
    BreCategoriesController,
    BreRulesController,
    BreResultsController,
  ],
})
export class BreModule {}
