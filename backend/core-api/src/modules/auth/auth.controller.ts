import { Public } from '@finance-crm/common';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignInDto } from './dto/sign-in.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

/**
 * Every route here is unauthenticated by definition, so each one is also a
 * free brute-force/abuse oracle without a per-IP limit on top of the app's
 * baseline throttle: `signin` guesses passwords, `verify-otp` guesses a
 * 6-digit OTP, and `forgot-password` is an email-bombing primitive. The
 * `@Throttle` budgets below are deliberately far below the global default —
 * a real human signing in or resetting a password needs single-digit
 * requests per minute, nothing more.
 */
@ApiTags('Auth')
@Public()
@Controller('api')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signin')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Sign in with email/username and password, issuing access and refresh token cookies',
  })
  async signIn(
    @Body() dto: SignInDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, ...tokens } = await this.authService.signIn(
      dto,
      ip,
      userAgent,
    );
    this.authService.applyAuthCookies(res, tokens);
    return { user };
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset OTP be sent to the registered email',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    // Echoed into the OTP email so a recipient who did NOT request the reset
    // can see where it came from — the only signal they get that someone is
    // attempting to take over their account.
    await this.authService.requestPasswordReset(dto, {
      ipAddress: ip,
      userAgent,
    });
    return {
      message:
        'If the email is registered, a password reset OTP has been sent.',
    };
  }

  @Post('forgot-password/verify-otp')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify the password reset OTP sent to the user email',
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyPasswordResetOtp(dto);
  }

  @Post('forgot-password/reset')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset the password using a verified OTP token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password has been reset successfully.' };
  }
}
