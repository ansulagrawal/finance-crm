import { Roles } from '@finance-crm/common';
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
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreatePincodeDto } from './dto/create-pincode.dto';
import { UpdatePincodeDto } from './dto/update-pincode.dto';
import { GeographyService } from './geography.service';

@ApiTags('Pincodes')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('pincodes')
export class PincodesController {
  constructor(private readonly geographyService: GeographyService) {}

  @Get()
  @ApiOperation({ summary: 'List pincodes, optionally filtered by city' })
  list(@Query('cityId', new ParseIntPipe({ optional: true })) cityId?: number) {
    return this.geographyService.listPincodes(cityId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new pincode' })
  create(@Body() dto: CreatePincodeDto) {
    return this.geographyService.createPincode(dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Pincode ID', type: Number })
  @ApiOperation({ summary: 'Get a pincode by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.geographyService.findPincodeById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Pincode ID', type: Number })
  @ApiOperation({ summary: 'Update a pincode' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePincodeDto) {
    return this.geographyService.updatePincode(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Pincode ID', type: Number })
  @ApiOperation({ summary: 'Delete a pincode' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.geographyService.removePincode(id);
  }
}
