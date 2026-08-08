import { awsSecretsLoader, awsSsmLoader, SharedAuthModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { CollectionExportsModule } from './modules/collection-exports/collection-exports.module';
import { CollectionReportsModule } from './modules/collection-reports/collection-reports.module';
import { CreditExportsModule } from './modules/credit-exports/credit-exports.module';
import { CreditReportsModule } from './modules/credit-reports/credit-reports.module';
import { DisbursalExportsModule } from './modules/disbursal-exports/disbursal-exports.module';
import { DisbursalReportsModule } from './modules/disbursal-reports/disbursal-reports.module';
import { FieldVisitReportsModule } from './modules/field-visit-reports/field-visit-reports.module';
import { FinancialExportsModule } from './modules/financial-exports/financial-exports.module';
import { LeadExportsModule } from './modules/lead-exports/lead-exports.module';
import { LeadReportsModule } from './modules/lead-reports/lead-reports.module';
import { ReportCatalogsModule } from './modules/report-catalogs/report-catalogs.module';

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
    CreditReportsModule,
    CreditExportsModule,
    FinancialExportsModule,
    DisbursalReportsModule,
    DisbursalExportsModule,
    LeadReportsModule,
    LeadExportsModule,
    CollectionReportsModule,
    CollectionExportsModule,
    FieldVisitReportsModule,
    ReportCatalogsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
