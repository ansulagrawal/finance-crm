import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import {
  ExportPermissionsController,
  MenuItemsController,
  MisPermissionsController,
} from './menu-permissions.controller';
import { MenuPermissionsService } from './menu-permissions.service';

@Module({
  imports: [CommonModule],
  controllers: [
    MenuItemsController,
    ExportPermissionsController,
    MisPermissionsController,
  ],
  providers: [MenuPermissionsService],
})
export class MenuPermissionsModule {}
