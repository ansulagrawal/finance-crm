import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RunoClientService } from './runo-client.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [RunoClientService],
  exports: [RunoClientService],
})
export class RunoModule {}
