import { type AuthenticatedUser, CurrentUser } from '@finance-crm/common';
import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { sendCsv } from '../../common/csv.util';
import { RequireExportPermission } from '../../common/decorators/require-export-permission.decorator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { CollectionExportsService } from './collection-exports.service';
import { CollectionExportQueryDto } from './dto/collection-export-query.dto';

const EXTRA_COLUMN_ROLES = ['SA', 'CA'];

@ApiTags('Collection Exports')
@ApiCookieAuth()
@Controller('collection-exports')
export class CollectionExportsController {
  constructor(private readonly service: CollectionExportsService) {}

  @Get('loan-closed')
  @ApiOperation({ summary: 'Export closed loans as CSV' })
  @RequireExportPermission(9)
  async loanClosed(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.service.loanClosed(query);
    return sendCsv(res, 'loan-closed.csv', rows);
  }

  @Get('pending-recovery')
  @ApiOperation({ summary: 'Export loans pending recovery as CSV' })
  @RequireExportPermission(10)
  async pendingRecovery(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.service.pendingRecovery(query);
    return sendCsv(res, 'pending-recovery.csv', rows);
  }

  @Get('collection')
  @ApiOperation({
    summary:
      'Export collection activity as CSV, with optional borrower contact columns for SA/CA roles',
  })
  @RequireExportPermission(11)
  async collection(
    @Query() query: CollectionExportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const includeContactDetails =
      query.includeContactDetails === 'true' &&
      user.roles.some((role) => EXTRA_COLUMN_ROLES.includes(role));
    const rows = await this.service.collection(query, includeContactDetails);
    return sendCsv(res, 'collection.csv', rows);
  }

  @Get('total-recovery')
  @ApiOperation({ summary: 'Export total recovery amounts as CSV' })
  @RequireExportPermission(12)
  async totalRecovery(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.service.totalRecovery(query);
    return sendCsv(res, 'total-recovery.csv', rows);
  }

  @Get('pre-collection')
  @ApiOperation({
    summary: 'Export pre-collection (pre-due) loan cases as CSV',
  })
  @RequireExportPermission(21)
  async preCollection(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.service.preCollection(query);
    return sendCsv(res, 'pre-collection.csv', rows);
  }

  @Get('pending-collection-verification')
  @ApiOperation({
    summary: 'Export cases pending collection verification as CSV',
  })
  @RequireExportPermission(22)
  async pendingCollectionVerification(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.service.pendingCollectionVerification(query);
    return sendCsv(res, 'pending-collection-verification.csv', rows);
  }

  @Get('legal-data')
  @ApiOperation({ summary: 'Export legal action case data as CSV' })
  @RequireExportPermission(23)
  async legalData(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.service.legalData(query);
    return sendCsv(res, 'legal-data.csv', rows);
  }

  @Get('outstanding-data')
  @ApiOperation({ summary: 'Export outstanding loan balance data as CSV' })
  @RequireExportPermission(29)
  async outstandingData(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.service.outstandingData(query);
    return sendCsv(res, 'outstanding-data.csv', rows);
  }

  @Get('loan-pool')
  @ApiOperation({ summary: 'Export loan pool (portfolio) data as CSV' })
  @RequireExportPermission(30)
  async loanPool(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.service.loanPool(query);
    return sendCsv(res, 'loan-pool.csv', rows);
  }

  @Get('follow-up')
  @ApiOperation({ summary: 'Export collection follow-up activity as CSV' })
  @RequireExportPermission(31)
  async followUp(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.service.followUp(query);
    return sendCsv(res, 'follow-up.csv', rows);
  }

  @Get('payment-rejected')
  @ApiOperation({ summary: 'Export rejected repayment transactions as CSV' })
  @RequireExportPermission(32)
  async paymentRejected(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.service.paymentRejected(query);
    return sendCsv(res, 'payment-rejected.csv', rows);
  }

  @Get('suspense-verified')
  @ApiOperation({
    summary: 'Export verified suspense (unallocated payment) entries as CSV',
  })
  @RequireExportPermission(35)
  async suspenseVerified(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.service.suspenseVerified(query);
    return sendCsv(res, 'suspense-verified.csv', rows);
  }

  @Get('new-collection-report')
  @ApiOperation({ summary: 'Export new collection report as CSV' })
  @RequireExportPermission(38)
  async newCollectionReport(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.service.newCollectionReport(query);
    return sendCsv(res, 'new-collection-report.csv', rows);
  }

  @Get('legal-notice-sent-log')
  @ApiOperation({
    summary: 'Export log of legal notices sent to borrowers as CSV',
  })
  @RequireExportPermission(44)
  async legalNoticeSentLog(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.service.legalNoticeSentLog(query);
    return sendCsv(res, 'legal-notice-sent-log.csv', rows);
  }
}
