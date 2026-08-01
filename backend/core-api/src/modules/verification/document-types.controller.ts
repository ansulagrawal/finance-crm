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
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { UpdateDocumentTypeDto } from './dto/update-document-type.dto';
import { VerificationService } from './verification.service';

@ApiTags('Document Types')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('document-types')
export class DocumentTypesController {
  constructor(private readonly verificationService: VerificationService) {}

  @Roles()
  @Get()
  @ApiOperation({ summary: 'List document types' })
  list() {
    return this.verificationService.listDocumentTypes();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new document type' })
  create(@Body() dto: CreateDocumentTypeDto) {
    return this.verificationService.createDocumentType(dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Document type ID', type: Number })
  @ApiOperation({ summary: 'Get a document type by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.verificationService.findDocumentTypeById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Document type ID', type: Number })
  @ApiOperation({ summary: 'Update a document type' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentTypeDto,
  ) {
    return this.verificationService.updateDocumentType(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Document type ID', type: Number })
  @ApiOperation({ summary: 'Delete a document type' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.verificationService.removeDocumentType(id);
  }
}
