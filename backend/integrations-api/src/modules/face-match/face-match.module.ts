import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { SignzyModule } from '../signzy/signzy.module';
import { FaceMatchController } from './face-match.controller';
import { FaceMatchService } from './face-match.service';

@Module({
  imports: [CommonModule, SignzyModule],
  controllers: [FaceMatchController],
  providers: [FaceMatchService],
})
export class FaceMatchModule {}
