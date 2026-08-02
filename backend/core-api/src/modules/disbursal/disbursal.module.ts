import { IntegrationsApiClientModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { DisbursalAuthorisedUsersController } from './disbursal-authorised-users.controller';
import { DisbursalService } from './disbursal.service';
import { DisbursementBanksController } from './disbursement-banks.controller';
import { LoanController } from './loan.controller';

@Module({
  // IntegrationsApiClientModule: the online disbursal path calls
  // integrations-api's ICICI module over the HMAC-signed internal route.
  imports: [CommonModule, IntegrationsApiClientModule],
  providers: [DisbursalService],
  controllers: [
    DisbursalAuthorisedUsersController,
    DisbursementBanksController,
    LoanController,
  ],
  exports: [DisbursalService],
})
export class DisbursalModule {}
