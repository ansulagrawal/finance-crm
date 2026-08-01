import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BankAccountStatusesController } from './bank-account-statuses.controller';
import { CustomerBankingController } from './customer-banking.controller';
import { DocumentTypesController } from './document-types.controller';
import { DocumentsController } from './documents.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [CommonModule],
  providers: [VerificationService],
  controllers: [
    DocumentTypesController,
    CustomerBankingController,
    DocumentsController,
    BankAccountStatusesController,
  ],
  exports: [VerificationService],
})
export class VerificationModule {}
