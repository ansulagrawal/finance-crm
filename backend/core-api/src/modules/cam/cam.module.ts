import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CompanyModule } from '../company/company.module';
import { CamController } from './cam.controller';
import { CamService } from './cam.service';

@Module({
  imports: [CommonModule, CompanyModule],
  providers: [CamService],
  controllers: [CamController],
  exports: [CamService],
})
export class CamModule {}
