import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SignzyClientService } from './signzy-client.service';

@Module({
  imports: [HttpModule.register({ timeout: 30_000 })],
  providers: [SignzyClientService],
  exports: [SignzyClientService],
})
export class SignzyModule {}
