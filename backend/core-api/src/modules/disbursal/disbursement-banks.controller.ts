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
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { DisbursalService } from './disbursal.service';
import { CreateDisbursementBankDto } from './dto/create-disbursement-bank.dto';
import { UpdateDisbursementBankDto } from './dto/update-disbursement-bank.dto';

@ApiTags('Disbursement Banks')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('disbursement-banks')
export class DisbursementBanksController {
  constructor(private readonly disbursalService: DisbursalService) {}

  @Roles()
  @Get()
  @ApiOperation({ summary: 'List all disbursement bank accounts' })
  list() {
    return this.disbursalService.listBanks();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new disbursement bank account' })
  create(
    @Body() dto: CreateDisbursementBankDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disbursalService.createBank(dto, user.sub);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Disbursement bank ID', type: Number })
  @ApiOperation({ summary: 'Get a disbursement bank account by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.disbursalService.findBankById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Disbursement bank ID', type: Number })
  @ApiOperation({ summary: 'Update a disbursement bank account' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDisbursementBankDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disbursalService.updateBank(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Disbursement bank ID', type: Number })
  @ApiOperation({ summary: 'Delete a disbursement bank account' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.disbursalService.removeBank(id);
  }
}
