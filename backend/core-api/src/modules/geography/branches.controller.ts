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
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { GeographyService } from './geography.service';

@ApiTags('Branches')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('branches')
export class BranchesController {
  constructor(private readonly geographyService: GeographyService) {}

  @Get()
  @Roles()
  @ApiOperation({ summary: 'List branches' })
  list() {
    return this.geographyService.listBranches();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new branch' })
  create(@Body() dto: CreateBranchDto) {
    return this.geographyService.createBranch(dto);
  }

  @Get(':id')
  @Roles()
  @ApiParam({ name: 'id', description: 'Branch ID', type: Number })
  @ApiOperation({ summary: 'Get a branch by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.geographyService.findBranchById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Branch ID', type: Number })
  @ApiOperation({ summary: 'Update a branch' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBranchDto) {
    return this.geographyService.updateBranch(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Branch ID', type: Number })
  @ApiOperation({ summary: 'Delete a branch' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.geographyService.removeBranch(id);
  }
}
