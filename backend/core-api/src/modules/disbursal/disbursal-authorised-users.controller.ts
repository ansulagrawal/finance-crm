import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser, Roles } from '@finance-crm/common';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { DisbursalService } from './disbursal.service';

/**
 * Manages `disbursal_authorised_users` — the named-individual whitelist the
 * ONLINE disbursal path checks (see `DisbursalAuthorisedUser`). Admin-only:
 * this list is what stands between a DS role and moving real money, so
 * editing it is a strictly higher privilege than using it.
 */
@ApiTags('Disbursal Authorisation')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('disbursal-authorised-users')
export class DisbursalAuthorisedUsersController {
  constructor(private readonly disbursalService: DisbursalService) {}

  @Get()
  @ApiOperation({ summary: 'List the users authorised to disburse online' })
  list() {
    return this.disbursalService.listAuthorisedUsers();
  }

  @Post(':userId')
  @ApiParam({ name: 'userId', description: 'User ID', type: Number })
  @ApiOperation({
    summary: 'Authorise a user to run the ONLINE (money-moving) disbursal',
  })
  grant(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disbursalService.grantDisbursalAuthorisation(userId, user.sub);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'userId', description: 'User ID', type: Number })
  @ApiOperation({ summary: 'Revoke a user disbursal authorisation' })
  revoke(@Param('userId', ParseIntPipe) userId: number) {
    return this.disbursalService.revokeDisbursalAuthorisation(userId);
  }
}
