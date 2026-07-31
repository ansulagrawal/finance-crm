import { Roles } from '@finance-crm/common';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListActivityLogsQueryDto } from './dto/list-activity-logs-query.dto';
import { UsersService } from './users.service';

@ApiTags('Activity Logs')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List user activity log entries with filters' })
  list(@Query() query: ListActivityLogsQueryDto) {
    return this.usersService.listActivityLogs(query);
  }
}
