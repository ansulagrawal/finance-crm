import { awsSecretsLoader, awsSsmLoader, SharedAuthModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { AccountAggregatorModule } from './modules/account-aggregator/account-aggregator.module';
import { AddressDistanceModule } from './modules/address-distance/address-distance.module';
import { AddressLatLongModule } from './modules/address-lat-long/address-lat-long.module';
import { BankAnalysisModule } from './modules/bank-analysis/bank-analysis.module';
import { BankVerificationModule } from './modules/bank-verification/bank-verification.module';
import { CallManagementModule } from './modules/call-management/call-management.module';
import { CrifBureauModule } from './modules/crif-bureau/crif-bureau.module';
import { DomainEmailVerificationModule } from './modules/domain-email-verification/domain-email-verification.module';
import { EkycModule } from './modules/ekyc/ekyc.module';
import { EmailModule } from './modules/email/email.module';
import { EmailValidationModule } from './modules/email-validation/email-validation.module';
import { EnachModule } from './modules/enach/enach.module';
import { EsignModule } from './modules/esign/esign.module';
import { FaceMatchModule } from './modules/face-match/face-match.module';
import { IciciDisbursementModule } from './modules/icici-disbursement/icici-disbursement.module';
import { PoiVerificationModule } from './modules/poi-verification/poi-verification.module';
import { RazorpayModule } from './modules/razorpay/razorpay.module';
import { ReverseGeocodeModule } from './modules/reverse-geocode/reverse-geocode.module';
import { SmsModule } from './modules/sms/sms.module';
import { UanVerificationModule } from './modules/uan-verification/uan-verification.module';
import { UpiModule } from './modules/upi/upi.module';
import { VideoKycModule } from './modules/video-kyc/video-kyc.module';

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
    SharedAuthModule,
    CommonModule,
    CrifBureauModule,
    BankAnalysisModule,
    EmailValidationModule,
    SmsModule,
    EmailModule,
    CallManagementModule,
    AccountAggregatorModule,
    AddressDistanceModule,
    AddressLatLongModule,
    BankVerificationModule,
    DomainEmailVerificationModule,
    EkycModule,
    EnachModule,
    EsignModule,
    FaceMatchModule,
    IciciDisbursementModule,
    PoiVerificationModule,
    RazorpayModule,
    ReverseGeocodeModule,
    UanVerificationModule,
    UpiModule,
    VideoKycModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
