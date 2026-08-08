import {
  ACCESS_TOKEN_COOKIE,
  assertStrongSecrets,
  hydrateRemoteConfig,
  parseCorsOrigins,
} from '@finance-crm/common';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
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
  // SharedAuthModule's JwtStrategy reads the access token from a cookie —
  // without this middleware, req.cookies is always undefined and every
  // authenticated route silently 401s regardless of a valid session cookie.
  app.use(cookieParser());

  const configService = app.get(ConfigService);
  // No INTERNAL_SERVICE_SECRET — reporting-api is never an internal-request
  // receiver, so it legitimately has none configured.
  assertStrongSecrets(configService, ['JWT_ACCESS_SECRET']);

  // See core-api's main.ts — without this, the ipAddress recorded on every
  // mis_access_logs/export_access_logs row is the proxy's, not the client's.
  app.set('trust proxy', Number(configService.get('TRUSTED_PROXY_HOPS', 1)));

  // Same allow-list as core-api. Needed here too: the browser applies CORS per
  // response, and a deployed front end calls /api/v1/reporting/* and
  // /api/v1/integrations/* directly through the gateway. This never surfaced
  // in local development because the Vite proxy makes every call same-origin.
  app.enableCors({
    origin: parseCorsOrigins(configService.get<string>('CORS_ORIGIN')),
    credentials: true,
  });

  app.setGlobalPrefix('api/v1/reporting');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Strips `@Exclude()`-marked entity fields (e.g. `User.passwordHash`)
  // from every response, however deeply nested.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Opt-in only — see core-api's main.ts for why.
  if (configService.get<string>('SWAGGER_ENABLED', 'false') === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Finance CRM Reporting API')
      .setDescription(
        'Read-only MIS reports and CSV exports, permission-gated per report/export type.',
      )
      .setVersion('1.0')
      .addCookieAuth(ACCESS_TOKEN_COOKIE, {
        type: 'apiKey',
        in: 'cookie',
        name: ACCESS_TOKEN_COOKIE,
        description:
          'JWT access token issued by core-api, stored as an httpOnly cookie.',
      })
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/v1/reporting/docs', app, swaggerDocument);
  }

  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();
