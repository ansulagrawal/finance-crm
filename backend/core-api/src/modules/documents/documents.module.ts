import { PdfModule, StorageModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { ConsentFormController } from './consent-form.controller';
import { ConsentFormService } from './consent-form.service';
import { KycZipController } from './kyc-zip.controller';
import { KycZipService } from './kyc-zip.service';
import { LegalNoticeController } from './legal-notice.controller';
import { LegalNoticeService } from './legal-notice.service';
import { SanctionLetterController } from './sanction-letter.controller';
import { SanctionLetterService } from './sanction-letter.service';

@Module({
  imports: [CommonModule, PdfModule, StorageModule],
  providers: [
    SanctionLetterService,
    KycZipService,
    ConsentFormService,
    LegalNoticeService,
  ],
  controllers: [
    SanctionLetterController,
    KycZipController,
    ConsentFormController,
    LegalNoticeController,
  ],
})
export class DocumentsModule {}
