import { User } from '@finance-crm/database';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './jwt.strategy';

/**
 * JWT verification only — no login/refresh/logout endpoints (those stay in core-api,
 * the sole token issuer). Every service imports this to get the global JwtAuthGuard +
 * RolesGuard + @Public()/@Roles() behavior consistently, since verification needs no
 * HTTP callback to core-api.
 *
 * `TypeOrmModule.forFeature([User])` is registered here because `JwtStrategy` now
 * confirms the account behind a token is still active on every request (see its
 * `validate()`). Registering `User` needs `Company`/`Product` — its `@ManyToOne`
 * targets — registered somewhere in the same app or `autoLoadEntities` fails at boot;
 * all three services importing this module register `ALL_ENTITIES` in their own
 * `CommonModule`, so that holds. `automation-worker` has no guards and does not
 * import this module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          // `ConfigService.get<number>()` does NOT actually cast env-var
          // strings to numbers (the generic is a type hint only) — passing
          // the raw string straight to jsonwebtoken's `expiresIn` gets it
          // misparsed by the `ms` package as milliseconds instead of
          // seconds (e.g. "900" -> ~0.9s, not 900s). Number(...) fixes it.
          expiresIn: Number(config.get('JWT_ACCESS_EXPIRES_IN_SECONDS', 900)),
        },
      }),
    }),
  ],
  providers: [
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule, PassportModule],
})
export class SharedAuthModule {}
