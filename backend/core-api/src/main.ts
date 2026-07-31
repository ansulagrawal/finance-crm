import {
  ACCESS_TOKEN_COOKIE,
  assertStrongSecrets,
  hydrateRemoteConfig,
  parseCorsOrigins,
} from '@finance-crm/common';
import {
  ClassSerializerInterceptor,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // Must precede NestFactory.create — see hydrateRemoteConfig's doc comment.
  await hydrateRemoteConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());
  app.use(cookieParser());

  const configService = app.get(ConfigService);
  assertStrongSecrets(configService, [
    'JWT_ACCESS_SECRET',
    'INTERNAL_SERVICE_SECRET',
  ]);

  // Behind the gateway/ALB, the socket peer is the proxy, not the client.
  // Without this every `@Ip()` value — `User.lastLoginIp`,
  // `UserActivityLog.ipAddress`, the document-download audit trail — records
  // the proxy's address, which makes the audit trail useless for forensics.
  // A hop count (not `true`) so only the proxies we actually run can set
  // X-Forwarded-For; `true` would let any client spoof it outright.
  app.set('trust proxy', Number(configService.get('TRUSTED_PROXY_HOPS', 1)));

  app.enableCors({
    origin: parseCorsOrigins(configService.get<string>('CORS_ORIGIN')),
    credentials: true,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'api/signin', method: RequestMethod.POST },
      { path: 'api/forgot-password', method: RequestMethod.POST },
      { path: 'api/forgot-password/verify-otp', method: RequestMethod.POST },
      { path: 'api/forgot-password/reset', method: RequestMethod.POST },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Strips `@Exclude()`-marked entity fields (e.g. `User.passwordHash`)
  // from every response, however deeply nested (e.g. `Lead.screenerAssignedTo`).
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // `SwaggerModule.setup` mounts raw Express handlers that the global
  // `JwtAuthGuard` never sees, so in production this published the complete
  // route/schema inventory — every endpoint, parameter and DTO shape — to
  // anyone who could reach the gateway. Opt-in only.
  if (configService.get<string>('SWAGGER_ENABLED', 'false') === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Finance CRM Core API')
      .setDescription(
        'Loan-lifecycle CRUD/workflow API: leads, CAM, BRE, disbursal, collection, verification, ' +
          'feedback, users/roles/auth, company, geography, audit, menu/permissions, search.',
      )
      .setVersion('1.0')
      .addCookieAuth(ACCESS_TOKEN_COOKIE, {
        type: 'apiKey',
        in: 'cookie',
        name: ACCESS_TOKEN_COOKIE,
        description:
          'JWT access token issued by POST /api/signin, stored as an httpOnly cookie.',
      })
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/v1/core/docs', app, swaggerDocument);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
