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
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Company')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  @Roles()
  @ApiOperation({ summary: 'List all companies' })
  list() {
    return this.companyService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new company' })
  create(@Body() dto: CreateCompanyDto) {
    return this.companyService.create(dto);
  }

  @Get(':id')
  @Roles()
  @ApiParam({ name: 'id', description: 'Company ID', type: Number })
  @ApiOperation({ summary: 'Get a company by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.findById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Company ID', type: Number })
  @ApiOperation({ summary: 'Update a company' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyDto) {
    return this.companyService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Company ID', type: Number })
  @ApiOperation({ summary: 'Delete a company' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.remove(id);
  }

  @Get(':id/products')
  @Roles()
  @ApiParam({ name: 'id', description: 'Company ID', type: Number })
  @ApiOperation({ summary: 'List products belonging to a company' })
  listProducts(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.listProducts(id);
  }

  @Post(':id/products')
  @ApiParam({ name: 'id', description: 'Company ID', type: Number })
  @ApiOperation({ summary: 'Create a product under a company' })
  createProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProductDto,
  ) {
    return this.companyService.createProduct(id, dto);
  }

  @Patch(':id/products/:productId')
  @ApiParam({ name: 'id', description: 'Company ID', type: Number })
  @ApiParam({ name: 'productId', description: 'Product ID', type: Number })
  @ApiOperation({ summary: 'Update a product under a company' })
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.companyService.updateProduct(id, productId, dto);
  }

  @Delete(':id/products/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Company ID', type: Number })
  @ApiParam({ name: 'productId', description: 'Product ID', type: Number })
  @ApiOperation({ summary: 'Delete a product under a company' })
  removeProduct(
    @Param('id', ParseIntPipe) id: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.companyService.removeProduct(id, productId);
  }
}
