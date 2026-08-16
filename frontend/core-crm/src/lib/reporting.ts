import { ApiError, apiFetch, apiUrl } from '@/lib/api';

/** `reporting-api`, routed through the gateway at `/api/v1/reporting/*`
 * (confirmed via `backend/gateway/nginx.conf`'s `location /api/v1/reporting/`
 * block, proxying to the `reporting-api` upstream). Every endpoint here is a
 * raw-SQL read (`DataSource.query(...)`) returning a plain array of row
 * objects — reports/exports are rendered generically (columns derived from
 * the first row) rather than with per-report typed shapes, since there are
 * ~60 report + ~40 export endpoints across 10 modules.
 *
 * Unlike every other domain in this app, access here isn't role-gated —
 * it's the real legacy `master_mis_report`/`master_export` permission model
 * (`user_mis_permission`/`user_export_permission`, numeric ids), enforced by
 * `MisPermissionGuard`/`ExportPermissionGuard`. `SA`/`CA` always pass; any
 * other user needs an explicit per-report/per-export grant — the same grant
 * shell already built at `/menu-permissions` (`ExportPermissionsCard`/
 * `MisPermissionsCard`), keyed by the exact `permissionId` values below. So
 * this page is NOT gated to `SA`/`CA` client-side; anyone can see the
 * catalog, and a 403 from an ungranted report surfaces as a toast, same as
 * legacy's model of "the permission check IS the gate."
 */

export type ReportFilterKind =
  | 'dateRange'
  | 'month'
  | 'financialYear'
  | 'executiveCollection'
  | 'fromDate'
  | 'toDate'
  | 'date'
  | 'none'
  | 'collectionExport';

export type ReportDefinition = {
  /** Unique across both reports and exports, used as the catalog key. */
  key: string;
  label: string;
  /** Display grouping, matches the backend module name. */
  module: string;
  kind: 'report' | 'export';
  /** Path segment appended to `/api/v1/reporting/`. */
  path: string;
  filter: ReportFilterKind;
  /** The legacy `master_mis_report.report_id` / `master_export.export_id`
   * this endpoint is gated behind — `null` for the two endpoints that have
   * no legacy DB row and are left ungated (see backend TODO.md). */
  permissionId: number | null;
};

const dr = (filter: ReportFilterKind = 'dateRange') => filter;

