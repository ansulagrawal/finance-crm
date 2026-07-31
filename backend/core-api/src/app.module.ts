import { awsSecretsLoader, awsSsmLoader } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BreModule } from './modules/bre/bre.module';
import { CamModule } from './modules/cam/cam.module';
import { CollectionModule } from './modules/collection/collection.module';
import { CompanyModule } from './modules/company/company.module';
import { DisbursalModule } from './modules/disbursal/disbursal.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { FieldVerificationModule } from './modules/field-verification/field-verification.module';
import { GeographyModule } from './modules/geography/geography.module';
import { LeadAllocationModule } from './modules/lead-allocation/lead-allocation.module';
import { LeadsModule } from './modules/leads/leads.module';
import { MenuPermissionsModule } from './modules/menu-permissions/menu-permissions.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { SearchModule } from './modules/search/search.module';
import { SupportModule } from './modules/support/support.module';
import { UsersModule } from './modules/users/users.module';
import { VerificationModule } from './modules/verification/verification.module';

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
    // Baseline request rate limit for every route, with the credential
    // endpoints tightened further via `@Throttle()` on their handlers (see
    // AuthController). Registered before AuthModule so ThrottlerGuard is
    // the first global guard in the chain and an unauthenticated flood is
    // rejected before any DB work happens.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            // Number(...) — ConfigService.get<number>() does not cast; the
            // raw string would make ttl comparisons string-vs-number.
            ttl: Number(config.get('THROTTLE_TTL_MS', 60_000)),
            limit: Number(config.get('THROTTLE_LIMIT', 300)),
          },
        ],
      }),
    }),
    CommonModule,
    AuthModule,
    CompanyModule,
    GeographyModule,
    UsersModule,
    MenuPermissionsModule,
    VerificationModule,
    FeedbackModule,
    DocumentsModule,
    AuditModule,
    CollectionModule,
    LeadsModule,
    LeadAllocationModule,
    SearchModule,
    BreModule,
    CamModule,
    SupportModule,
    DisbursalModule,
    FieldVerificationModule,
    PerformanceModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
