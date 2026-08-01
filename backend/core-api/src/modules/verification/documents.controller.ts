import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser } from '@finance-crm/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
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
import { CreateDocumentDto } from './dto/create-document.dto';
import { VerificationService } from './verification.service';

@ApiTags('Documents')
@ApiCookieAuth()
@Controller('leads/:leadId/documents')
export class DocumentsController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'List uploaded documents for a lead' })
  list(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.verificationService.listDocuments(leadId);
  }

  @Post()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Record an uploaded document for a lead' })
  upload(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.verificationService.uploadDocument(leadId, dto, user.sub);
  }

  @Post(':documentId/download')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiParam({ name: 'documentId', description: 'Document ID', type: Number })
  @ApiOperation({
    summary:
      'Record a document download event with IP and user agent for audit purposes',
  })
  recordDownload(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.verificationService.recordDownload(
      leadId,
      documentId,
      user.sub,
      ip,
      userAgent,
    );
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiParam({ name: 'documentId', description: 'Document ID', type: Number })
  @ApiOperation({
    summary:
      'Soft-delete a document (only while the lead is active and not yet disbursed)',
  })
  remove(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.verificationService.removeDocument(leadId, documentId);
  }
}
