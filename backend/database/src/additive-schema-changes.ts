/**
 * Every change this backend makes to a table that already exists in the legacy
 * database.
 *
 * This is the single declaration behind three things:
 *  1. `check-drift.ts` treats these columns as expected-pending rather than as
 *     mapping mistakes.
 *  2. The additive baseline migration applies them.
 *  3. `docs/APP-SERVER-DB-CHANGES.md` is written from them — the app-server
 *     team's changelist.
 *
 * Rules, enforced by review rather than by code:
 *  - Additions only. No `DROP`, no `RENAME`, no `MODIFY` of a legacy column.
 *  - Every added column is nullable or has a default, so existing legacy PHP
 *    `INSERT`s that do not mention it keep working.
 *  - DDL stays MariaDB-compatible: the production legacy server is MariaDB
 *    11.8.8, so no `utf8mb4_0900_ai_ci` and no `datetime(6)` defaults.
 */

export type AddedColumn = {
  table: string;
  column: string;
  definition: string;
  /** Why this backend needs it, in the app-server team's terms. */
  reason: string;
};

export const ADDED_COLUMNS: AddedColumn[] = [
  {
    table: 'users',
    column: 'user_password_hash',
    definition: 'VARCHAR(255) NULL DEFAULT NULL',
    reason:
      'bcrypt hash for logins through the new CRM. Legacy `users.password` holds MD5 and is left untouched, so the legacy PHP login keeps working unchanged. Nothing on the app-server side needs to read or write this.',
  },
  {
    table: 'company_login',
    column: 'company_active',
    definition: 'TINYINT UNSIGNED NOT NULL DEFAULT 1',
    reason:
      'Active flag. Legacy `company_login` has no active/deleted pair, unlike every other legacy master table; the CRM filters on it.',
  },
  {
    table: 'company_login',
    column: 'company_deleted',
    definition: 'TINYINT UNSIGNED NOT NULL DEFAULT 0',
    reason: 'Soft-delete flag, to match the rest of the legacy master tables.',
  },
  {
    table: 'company_login',
    column: 'company_cin',
    definition: 'VARCHAR(50) NULL DEFAULT NULL',
    reason:
      'Corporate Identification Number, printed on generated CAM documents and sanction letters.',
  },
  {
    table: 'company_login',
    column: 'company_logo_file_key',
    definition: 'VARCHAR(255) NULL DEFAULT NULL',
    reason:
      'Storage key (not a URL) for the company logo used when rendering sanction letters.',
  },
  {
    table: 'tbl_rejection_master',
    column: 'is_deleted',
    definition: 'TINYINT UNSIGNED NOT NULL DEFAULT 0',
    reason:
      'Soft-delete flag. This table predates the legacy `master_*` convention and has an active `status` int but no deleted flag; the CRM filters on both.',
  },
  {
    table: 'tbl_product',
    column: 'product_active',
    definition: 'TINYINT UNSIGNED NOT NULL DEFAULT 1',
    reason:
      'Active flag. Legacy `tbl_product` has no active/deleted pair; the CRM filters on it.',
  },
  {
    table: 'tbl_product',
    column: 'product_deleted',
    definition: 'TINYINT UNSIGNED NOT NULL DEFAULT 0',
    reason: 'Soft-delete flag, to match the rest of the legacy master tables.',
  },
  {
    table: 'lead_customer',
    column: 'spouse_mobile',
    definition: 'VARCHAR(15) NULL DEFAULT NULL',
    reason:
      'Spouse mobile number, captured on the internal lead-edit screen and surfaced across screener/credit/audit/disbursal/collection. Legacy only ever stored it on the app-server-owned `customer_profile` table (joined via `leads.lead_customer_profile_id`), which this rewrite does not adopt — this lets the CRM capture/show it directly instead.',
  },
];

/**
 * The legacy tables that were missing a primary key in at least one real
 * environment. TypeORM requires one, so the additive migration adds
 * `PRIMARY KEY` plus `AUTO_INCREMENT` on the column that already behaves
 * like the key — idempotently (`database/sql-migrations/m1.sql`), since
 * prod/dev and UAT turned out to disagree on which tables already have
 * one (see `tbl_verification` below), so each item checks
 * `information_schema` first and no-ops where it's already there.
 *
 * This is the only structural change made to a pre-existing table and the only
 * item on the changelist that needs app-server sign-off, because adding a
 * primary key fails if duplicate or NULL values exist. Verified safe against
 * the UAT dump — `master_religion` has 7 rows with 7 distinct non-null ids,
 * the other three are empty — but **must be re-verified against
 * production**:
 *
 *   SELECT COUNT(*), COUNT(DISTINCT <column>), SUM(<column> IS NULL) FROM <table>;
 *
 * The `AUTO_INCREMENT` half is technically a `MODIFY` of an existing column,
 * the one place this work departs from additions-only. It changes no stored
 * value and no type — the columns are already the right integer type — it only
 * lets the database assign the next id, which legacy PHP did in application
 * code.
 *
 * `tbl_verification` (2026-08-05): a real prod schema export confirmed
 * prod/dev already have `PRIMARY KEY (verify_id)` with `AUTO_INCREMENT` —
 * briefly removed from this list on that basis, then a real UAT export
 * showed UAT genuinely lacks it, unlike prod/dev. Re-added once
 * `m1.sql`'s primary-key items became idempotent (2026-08-05) — safe to
 * include unconditionally now: no-ops on prod/dev, actually adds it on
 * UAT. Verified end-to-end against real UAT data.
 */
export const ADDED_PRIMARY_KEYS: {
  table: string;
  column: string;
  columnType: string;
}[] = [
  {
    table: 'master_religion',
    column: 'religion_id',
    columnType: 'INT UNSIGNED',
  },
  {
    table: 'tbl_verification',
    column: 'verify_id',
    columnType: 'BIGINT UNSIGNED',
  },
  {
    table: 'api_adjust_logs',
    column: 'ad_log_id',
    columnType: 'BIGINT UNSIGNED',
  },
  {
    table: 'api_java_middleware_logs',
    column: 'middleware_log_id',
    columnType: 'BIGINT UNSIGNED',
  },
];

const addedColumnKeys = new Set(
  ADDED_COLUMNS.map((c) => `${c.table}.${c.column}`.toLowerCase()),
);

export function isAddedColumn(table: string, column: string): boolean {
  return addedColumnKeys.has(`${table}.${column}`.toLowerCase());
}
