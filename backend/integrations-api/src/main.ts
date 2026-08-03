import { join } from 'node:path';
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
import { text } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // Must precede NestFactory.create — see hydrateRemoteConfig's doc comment.
  await hydrateRemoteConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.use(helmet());

  // ICICI's UPI deposit callback posts a raw base64 ciphertext body
  // (content-type text/plain), not JSON — see UpiCallbackController.
  // The size cap matters because this route is `@Public()`: without it an
  // unauthenticated caller can push a body of arbitrary size straight into
  // memory and into the `encryptedResponse` column. A single RSA block of
  // base64 is well under 1kb.
  app.use(
    '/api/v1/integrations/upi/callback',
    text({ type: '*/*', limit: '16kb' }),
  );

  // SharedAuthModule's JwtStrategy reads the access token from a cookie —
  // without this middleware, req.cookies is always undefined and every
  // authenticated route silently 401s regardless of a valid session cookie.
  app.use(cookieParser());

  const configService = app.get(ConfigService);
  assertStrongSecrets(configService, [
    'JWT_ACCESS_SECRET',
    'INTERNAL_SERVICE_SECRET',
  ]);

  // See core-api's main.ts — vendor callbacks and staff requests both arrive
  // via the gateway, so without this every logged IP is the proxy's.
  app.set('trust proxy', Number(configService.get('TRUSTED_PROXY_HOPS', 1)));

  // Same allow-list as core-api. Needed here too: the browser applies CORS per
  // response, and a deployed front end calls /api/v1/reporting/* and
  // /api/v1/integrations/* directly through the gateway. This never surfaced
  // in local development because the Vite proxy makes every call same-origin.
  app.enableCors({
    origin: parseCorsOrigins(configService.get<string>('CORS_ORIGIN')),
    credentials: true,
  });

  // Publicly readable static assets — currently just the logo the
  // password-reset email references. Served by this service rather than from
  // S3 or the frontend: that bucket holds KYC documents and must never be
  // public, and the email is produced here, so hanging it off a frontend
  // deploy would break it whenever the frontend moves.
  //
  // The path sits under the gateway's `/api/v1/integrations/` route so it
  // actually reaches this service, and it is Express-level middleware, so it
  // runs before the global JwtAuthGuard and needs no @Public() equivalent —
  // which is the point: a mail client fetches it with no session.
  app.useStaticAssets(join(__dirname, '..', 'assets'), {
    prefix: '/api/v1/integrations/assets/',
    // Immutable content behind a stable name; mail clients and their image
    // proxies refetch aggressively otherwise.
    maxAge: '7d',
  });

  app.setGlobalPrefix('api/v1/integrations');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Strips `@Exclude()`-marked entity fields (e.g. `User.passwordHash`)
  // from every response, however deeply nested (e.g. a vendor log's
  // `requestedBy` relation).
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Opt-in only — see core-api's main.ts for why.
  if (configService.get<string>('SWAGGER_ENABLED', 'false') === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Finance CRM Integrations API')
      .setDescription(
        'Third-party vendor adapters: bureau/eKYC/eSign/eNACH/face-match, payment gateways, ' +
          'SMS, email. Each module is env-var-gated per vendor credentials.',
      )
      .setVersion('1.0')
      .addCookieAuth(ACCESS_TOKEN_COOKIE, {
        type: 'apiKey',
        in: 'cookie',
        name: ACCESS_TOKEN_COOKIE,
        description:
          'JWT access token issued by core-api, stored as an httpOnly cookie.',
      })
      // Inbound vendor webhooks that carry no signature of their own
      // (Signzy video-KYC/eSign, CartBI bank-analysis/account-aggregator)
      // authenticate with this shared secret instead — see
      // VendorCallbackTokenGuard.
      .addApiKey(
        {
          type: 'apiKey',
          in: 'header',
          name: 'x-callback-token',
          description:
            'VENDOR_CALLBACK_TOKEN shared secret. Also accepted as a ?token= query parameter, for vendor consoles that cannot set custom headers.',
        },
        'vendor-callback-token',
      )
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/v1/integrations/docs', app, swaggerDocument);
  }

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
