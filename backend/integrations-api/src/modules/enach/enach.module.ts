import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { EnachController } from './enach.controller';
import { EnachService } from './enach.service';

@Module({
  imports: [CommonModule, HttpModule.register({ timeout: 30_000 })],
  controllers: [EnachController],
  providers: [EnachService],
})
export class EnachModule {}
