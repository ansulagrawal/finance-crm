import { awsSecretsLoader, awsSsmLoader, JobRunnerModule } from '@finance-crm/common';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { AllocateLeadsAndApplicationModule } from './jobs/allocate-leads-and-application/allocate-leads-and-application.module';
import { BirthdayEmailModule } from './jobs/birthday-email/birthday-email.module';
import { ClosedLoanFeedbackEmailModule } from './jobs/closed-loan-feedback-email/closed-loan-feedback-email.module';
import { CollectionDefaulterEscalationModule } from './jobs/collection-defaulter-escalation/collection-defaulter-escalation.module';
import { CreditApplicationAllocationModule } from './jobs/credit-application-allocation/credit-application-allocation.module';
import { HoldRedistributionModule } from './jobs/hold-redistribution/hold-redistribution.module';
import { LeadRejectionModule } from './jobs/lead-rejection/lead-rejection.module';
import { LegalNoticeEmailModule } from './jobs/legal-notice-email/legal-notice-email.module';
import { LoanOutstandingRecomputeModule } from './jobs/loan-outstanding-recompute/loan-outstanding-recompute.module';
import { NotContactableLeadEmailModule } from './jobs/not-contactable-lead-email/not-contactable-lead-email.module';
import { NotContactableLeadSmsModule } from './jobs/not-contactable-lead-sms/not-contactable-lead-sms.module';
import { OutstandingLoanDigestEmailModule } from './jobs/outstanding-loan-digest-email/outstanding-loan-digest-email.module';
import { PoiFatherNameSyncModule } from './jobs/poi-father-name-sync/poi-father-name-sync.module';
import { ReloanPitchEmailModule } from './jobs/reloan-pitch-email/reloan-pitch-email.module';
import { RepaymentReminderEmailModule } from './jobs/repayment-reminder-email/repayment-reminder-email.module';
import { RepaymentReminderSmsModule } from './jobs/repayment-reminder-sms/repayment-reminder-sms.module';
import { RepeatOnlineCustomersAllocationModule } from './jobs/repeat-online-customers-allocation/repeat-online-customers-allocation.module';
import { ScreenerAllocationModule } from './jobs/screener-allocation/screener-allocation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      load: [awsSsmLoader, awsSecretsLoader],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_DATABASE', 'finance_crm_backend'),
        charset: 'utf8mb4',
        // Legacy PK types include plain `bigint` (docs/SCHEMA-MAP.md: 24 of
        // them) — without this, mysql2 returns those as JS strings instead
        // of numbers.
        extra: { supportBigNumbers: true, bigNumberStrings: false },
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    HttpModule,
    CommonModule,
    JobRunnerModule,
    ScreenerAllocationModule,
    CreditApplicationAllocationModule,
    RepeatOnlineCustomersAllocationModule,
    AllocateLeadsAndApplicationModule,
    HoldRedistributionModule,
    LeadRejectionModule,
    CollectionDefaulterEscalationModule,
    LegalNoticeEmailModule,
    BirthdayEmailModule,
    NotContactableLeadEmailModule,
    NotContactableLeadSmsModule,
    ClosedLoanFeedbackEmailModule,
    ReloanPitchEmailModule,
    OutstandingLoanDigestEmailModule,
    PoiFatherNameSyncModule,
    RepaymentReminderEmailModule,
    RepaymentReminderSmsModule,
    LoanOutstandingRecomputeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
