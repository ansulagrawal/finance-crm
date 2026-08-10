import { Public } from '@finance-crm/common';
import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App')
@ApiCookieAuth()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @ApiOperation({ summary: 'Health check endpoint (public, no auth required)' })
  @Get('health')
  health(): string {
    return this.appService.getHealth();
  }
}
