import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { SignzyModule } from '../signzy/signzy.module';
import { CrifBureauController } from './crif-bureau.controller';
import { CrifBureauService } from './crif-bureau.service';

@Module({
  imports: [
    CommonModule,
    HttpModule.register({ timeout: 60_000 }),
    SignzyModule,
  ],
  controllers: [CrifBureauController],
  providers: [CrifBureauService],
})
export class CrifBureauModule {}
