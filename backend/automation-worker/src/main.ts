import { hydrateRemoteConfig } from '@finance-crm/common';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Must precede NestFactory.create — see hydrateRemoteConfig's doc comment.
  await hydrateRemoteConfig();

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1/automation');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3003);
}
bootstrap();
