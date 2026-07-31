import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser, Public, REFRESH_TOKEN_COOKIE } from '@finance-crm/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Session')
@ApiCookieAuth()
@Controller('auth')
export class SessionController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get the currently authenticated user from the JWT',
  })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Public()
  @Post('refresh-token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Exchange a valid refresh token cookie for new access/refresh token cookies',
  })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const tokens = await this.authService.refreshTokens(refreshToken);
    this.authService.applyAuthCookies(res, tokens);
    return { message: 'Session refreshed.' };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the refresh token and clear auth cookies' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    this.authService.clearAuthCookies(res);
    return { message: 'Logged out successfully.' };
  }

  @Post('change-password')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Change the current user password after verifying the old password',
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.sub, dto);
    return { message: 'Password changed successfully.' };
  }
}
