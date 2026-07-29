import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { IntegrationsApiClient } from './integrations-api-client';

/**
 * Wraps `IntegrationsApiClient` (and the `HttpModule` it needs) as its own
 * importable module. Any module that calls out to `integrations-api`
 * imports this instead of registering the client directly.
 */
@Module({
  imports: [HttpModule],
  providers: [IntegrationsApiClient],
  exports: [IntegrationsApiClient],
})
export class IntegrationsApiClientModule {}
