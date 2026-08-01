import { Roles } from '@finance-crm/common';
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { LeadImportService } from './lead-import.service';

@ApiTags('Leads')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('leads/import')
export class LeadImportController {
  constructor(private readonly leadImportService: LeadImportService) {}

  @Get('sample-csv')
  @ApiOperation({
    summary: 'Download a sample CSV template for bulk lead import',
  })
  sampleCsv(@Res() res: Response): void {
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="lead-import-sample.csv"',
    });
    res.send(this.leadImportService.sampleCsv());
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Bulk-import leads from a CSV file (name, mobile required; email, pan, pincode optional)',
  })
  // multer's default `limits.fileSize` is unbounded and Nest buffers the
  // whole upload in memory, so without a cap a single request could exhaust
  // the process heap. 5MB is far more than a lead-import CSV needs (the
  // sample template is a handful of columns) while leaving plenty of room
  // for a large real batch. The mimetype filter is a convenience check, not
  // a trust boundary — the parser below validates the actual content.
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      fileFilter: (_req, uploaded, callback) => {
        const isCsv =
          uploaded.mimetype === 'text/csv' ||
          uploaded.mimetype === 'application/vnd.ms-excel' ||
          uploaded.mimetype === 'text/plain' ||
          uploaded.originalname.toLowerCase().endsWith('.csv');
        callback(
          isCsv ? null : new BadRequestException('Expected a CSV file'),
          isCsv,
        );
      },
    }),
  )
  async importCsv(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded — expected a multipart field named "file"',
      );
    }
    return this.leadImportService.importCsv(file.buffer.toString('utf-8'));
  }
}