export const REPORTS: ReportDefinition[] = [
  // --- credit-reports ---
  {
    key: 'credit-reports/sanction-tat',
    label: 'Sanction TAT',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/sanction-tat',
    filter: dr(),
    permissionId: 2,
  },
  {
    key: 'credit-reports/total-sanction',
    label: 'Total Sanction',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/total-sanction',
    filter: dr(),
    permissionId: 3,
  },
  {
    key: 'credit-reports/sanction-kpi',
    label: 'Sanction KPI',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/sanction-kpi',
    filter: 'month',
    permissionId: 4,
  },
  {
    key: 'credit-reports/outstanding-sanction-cases',
    label: 'Outstanding Sanction Cases',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/outstanding-sanction-cases',
    filter: 'month',
    permissionId: 9,
  },
  {
    key: 'credit-reports/user-type-outstanding',
    label: 'User-type Outstanding',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/user-type-outstanding',
    filter: 'none',
    permissionId: 11,
  },
  {
    key: 'credit-reports/lead-status-sanction-wise-new',
    label: 'Lead Status by Sanction (New)',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/lead-status-sanction-wise-new',
    filter: dr(),
    permissionId: 25,
  },
  {
    key: 'credit-reports/lead-status-sanction-wise-repeat',
    label: 'Lead Status by Sanction (Repeat)',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/lead-status-sanction-wise-repeat',
    filter: dr(),
    permissionId: 26,
  },
  {
    key: 'credit-reports/outstanding-sanction-amount',
    label: 'Outstanding Sanction Amount',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/outstanding-sanction-amount',
    filter: 'month',
    permissionId: 29,
  },
  {
    key: 'credit-reports/outstanding-cases-date-range',
    label: 'Outstanding Cases (Date Range)',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/outstanding-cases-date-range',
    filter: dr(),
    permissionId: 36,
  },
  {
    key: 'credit-reports/sanction-executive-ta',
    label: 'Sanction Executive TA',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/sanction-executive-ta',
    filter: 'month',
    permissionId: 38,
  },
  {
    key: 'credit-reports/sanction-executive-achievement',
    label: 'Sanction Executive Achievement',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/sanction-executive-achievement',
    filter: 'month',
    permissionId: 45,
  },
  {
    key: 'credit-reports/lead-status-sanction-wise-repeat-new',
    label: 'Lead Status by Sanction (Repeat, Revised)',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/lead-status-sanction-wise-repeat-new',
    filter: dr(),
    permissionId: 71,
  },
  {
    key: 'credit-reports/sanction-status-wise-detailed',
    label: 'Sanction Status Detailed',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/sanction-status-wise-detailed',
    filter: dr(),
    permissionId: 76,
  },
  {
    key: 'credit-reports/bucket-wise-sanction-executive',
    label: 'Bucket-wise Sanction Executive',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/bucket-wise-sanction-executive',
    filter: dr(),
    permissionId: 83,
  },
  {
    key: 'credit-reports/process-tat',
    label: 'Process TAT',
    module: 'Credit',
    kind: 'report',
    path: 'credit-reports/process-tat',
    filter: 'fromDate',
    permissionId: 80,
  },

  // --- disbursal-reports ---
  {
    key: 'disbursal-reports/disbursal-summary',
    label: 'Disbursal Summary',
    module: 'Disbursal',
    kind: 'report',
    path: 'disbursal-reports/disbursal-summary',
    filter: 'month',
    permissionId: 6,
  },
  {
    key: 'disbursal-reports/monthly-disbursal',
    label: 'Monthly Disbursal',
    module: 'Disbursal',
    kind: 'report',
    path: 'disbursal-reports/monthly-disbursal',
    filter: 'month',
    permissionId: 14,
  },
  {
    key: 'disbursal-reports/hourly-disbursal',
    label: 'Hourly Disbursal',
    module: 'Disbursal',
    kind: 'report',
    path: 'disbursal-reports/hourly-disbursal',
    filter: dr(),
    permissionId: 15,
  },
  {
    key: 'disbursal-reports/fy-disbursement-collection',
    label: 'FY Disbursement vs Collection',
    module: 'Disbursal',
    kind: 'report',
    path: 'disbursal-reports/fy-disbursement-collection',
    filter: 'month',
    permissionId: 34,
  },
  {
    key: 'disbursal-reports/hourly-loan-disbursal-by-executive',
    label: 'Hourly Loan Disbursal by Executive',
    module: 'Disbursal',
    kind: 'report',
    path: 'disbursal-reports/hourly-loan-disbursal-by-executive',
    filter: dr(),
    permissionId: 57,
  },
  {
    key: 'disbursal-reports/disbursal-date-wise',
    label: 'Disbursal Date-wise',
    module: 'Disbursal',
    kind: 'report',
    path: 'disbursal-reports/disbursal-date-wise',
    filter: dr(),
    permissionId: 70,
  },
  {
    key: 'disbursal-reports/disbursal-executive-wise',
    label: 'Disbursal Executive-wise',
    module: 'Disbursal',
    kind: 'report',
    path: 'disbursal-reports/disbursal-executive-wise',
    filter: dr(),
    permissionId: 72,
  },
  {
    key: 'disbursal-reports/disbursal-executive-ta',
    label: 'Disbursal Executive TA',
    module: 'Disbursal',
    kind: 'report',
    path: 'disbursal-reports/disbursal-executive-ta',
    filter: dr(),
    permissionId: 84,
  },

  // --- lead-reports ---
  {
    key: 'lead-reports/lead-source',
    label: 'Lead Source',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/lead-source',
    filter: dr(),
    permissionId: 1,
  },
  {
    key: 'lead-reports/lead-source-status',
    label: 'Lead Source Status',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/lead-source-status',
    filter: dr(),
    permissionId: 8,
  },
  {
    key: 'lead-reports/sanction-productivity-fresh',
    label: 'Sanction Productivity (Fresh)',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/sanction-productivity-fresh',
    filter: 'toDate',
    permissionId: 18,
  },
  {
    key: 'lead-reports/sanction-productivity-repeat',
    label: 'Sanction Productivity (Repeat)',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/sanction-productivity-repeat',
    filter: 'toDate',
    permissionId: 19,
  },
  {
    key: 'lead-reports/hourly-status-wise',
    label: 'Hourly Status-wise',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/hourly-status-wise',
    filter: dr(),
    permissionId: 27,
  },
  {
    key: 'lead-reports/lead-utm-source-status',
    label: 'Lead UTM Source Status',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/lead-utm-source-status',
    filter: dr(),
    permissionId: 28,
  },
  {
    key: 'lead-reports/lead-sourcing-city-wise-status',
    label: 'Lead Sourcing City-wise Status',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/lead-sourcing-city-wise-status',
    filter: dr(),
    permissionId: 31,
  },
  {
    key: 'lead-reports/lead-city-wise-status',
    label: 'Lead City-wise Status',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/lead-city-wise-status',
    filter: dr(),
    permissionId: 32,
  },
  {
    key: 'lead-reports/rejection-analysis',
    label: 'Rejection Analysis',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/rejection-analysis',
    filter: dr(),
    permissionId: 49,
  },
  {
    key: 'lead-reports/lead-utm-campaign-status',
    label: 'Lead UTM Campaign Status',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/lead-utm-campaign-status',
    filter: dr(),
    permissionId: 50,
  },
  {
    key: 'lead-reports/lead-assignment-summary',
    label: 'Lead Assignment Summary',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/lead-assignment-summary',
    filter: 'none',
    permissionId: 51,
  },
  {
    key: 'lead-reports/source-utm-source-status',
    label: 'Source / UTM Source Status',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/source-utm-source-status',
    filter: dr(),
    permissionId: 52,
  },
  {
    key: 'lead-reports/lead-rejection-analysis-campaign',
    label: 'Lead Rejection Analysis by Campaign',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/lead-rejection-analysis-campaign',
    filter: dr(),
    permissionId: 53,
  },
  {
    key: 'lead-reports/system-rejected-status',
    label: 'System-rejected Status',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/system-rejected-status',
    filter: dr(),
    permissionId: 74,
  },
  {
    key: 'lead-reports/lead-conversion',
    label: 'Lead Conversion',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/lead-conversion',
    filter: dr(),
    permissionId: 75,
  },
  {
    key: 'lead-reports/lead-digital-summary',
    label: 'Lead Digital Summary',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/lead-digital-summary',
    filter: dr(),
    permissionId: 81,
  },
  {
    key: 'lead-reports/process-tat',
    label: 'Process TAT',
    module: 'Leads',
    kind: 'report',
    path: 'lead-reports/process-tat',
    filter: 'fromDate',
    permissionId: null,
  },

  // --- collection-reports ---
  {
    key: 'collection-reports/collection-percentage-by-executive',
    label: 'Collection % by Executive',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/collection-percentage-by-executive',
    filter: dr(),
    permissionId: 5,
  },
  {
    key: 'collection-reports/monthwise-pending-collection',
    label: 'Monthwise Pending Collection',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/monthwise-pending-collection',
    filter: 'none',
    permissionId: 7,
  },
  {
    key: 'collection-reports/collection-calls-by-time',
    label: 'Collection Calls by Time',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/collection-calls-by-time',
    filter: dr(),
    permissionId: 10,
  },
  {
    key: 'collection-reports/collection-calls-by-status',
    label: 'Collection Calls by Status',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/collection-calls-by-status',
    filter: dr(),
    permissionId: 12,
  },
  {
    key: 'collection-reports/monthly-collection-detail',
    label: 'Monthly Collection Detail',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/monthly-collection-detail',
    filter: 'month',
    permissionId: 13,
  },
  {
    key: 'collection-reports/payment-analysis-by-disbursal-month',
    label: 'Payment Analysis by Disbursal Month',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/payment-analysis-by-disbursal-month',
    filter: 'financialYear',
    permissionId: 21,
  },
  {
    key: 'collection-reports/pre-collection-by-month',
    label: 'Pre-collection by Month',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/pre-collection-by-month',
    filter: 'month',
    permissionId: 22,
  },
  {
    key: 'collection-reports/collection-by-month',
    label: 'Collection by Month',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/collection-by-month',
    filter: 'month',
    permissionId: 23,
  },
  {
    key: 'collection-reports/recovery-by-month',
    label: 'Recovery by Month',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/recovery-by-month',
    filter: 'month',
    permissionId: 24,
  },
  {
    key: 'collection-reports/collection-bucket-case-wise',
    label: 'Collection Bucket Case-wise',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/collection-bucket-case-wise',
    filter: dr(),
    permissionId: 30,
  },
  {
    key: 'collection-reports/fy-repayment-collection',
    label: 'FY Repayment Collection',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/fy-repayment-collection',
    filter: 'financialYear',
    permissionId: 35,
  },
  {
    key: 'collection-reports/collection-by-collection-executive',
    label: 'Collection by Collection Executive',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/collection-by-collection-executive',
    filter: 'executiveCollection',
    permissionId: 39,
  },
  {
    key: 'collection-reports/collection-by-sanction-executive',
    label: 'Collection by Sanction Executive',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/collection-by-sanction-executive',
    filter: 'executiveCollection',
    permissionId: 41,
  },
  {
    key: 'collection-reports/collection-by-branch',
    label: 'Collection by Branch',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/collection-by-branch',
    filter: 'executiveCollection',
    permissionId: 43,
  },
  {
    key: 'collection-reports/collection-bucket-case-wise-amount',
    label: 'Collection Bucket Case-wise (Amount)',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/collection-bucket-case-wise-amount',
    filter: dr(),
    permissionId: 47,
  },
  {
    key: 'collection-reports/hourly-collection',
    label: 'Hourly Collection',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/hourly-collection',
    filter: dr(),
    permissionId: 48,
  },
  {
    key: 'collection-reports/sanction-wise-lead-conversion',
    label: 'Sanction-wise Lead Conversion',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/sanction-wise-lead-conversion',
    filter: 'date',
    permissionId: 55,
  },
  {
    key: 'collection-reports/current-bucket-status',
    label: 'Current Bucket Status',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/current-bucket-status',
    filter: 'none',
    permissionId: 73,
  },
  {
    key: 'collection-reports/collection-approval-hour',
    label: 'Collection Approval Hour',
    module: 'Collection',
    kind: 'report',
    path: 'collection-reports/collection-approval-hour',
    filter: dr(),
    permissionId: 85,
  },

  // --- field-visit-reports ---
  {
    key: 'field-visit-reports/branchwise-visit',
    label: 'Branchwise Visit',
    module: 'Field Visit',
    kind: 'report',
    path: 'field-visit-reports/branchwise-visit',
    filter: dr(),
    permissionId: 16,
  },
  {
    key: 'field-visit-reports/rmwise-visit',
    label: 'RM-wise Visit',
    module: 'Field Visit',
    kind: 'report',
    path: 'field-visit-reports/rmwise-visit',
    filter: dr(),
    permissionId: 17,
  },
  {
    key: 'field-visit-reports/rm-conveyance',
    label: 'RM Conveyance',
    module: 'Field Visit',
    kind: 'report',
    path: 'field-visit-reports/rm-conveyance',
    filter: dr(),
    permissionId: 20,
  },
];

