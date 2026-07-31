import { IntegrationsApiClientModule, SharedAuthModule } from '@finance-crm/common';
import {
  PasswordResetRequest,
  RefreshToken,
  User,
  UserActivityLog,
  UserRole,
} from '@finance-crm/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { NotificationsService } from './notifications.service';
import { SessionController } from './session.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserRole,
      UserActivityLog,
      RefreshToken,
      PasswordResetRequest,
    ]),
    SharedAuthModule,
    IntegrationsApiClientModule,
  ],
  controllers: [AuthController, SessionController],
  providers: [AuthService, NotificationsService],
  exports: [AuthService],
})
export class AuthModule {}
