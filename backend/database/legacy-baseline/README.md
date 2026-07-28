# Legacy schema baseline

`legacy-schema.sql` is the **structure of the live legacy CRM database**, with all data
stripped. It is the reference every entity mapping and every migration in this repo is
checked against.

## Why this exists

The legacy database is not something we migrate *away* from — it is the database this
backend runs on. It is shared with the customer-facing CodeIgniter install at
`old-php-files/api/`, which serves the Android app, the iOS app, the public website,
CollectionApp and a set of inbound vendor webhooks. Both installs read the same `DB_NAME`
(`old-php-files/api/application/config/database.php` vs
`old-php-files/application/config/database.php`), and the app-server side is not being
cut over with the CRM.

So this file defines what we may not break. See `docs/SCHEMA-MAP.md` for the
table-by-table mapping onto our entities, and `docs/APP-SERVER-DB-CHANGES.md` for the
changelist handed to the app-server team.

## Provenance

| | |
|---|---|
| Source dump | `legacy_finance-crm.sql`, phpMyAdmin 5.2.2 export |
| Taken | 2026-08-01 |
| Server | MariaDB 11.8.8-log, PHP 7.2.34 |
| Tables | 125 |
| Columns | 2,071 |
| Auto-increment PKs | 119 (`bigint unsigned` ×45, `bigint` ×24, `int unsigned` ×23, `mediumint unsigned` ×19, `int` ×8) |
| Tables with no primary key | 4 — `api_adjust_logs`, `api_java_middleware_logs`, `master_religion`, `tbl_verification` |
| Foreign keys / views / triggers | 0 / 0 / 0 |
| Collations | mixed: `latin1_swedish_ci`, `utf8mb4_general_ci`, `utf8mb4_unicode_ci`, `utf8mb4_0900_ai_ci` |

Data was stripped by dropping every `INSERT INTO` statement; nothing else was altered, so
the DDL is byte-for-byte as MariaDB emitted it. Verified by importing this file into a
scratch schema and diffing `information_schema.columns` against the restored dump — the
column signatures are identical.

## Known gap

The legacy PHP references **164** table names; this dump has 125. The 69 absent from it
include tables that are demonstrably live on the app-server side —
`customer_profile_details` (470 references in `old-php-files/api/`),
`profile_journey_events`, `api_callback_video_ekyc`, `api_callback_trackier`,
`api_callback_runo_service`, `api_dialler_callbacks`, `api_whatsapp_logs`,
`api_finbox_bureauconnect_logs`, `api_finbox_device_connect_logs`, `blacklisted_pan`,
`lead_audit`, `loan_collection_visit`, `master_email_template`,
`master_collection_bucket_wise`, `user_collection_allocation_log`. Others in that set are
plainly dead (`student`, `media`, `countries`, `tbl_old_data`, `website_blog*`).

This dump is a UAT export, so it is not proof either way. Treat those 69 as unmapped.

## Regenerating before production cutover

This file **must** be regenerated from production before any migration is run against the
production database, and `docs/SCHEMA-MAP.md` extended to cover whatever the diff reveals.

```bash
mysqldump --no-data --routines --triggers -h <prod-host> -u <user> -p <db> \
  > database/legacy-baseline/legacy-schema.sql
```

Also capture the inventory, so dead tables can be told apart from live ones:

```sql
SELECT table_name, engine, table_collation, table_rows
FROM information_schema.tables WHERE table_schema = '<db>' ORDER BY table_name;
```

And check `SHOW VARIABLES LIKE 'lower_case_table_names'` — the legacy schema contains
`Contact_Enquiry` and `tbl_customerEmployeeDetails`, which resolve differently on Linux
and macOS servers.
