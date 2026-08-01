import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser, Roles } from '@finance-crm/common';
import {
  Body,
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
import { CreateBlacklistedPincodeDto } from './dto/create-blacklisted-pincode.dto';
import { GeographyService } from './geography.service';

@ApiTags('Blacklisted Pincodes')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('blacklisted-pincodes')
export class BlacklistedPincodesController {
  constructor(private readonly geographyService: GeographyService) {}

  @Roles()
  @Get()
  @ApiOperation({ summary: 'List blacklisted pincodes' })
  list() {
    return this.geographyService.listBlacklistedPincodes();
  }

  @Post()
  @ApiOperation({ summary: 'Blacklist a pincode' })
  create(
    @Body() dto: CreateBlacklistedPincodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.geographyService.createBlacklistedPincode(dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Blacklisted pincode ID', type: Number })
  @ApiOperation({ summary: 'Remove a pincode from the blacklist' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.geographyService.removeBlacklistedPincode(id);
  }
}