export const EXPORTS: ReportDefinition[] = [
  // --- credit-exports ---
  {
    key: 'credit-exports/total-sanction',
    label: 'Total Sanction',
    module: 'Credit',
    kind: 'export',
    path: 'credit-exports/total-sanction',
    filter: dr(),
    permissionId: 5,
  },
  {
    key: 'credit-exports/total-approved-sanction',
    label: 'Total Approved Sanction',
    module: 'Credit',
    kind: 'export',
    path: 'credit-exports/total-approved-sanction',
    filter: dr(),
    permissionId: 40,
  },
  {
    key: 'credit-exports/bre-rules-result',
    label: 'BRE Rules Result',
    module: 'Credit',
    kind: 'export',
    path: 'credit-exports/bre-rules-result',
    filter: dr(),
    permissionId: 41,
  },
  {
    key: 'credit-exports/cibil-report',
    label: 'CIBIL Report',
    module: 'Credit',
    kind: 'export',
    path: 'credit-exports/cibil-report',
    filter: dr(),
    permissionId: 16,
  },
  {
    key: 'credit-exports/blacklisted',
    label: 'Blacklisted',
    module: 'Credit',
    kind: 'export',
    path: 'credit-exports/blacklisted',
    filter: dr(),
    permissionId: 20,
  },
  {
    key: 'credit-exports/loan-waived',
    label: 'Loan Waived',
    module: 'Credit',
    kind: 'export',
    path: 'credit-exports/loan-waived',
    filter: dr(),
    permissionId: 27,
  },

  // --- disbursal-exports ---
  {
    key: 'disbursal-exports/loan-disbursed',
    label: 'Loan Disbursed',
    module: 'Disbursal',
    kind: 'export',
    path: 'disbursal-exports/loan-disbursed',
    filter: dr(),
    permissionId: 7,
  },
  {
    key: 'disbursal-exports/loan-pending',
    label: 'Loan Pending NEFT',
    module: 'Disbursal',
    kind: 'export',
    path: 'disbursal-exports/loan-pending',
    filter: dr(),
    permissionId: 8,
  },
  {
    key: 'disbursal-exports/loan-disbursed-sendback',
    label: 'Loan Disbursed Sendback',
    module: 'Disbursal',
    kind: 'export',
    path: 'disbursal-exports/loan-disbursed-sendback',
    filter: dr(),
    permissionId: 18,
  },
  {
    key: 'disbursal-exports/loan-disbursed-hold',
    label: 'Loan Disbursed Hold',
    module: 'Disbursal',
    kind: 'export',
    path: 'disbursal-exports/loan-disbursed-hold',
    filter: dr(),
    permissionId: 19,
  },
  {
    key: 'disbursal-exports/new-loan-disbursed',
    label: 'New Loan Disbursed',
    module: 'Disbursal',
    kind: 'export',
    path: 'disbursal-exports/new-loan-disbursed',
    filter: dr(),
    permissionId: 37,
  },
  {
    key: 'disbursal-exports/loan-dump',
    label: 'Loan Dump',
    module: 'Disbursal',
    kind: 'export',
    path: 'disbursal-exports/loan-dump',
    filter: dr(),
    permissionId: 39,
  },
  {
    key: 'disbursal-exports/master-disbursal-report',
    label: 'Master Disbursal Report',
    module: 'Disbursal',
    kind: 'export',
    path: 'disbursal-exports/master-disbursal-report',
    filter: dr(),
    permissionId: 45,
  },
  {
    key: 'disbursal-exports/disbursal-account-report',
    label: 'Disbursal Account Report',
    module: 'Disbursal',
    kind: 'export',
    path: 'disbursal-exports/disbursal-account-report',
    filter: dr(),
    permissionId: 46,
  },
  {
    key: 'disbursal-exports/closed-loan',
    label: 'Closed Loan',
    module: 'Disbursal',
    kind: 'export',
    path: 'disbursal-exports/closed-loan',
    filter: dr(),
    permissionId: 48,
  },

  // --- lead-exports ---
  {
    key: 'lead-exports/lead-duplicate',
    label: 'Lead Duplicate',
    module: 'Leads',
    kind: 'export',
    path: 'lead-exports/lead-duplicate',
    filter: dr(),
    permissionId: 1,
  },
  {
    key: 'lead-exports/lead-total',
    label: 'Lead Total',
    module: 'Leads',
    kind: 'export',
    path: 'lead-exports/lead-total',
    filter: dr(),
    permissionId: 3,
  },
  {
    key: 'lead-exports/lead-rejected',
    label: 'Lead Rejected',
    module: 'Leads',
    kind: 'export',
    path: 'lead-exports/lead-rejected',
    filter: dr(),
    permissionId: 4,
  },
  {
    key: 'lead-exports/partial-lead-data',
    label: 'Partial Lead Data',
    module: 'Leads',
    kind: 'export',
    path: 'lead-exports/partial-lead-data',
    filter: dr(),
    permissionId: 43,
  },
  {
    key: 'lead-exports/lead-interaction-summary',
    label: 'Lead Interaction Summary',
    module: 'Leads',
    kind: 'export',
    path: 'lead-exports/lead-interaction-summary',
    filter: dr(),
    permissionId: 52,
  },

  // --- collection-exports ---
  {
    key: 'collection-exports/loan-closed',
    label: 'Loan Closed',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/loan-closed',
    filter: dr(),
    permissionId: 9,
  },
  {
    key: 'collection-exports/pending-recovery',
    label: 'Pending Recovery',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/pending-recovery',
    filter: dr(),
    permissionId: 10,
  },
  {
    key: 'collection-exports/collection',
    label: 'Collection',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/collection',
    filter: 'collectionExport',
    permissionId: 11,
  },
  {
    key: 'collection-exports/total-recovery',
    label: 'Total Recovery',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/total-recovery',
    filter: dr(),
    permissionId: 12,
  },
  {
    key: 'collection-exports/pre-collection',
    label: 'Pre-collection',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/pre-collection',
    filter: dr(),
    permissionId: 21,
  },
  {
    key: 'collection-exports/pending-collection-verification',
    label: 'Pending Collection Verification',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/pending-collection-verification',
    filter: dr(),
    permissionId: 22,
  },
  {
    key: 'collection-exports/legal-data',
    label: 'Legal Data',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/legal-data',
    filter: dr(),
    permissionId: 23,
  },
  {
    key: 'collection-exports/outstanding-data',
    label: 'Outstanding Data',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/outstanding-data',
    filter: dr(),
    permissionId: 29,
  },
  {
    key: 'collection-exports/loan-pool',
    label: 'Loan Pool',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/loan-pool',
    filter: dr(),
    permissionId: 30,
  },
  {
    key: 'collection-exports/follow-up',
    label: 'Follow-up',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/follow-up',
    filter: dr(),
    permissionId: 31,
  },
  {
    key: 'collection-exports/payment-rejected',
    label: 'Payment Rejected',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/payment-rejected',
    filter: dr(),
    permissionId: 32,
  },
  {
    key: 'collection-exports/suspense-verified',
    label: 'Suspense Verified',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/suspense-verified',
    filter: dr(),
    permissionId: 35,
  },
  {
    key: 'collection-exports/new-collection-report',
    label: 'New Collection Report',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/new-collection-report',
    filter: dr(),
    permissionId: 38,
  },
  {
    key: 'collection-exports/legal-notice-sent-log',
    label: 'Legal Notice Sent Log',
    module: 'Collection',
    kind: 'export',
    path: 'collection-exports/legal-notice-sent-log',
    filter: dr(),
    permissionId: 44,
  },

  // --- financial-exports ---
  {
    key: 'financial-exports/ac-report',
    label: 'AC Report',
    module: 'Financial',
    kind: 'export',
    path: 'financial-exports/ac-report',
    filter: dr(),
    permissionId: 13,
  },
  {
    key: 'financial-exports/tally',
    label: 'Tally Export',
    module: 'Financial',
    kind: 'export',
    path: 'financial-exports/tally',
    filter: dr(),
    permissionId: 15,
  },
  {
    key: 'financial-exports/audit-tat',
    label: 'Audit TAT',
    module: 'Financial',
    kind: 'export',
    path: 'financial-exports/audit-tat',
    filter: dr(),
    permissionId: 47,
  },
  {
    key: 'financial-exports/reloan-tat',
    label: 'Reloan TAT',
    module: 'Financial',
    kind: 'export',
    path: 'financial-exports/reloan-tat',
    filter: 'none',
    permissionId: 49,
  },
  {
    key: 'financial-exports/low-conversion-tat',
    label: 'Low Conversion TAT',
    module: 'Financial',
    kind: 'export',
    path: 'financial-exports/low-conversion-tat',
    filter: dr(),
    permissionId: 50,
  },
  {
    key: 'financial-exports/high-conversion-tat',
    label: 'High Conversion TAT',
    module: 'Financial',
    kind: 'export',
    path: 'financial-exports/high-conversion-tat',
    filter: dr(),
    permissionId: 51,
  },
  {
    key: 'financial-exports/dashboard-data',
    label: 'Dashboard Data',
    module: 'Financial',
    kind: 'export',
    path: 'financial-exports/dashboard-data',
    filter: dr(),
    permissionId: 6,
  },
];

