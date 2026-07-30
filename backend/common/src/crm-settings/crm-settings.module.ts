import { CrmSetting } from '@finance-crm/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrmSettingsService } from './crm-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([CrmSetting])],
  providers: [CrmSettingsService],
  exports: [CrmSettingsService],
})
export class CrmSettingsModule {}
