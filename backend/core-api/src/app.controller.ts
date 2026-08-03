import { Public } from '@finance-crm/common';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Root greeting endpoint (default Nest scaffold, JWT-guarded)',
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  @ApiOperation({
    summary:
      'Health check (unauthenticated, for load balancer/container liveness probes)',
  })
  health(): string {
    return this.appService.getHealth();
  }
}