export const REPORT_CATALOG: ReportDefinition[] = [...REPORTS, ...EXPORTS];

export type ReportRunParams = {
  fromDate?: string;
  toDate?: string;
  month?: string;
  financialYearStart?: string;
  typeId?: 1 | 2;
  date?: string;
  includeContactDetails?: boolean;
  /** Free-form extra query params for the handful of endpoints with an
   * optional filter this catalog doesn't model structurally (e.g.
   * `utmSource`, `utmCampaign`). */
  extra?: Record<string, string>;
};

function buildQueryString(params: ReportRunParams): string {
  const search = new URLSearchParams();
  if (params.fromDate) search.set('fromDate', params.fromDate);
  if (params.toDate) search.set('toDate', params.toDate);
  if (params.month) search.set('month', params.month);
  if (params.financialYearStart) {
    search.set('financialYearStart', params.financialYearStart);
  }
  if (params.typeId) search.set('typeId', String(params.typeId));
  if (params.date) search.set('date', params.date);
  if (params.includeContactDetails) {
    search.set('includeContactDetails', 'true');
  }
  if (params.extra) {
    for (const [key, value] of Object.entries(params.extra)) {
      if (value) search.set(key, value);
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Row shape is intentionally untyped — every report/export here is a raw
 * SQL read whose column set is report-specific; callers build table columns
 * from the returned rows' own keys. */
export type ReportRow = Record<string, unknown>;

export function runReport(
  def: ReportDefinition,
  params: ReportRunParams = {},
): Promise<ReportRow[]> {
  return apiFetch<ReportRow[]>(
    `/api/v1/reporting/${def.path}${buildQueryString(params)}`,
  );
}

/** Export endpoints stream a CSV response, not JSON — can't go through
 * `apiFetch` (which always does `response.json()`). Downloads the file
 * directly via a plain `fetch` + object URL, mirroring `apiFetch`'s
 * cookie-auth (`credentials: 'include'`) and error-message shape, but
 * without the 401-refresh-retry loop `apiFetch` has (acceptable for a
 * manual download click — a expired session here just surfaces as a
 * "Session expired" toast instead of a silent retry). */
export async function downloadReportCsv(
  def: ReportDefinition,
  params: ReportRunParams = {},
): Promise<void> {
  const path = `/api/v1/reporting/${def.path}${buildQueryString(params)}`;
  const response = await fetch(apiUrl(path), { credentials: 'include' });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message ?? 'Export failed. Please try again.');
    throw new ApiError(message, response.status);
  }

  const disposition = response.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? `${def.path.replace(/\//g, '-')}.csv`;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
