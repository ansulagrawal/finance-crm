# Legacy schema map

Every one of the **125** tables in `database/legacy-baseline/legacy-schema.sql` and every one
of the **100** entities in `database/src/entities/` appears in exactly one row below. That
completeness is enforced, not eyeballed — see "Checking this document" at the end.

## The rule this document exists to enforce

This backend runs on the **legacy database itself**. That database is shared with the
customer-facing CodeIgniter install at `old-php-files/api/` (Android, iOS, website,
CollectionApp, ChatBot, inbound vendor webhooks), which reads the same `DB_NAME` and is not
being cut over with the CRM. **59 of the 125 tables are referenced by that install.**

So:

- Entities adopt legacy table and column names. No table is renamed, no column is renamed,
  no column type is changed.
- Migrations are additive only: `CREATE TABLE` for tables in the NEW section,
  `ADD COLUMN` for genuinely absent fields, and the four `ADD PRIMARY KEY` changes listed
  below. Nothing else.
- Foreign-key constraints go on newly created tables only. Legacy has **zero** FKs; adding
  them to a shared table would start rejecting app-server writes that are accepted today.
- Every DDL change reaches the app-server team via `docs/APP-SERVER-DB-CHANGES.md`.

TypeScript property names stay exactly as they are. Only `@Entity`/`@Column` metadata moves,
which is what keeps services, controllers, DTOs and tests out of scope.

## Verdicts

| verdict | meaning |
|---|---|
| `ADOPT` | Entity re-points at an existing legacy table. Usually no DDL at all. |
| `SPLIT` | One legacy table feeds more than one entity. |
| `ADOPT-UNVERIFIED` | The legacy PHP references this table but it is absent from the UAT dump. Confirm against production before cutover; create it only if production also lacks it. |
| `NEW` | No legacy counterpart. We `CREATE TABLE`. |
| `LEGACY-ONLY` | Legacy table with no entity. Left completely alone. |

## Tables needing `ADD PRIMARY KEY`

Four legacy tables have no primary key, and TypeORM requires one. This is the only
structural change this plan makes to a pre-existing table, and it needs app-server sign-off
because it will reject duplicate rows if any exist.

| table | entity |
|---|---|
| `master_religion` | `Religion` |
| `tbl_verification` | `FieldVerificationVisit` |
| `api_adjust_logs` | _entity removed (#146)_ |
| `api_java_middleware_logs` | `MiddlewareApiLog` |

## Primary-key types

Legacy PK types vary and each entity must match its own exactly, or TypeORM will try to
`MODIFY` a live column: `bigint unsigned` ×45, `bigint` ×24, `int unsigned` ×23,
`mediumint unsigned` ×19, `int` ×8. The DataSource needs
`extra: { supportBigNumbers: true, bigNumberStrings: false }` so `bigint` keys come back as
JS numbers — the same fix already proven necessary in `migrate-legacy/legacy-data-source.ts`.

## Mapping

### ADOPT — entity re-points at an existing legacy table (82)

| legacy table | entity | table it uses today | note |
|---|---|---|---|
| `api_account_aggregator_logs` | `AccountAggregatorLog` | `account_aggregator_logs` |  |
| `api_adjust_logs` | _entity removed_ | `adjust_device_logs` | Adjust integration removed (COMPLETED.md #146) — table and rows preserved, nothing writes to it. PK still added by m1.sql |
| `api_bank_account_verification_logs` | `BankVerificationLog` | `bank_verification_logs` |  |
| `api_banking_cart_log` | `BankAnalysisLog` | `bank_analysis_logs` | cart_return_novel_doc_id matches documents.novelReturnDocId |
| `api_callback_upi` | `UpiCallbackLog` | `upi_callback_logs` |  |
| `api_credeau_log` | _entity removed_ | `credeau_logs` | Credeau integration removed (COMPLETED.md #158) — table created by init.sql is preserved, nothing writes to it |
| `api_disburse_logs` | `DisbursementApiLog` | `disbursement_api_logs` |  |
| `api_domain_verification_logs` | `DomainVerificationLog` | `domain_verification_logs` |  |
| `api_ekyc_logs` | `EkycLog` | `ekyc_logs` |  |
| `api_email_logs` | `EmailLog` | `email_logs` |  |
| `api_email_verification_logs` | `EmailVerificationLog` | `email_verification_logs` |  |
| `api_enach_logs` | `EnachLog` | `enach_logs` |  |
| `api_esign_logs` | `EsignLog` | `esign_logs` |  |
| `api_face_match_logs` | `FaceMatchLog` | `face_match_logs` |  |
| `api_java_middleware_logs` | `MiddlewareApiLog` | `middleware_api_logs` | NO PRIMARY KEY - needs ADD PRIMARY KEY |
| `api_poi_verification_logs` | `PoiVerificationLog` | `poi_verification_logs` |  |
| `api_repayment_logs` | `RepaymentLog` | `repayment_logs` |  |
| `api_reverse_geo_code` | `ReverseGeocodeLog` | `reverse_geocode_logs` |  |
| `api_sms_logs` | `SmsLog` | `sms_logs` |  |
| `api_upi_logs` | `UpiCollectionLog` | `upi_collection_logs` |  |
| `api_video_ekyc_logs` | `VideoKycLog` | `video_kyc_logs` |  |
| `cif_customer` | `CifCustomer` | `cif_customers` |  |
| `collection` | `Collection` | `collections` |  |
| `collection_bucket_wise_permission` | `UserCollectionBucketPermission` | `user_collection_bucket_permissions` | cbwp_mcbw_id references master_collection_bucket_wise (absent from dump) |
| `company_holiday` | `CompanyHoliday` | `company_holidays` |  |
| `company_login` | `Company` | `companies` | legacy company master; needs +cin +logoFileKey |
| `credit_analysis_memo` | `CreditAnalysisMemo` | `credit_analysis_memos` |  |
| `customer_api_data` | `VendorApiCache` | `vendor_api_caches` | already documented as the provenance in the entity |
| `customer_banking` | `CustomerBanking` | `customer_bankings` |  |
| `customer_black_list` | `CustomerBlacklist` | `customer_blacklists` |  |
| `customer_employment` | `LeadEmployment` | `lead_employments` |  |
| `docs` | `Document` | `documents` |  |
| `docs_download_logs` | `DocumentDownloadLog` | `document_download_logs` |  |
| `docs_master` | `DocumentType` | `document_types` | 41 legacy rows vs 7 seeded - seed invented a subset |
| `export_access_logs` | `ExportAccessLog` | `export_access_logs` | same name, zero shared column names |
| `lead_bre_rule_result` | `BreRuleResult` | `bre_rule_results` |  |
| `lead_customer_references` | `LeadCustomerReference` | `lead_customer_references` |  |
| `lead_disbursement_trans_log` | `DisbursementTransactionLog` | `disbursement_transaction_logs` |  |
| `lead_followup` | `LeadFollowup` | `lead_followups` |  |
| `legal_email_logs` | `LegalEmailLog` | `legal_email_logs` | same name, zero shared column names |
| `loan` | `Loan` | `loans` |  |
| `loan_collection_followup` | `LoanCollectionFollowup` | `loan_collection_followups` |  |
| `master_bank_account_status` | `BankAccountStatus` | `master_bank_account_status` | no seeded rows anywhere; only id 1 (verified) is code-confirmed, see docs/TODO.md |
| `master_bank_type` | `BankType` | `bank_types` |  |
| `master_blacklist_reject_reason` | `BlacklistReason` | `blacklist_reasons` |  |
| `master_branch` | `Branch` | `branches` |  |
| `master_bre_category` | `BreCategory` | `bre_categories` |  |
| `master_bre_rule` | `BreRule` | `bre_rules` |  |
| `master_city` | `City` | `cities` |  |
| `master_data_source` | `DataSource` | `lead_data_sources` | legacy 35 rows vs seeded 4 |
| `master_disbursement_banks` | `DisbursementBank` | `disbursement_banks` |  |
| `master_export` | `ExportCatalog` | `export_catalogs` | 54 rows both sides |
| `master_feedback_answers` | `FeedbackAnswer` | `feedback_answers` |  |
| `master_feedback_questions` | `FeedbackQuestion` | `feedback_questions` |  |
| `master_followup_status` | `FollowupStatus` | `followup_statuses` |  |
| `master_followup_type` | `FollowupType` | `followup_types` |  |
| `master_lms_menu` | `MenuItem` | `menu_items` | 82 legacy rows vs 0 seeded |
| `master_marital_status` | `MaritalStatus` | `marital_statuses` |  |
| `master_mis_report` | `MisReportCatalog` | `mis_report_catalogs` | 78 rows both sides |
| `master_occupation` | `Occupation` | `occupations` |  |
| `master_payment_mode` | `PaymentMode` | `payment_modes` |  |
| `master_pincode` | `Pincode` | `pincodes` | legacy 19883 rows vs seeded 7922 - seed JSON is a subset, drop it |
| `master_qualification` | `Qualification` | `qualifications` |  |
| `master_religion` | `Religion` | `religions` | NO PRIMARY KEY - needs ADD PRIMARY KEY |
| `master_role_type` | `RoleType` | `role_types` |  |
| `master_sms_template` | `SmsTemplate` | `sms_templates` | 0 seeded rows in the dump; type_id 1 = collection followup templates, not OTP |
| `master_state` | `State` | `states` |  |
| `master_status` | `MasterStatus` | `master_statuses` | status_id/status_name/status_stage/status_order maps 1:1; 38 rows both sides |
| `mis_access_logs` | `MisAccessLog` | `mis_access_logs` | same name, zero shared column names |
| `tbl_cibil_log` | `CrifBureauLog` | `crif_bureau_logs` | api1/2/3 request+response; tbl_cibil is the parsed summary, left alone |
| `tbl_collection_followup` | `LoanCollectionVisit` | `loan_collection_visits` | GPS/visit-shaped: lat/long, visit_address, collection_img |
| `tbl_product` | `Product` | `products` |  |
| `tbl_rejection_master` | `RejectionReason` | `rejection_reasons` | 67 rows both sides |
| `tbl_verification` | `FieldVerificationVisit` | `field_verification_visits` | NO PRIMARY KEY - needs ADD PRIMARY KEY |
| `user_activity_log` | `UserActivityLog` | `user_activity_logs` |  |
| `user_export_permission` | `UserExportPermission` | `user_export_permissions` |  |
| `user_lead_allocation_log` | `UserLeadAllocationLog` | `user_lead_allocation_log` | self-declared daily active/case-type flag, written by the lead-allocation toggle endpoint, read by the Current Bucket Status report |
| `user_mis_permission` | `UserMisPermission` | `user_mis_permissions` |  |
| `user_role_locations` | `UserRoleLocation` | `user_role_locations` | same name, zero shared column names |
| `user_roles` | `UserRole` | `user_roles` | same name, zero shared column names |
| `user_target_allocation_log` | `UserTargetAllocation` | `user_target_allocations` |  |
| `users` | `User` | `users` | same name, 3 shared column names |

### SPLIT — one legacy table feeds more than one entity (3)

| legacy table | entity | table it uses today | note |
|---|---|---|---|
| `address_lat_long_api_logs` | `AddressLatLongLog` | `address_lat_long_logs` | one legacy table feeds AddressLatLongLog and AddressDistanceLog, discriminated by api_name/method_id |
| `lead_customer` | `LeadCustomer` | `lead_customers` |  |
| `leads` | `Lead` | `leads` | legacy 114 cols -> Lead + LeadCustomer + LeadEmployment; use migrate-leads.ts mapping |

### ADOPT-UNVERIFIED — legacy table referenced by the PHP but absent from the dump (11)

| expected legacy table | entity | table it uses today | note |
|---|---|---|---|
| `api_appsflyer_push_events` | _entity removed_ | `appsflyer_push_event_logs` | AppsFlyer integration removed (COMPLETED.md #146) — table created by m1.sql is preserved, nothing writes to it |
| `api_call_campaign_logs` | `CallManagementLog` | `call_management_logs` | absent from the dump; referenced by legacy PHP |
| `api_callback_video_ekyc` | `VideoKycCallbackLog` | `video_kyc_callback_logs` | absent from the dump; already named as the provenance in the entity |
| `api_finbox_device_connect_logs` | _entity removed_ | `api_finbox_device_connect_logs` | Finbox integration removed (COMPLETED.md #146) — table preserved, nothing writes to it |
| `api_finbox_bureauconnect_logs` | _entity removed_ | `api_finbox_bureauconnect_logs` | Finbox integration removed (COMPLETED.md #146) — table preserved, nothing writes to it |
| `api_finbox_bank_connect_logs` | _entity removed_ | `api_finbox_bank_connect_logs` | Finbox integration removed (COMPLETED.md #146) — table preserved, nothing writes to it |
| `lead_audit` | `LeadAudit` | `lead_audits` | absent from the dump; referenced by legacy PHP |
| `master_blacklist_pincode` | `BlacklistedPincode` | `blacklisted_pincodes` | absent from the dump; referenced by legacy PHP |
| `master_collection_bucket_wise` | `CollectionBucket` | `collection_buckets` | absent from the dump; referenced by collection_bucket_wise_permission.cbwp_mcbw_id |
| `master_email_template` | `EmailTemplate` | `master_email_template` | absent from the dump; schema inferred from Collection_Model.php's queries, not confirmed |
| `api_url_shortener_logs` | _entity removed_ | `api_url_shortener_logs` | TinyURL link-shortening removed (COMPLETED.md #146) — table created by m1.sql is preserved, nothing writes to it |

### NEW — no legacy counterpart, we CREATE the table (9 + 1 no longer created)

| table to create | entity | verdict | note |
|---|---|---|---|
| `address_distance_logs` | `AddressDistanceLog` | `NEW-OR-SHARE` | see address_lat_long_api_logs SPLIT note; decide at entity-rewrite time |
| `crm_settings` | `CrmSetting` | `NEW` | runtime-tunable settings incl. cron overrides, layered on top of AWS Secrets Manager -> .env chain; serviceName scopes per-service vs '' shared |
| `customer_feedback_responses` | `CustomerFeedbackResponse` | `NEW` | answers against master_feedback_questions/answers |
| `customer_feedbacks` | `CustomerFeedback` | `NEW` | legacy `feedback` is a support-ticket-shaped table, not the Q&A capture |
| `disbursal_authorised_users` | `DisbursalAuthorisedUser` | `NEW` | named-individual whitelist for the ONLINE (money-moving) disbursal path; replaces legacy's hardcoded `in_array($user_id, array(37, 31, 69, 83, 115))` in payday_disbursement_icici_helper.php:159 |
| `email_validation_logs` | `EmailValidationLog` | `NEW` | distinct from api_email_verification_logs and api_domain_verification_logs |
| `password_reset_requests` | `PasswordResetRequest` | `NEW` | OTP + reset-token flow; no legacy equivalent |
| `refresh_tokens` | `RefreshToken` | `NEW` | JWT refresh-token hashes; legacy used PHP file sessions |
| `uan_verification_logs` | `UanVerificationLog` | `NEW` | no legacy UAN log table; master_providers.type has a UAN member but no log sink |
| ~~`whatsapp_logs`~~ | _entity removed_ | _not created_ | WhatsApp module removed entirely (COMPLETED.md #146), and m1.sql no longer creates this table (2026-08-07, client instruction) — there is no module to write to it. Nothing is dropped by that: it was a NEW table this rewrite invented (`wa_*` columns), never legacy, so an environment that already ran an earlier m1 keeps the empty table it got. Legacy `api_whatsapp_logs` (real prod shape `msg_*`) is LEGACY-ONLY, created by init.sql, and untouched either way |

### LEGACY-ONLY — legacy table with no entity; left completely alone (40)

| legacy table | why it has no entity |
|---|---|
| `callback_logs` | generic inbound webhook sink |
| `cron_logs` | legacy PHP cron; automation-worker does not persist job state |
| `cron_scheduler_logs` | legacy PHP cron, 32514 rows |
| `customer_enquiry` | app-server owned |
| `customer_otp` | app-server owned |
| `customer_profile` | 81 cols, app-server owned (18 refs in api/); LeadCustomer maps to lead_customer instead |
| `export_schedule_log` | scheduled-export delivery log, not ported |
| `feedback` | support-ticket-shaped, distinct from customer_feedbacks |
| `icici_collection_log` | no ported entity |
| `lead_eligibility_rules_result` | BRE eligibility output, no ported entity |
| `lead_journey_events` | app-server owned, 636 refs in api/ |
| `lead_rejection_reasons` | per-lead rejection audit trail, no ported entity |
| `lead_sms_logs` | no ported entity |
| `leads_otp_trans` | app-server owned, 134 refs in api/ |
| `lists_of_masters` | per-company denormalised option lists, not ported |
| `logo` | superseded by companies.logoFileKey |
| `master_api_provider` | vendor config; integrations-api reads credentials from env vars |
| `master_company_type` | lookup, app-server owned (31 refs in api/) |
| `master_credentials` | vendor config; integrations-api reads credentials from env vars |
| `master_department` | lookup, no ported entity |
| `master_designation` | lookup, no ported entity |
| `master_electrical_provider` | lookup, no ported entity |
| `master_enduse` | lookup, app-server owned |
| `master_industry` | lookup, no ported entity |
| `master_journey_stage` | app-server owned, 244 refs in api/ |
| `master_marketing_channel` | lookup, app-server owned |
| `master_providers` | vendor config; integrations-api reads credentials from env vars |
| `master_relation_type` | lookup; LeadCustomerReference.relationType stores the value inline |
| `master_residence_type` | lookup, app-server owned |
| `master_role_wise_buckets` | ftc_menu_ids per role; distinct from collection buckets |
| `master_salary_mode` | lookup, app-server owned |
| `master_services` | vendor config |
| `master_templates` | SMS/WhatsApp/email template store - unblocks the collection followup template picker in docs/TODO.md |
| `master_visit_status` | lookup, no ported entity |
| `mobileapp_login_trans` | app-server owned |
| `support_categories` | support module not ported |
| `support_ticket_logs` | support module not ported |
| `support_tickets` | support module not ported |
| `tbl_bank_details` | 22287-row IFSC reference, app-server owned |
| `tbl_cibil` | parsed bureau summary; CrifBureauLog maps to tbl_cibil_log |

## Column-level mapping

Table-level verdicts are the contract; column-level mapping is derived per entity during the
rewrite and then *proved* by the drift check (below) rather than transcribed here. Two
sources feed it:

- `database/src/migrate-legacy/*.ts` already carries a verified column-level mapping for 23
  tables — `users`, `leads`, `lead_customer`, `customer_employment`, `lead_followup`,
  `lead_customer_references`, `cif_customer`, `credit_analysis_memo`, `lead_bre_rule_result`,
  `loan`, `lead_disbursement_trans_log`, `master_disbursement_banks`, `collection`,
  `tbl_collection_followup`, `loan_collection_followup`, `customer_black_list`,
  `legal_email_logs`, `customer_banking`, `docs`, `docs_download_logs`, `user_roles`,
  `user_role_locations`, `user_activity_log`. Harvest it before deleting that directory.
- `database/legacy-baseline/legacy-schema.sql` for everything else.

### The three cases that need a judgement call, not a lookup

**`leads` / `lead_customer` (SPLIT).** Legacy `leads` has 114 columns and legacy
`lead_customer` has 98; the new model cuts the same data across `Lead`, `LeadCustomer` and
`LeadEmployment`. `migrate-leads.ts` already resolved which column lands where — reuse it.
Note that legacy `customer_profile` (81 columns) holds overlapping data but is app-server
territory; `LeadCustomer` maps to `lead_customer`, not to it.

**`address_lat_long_api_logs` (SPLIT).** One legacy table backs both `AddressLatLongLog` and
`AddressDistanceLog`, distinguished by `api_name` / `method_id` (e.g.
`DIGITAP_API_ADDRESS_DISTANCE` rows are the distance ones). Either point both entities at the
one table, or keep `address_distance_logs` as a new table. Decide during the entity rewrite
and record the outcome here.

**Lookup tables where the seed invented a narrower set than legacy holds.** Adopting the
legacy table means adopting the legacy rows, and several are wider than what
`database/src/seed-data/` currently ships: `master_pincode` 19,883 rows vs `pincodes.json`
7,922; `docs_master` 41 vs `document-types.json` 7; `master_data_source` 35 vs
`data-sources.json` 4; `master_lms_menu` 82 vs 0. The legacy rows win — the app server reads
them. Those JSON files become redundant.

## Notes worth carrying forward

- **`company_login` is the legacy company master.** `docs/COMPLETED.md` records that "the
  legacy schema has no `companies`-style" table; that was based on the name. `company_login`
  has `company_id`, `company_name`, `company_code`, `company_type`, `url`, `address`,
  `company_contact` and audit columns. `Company` adopts it and needs `cin` and `logoFileKey`
  added.
- **`master_templates` unblocks a TODO.** `docs/TODO.md` lists the collection-followup
  template picker as blocked on new template tables plus real template content.
  `master_templates` (`temp_id`, `type_id`, `job_name`, `sms_template_id`, `sms_header`,
  `sms_content`) already exists in legacy. No new tables needed; the content question stands.
- **`master_status` maps 1:1 to `MasterStatus`.** `status_id` / `status_name` / `status_stage`
  / `status_order` line up with `id` / `name` / `stageCode` / `sortOrder`, 38 rows on both
  sides. The entity's doc comment describes it as an invented collapse of
  `leads.status`/`stage`/`lead_status_id`; in practice it is the legacy lookup.
- **`tbl_cibil` vs `tbl_cibil_log`.** `CrifBureauLog` adopts `tbl_cibil_log` (it carries
  `api1`/`api2`/`api3` request and response). `tbl_cibil` is the parsed bureau summary and
  stays untouched.
- **Vendor credential tables stay legacy-only.** `master_providers`, `master_credentials`,
  `master_services`, `master_api_provider` configure vendors in the DB; `integrations-api`
  reads credentials from env vars by design. Left alone.

## Checking this document

The mapping is complete by construction — a script asserts that the set of legacy tables in
`database/legacy-baseline/legacy-schema.sql` and the set of `@Entity(...)` names in
`database/src/entities/` are each fully covered, with no duplicates and no references to
tables that do not exist. Re-run that assertion whenever an entity is added or the baseline
is regenerated.

The real proof that the column-level mapping is right is the **drift check**: run `bun run
check:drift` (`database/src/check-drift.ts`) against a fresh restore of the baseline plus
`database/sql-migrations/`'s additive migrations — it must report zero drift. Any mismatch it
reports is a place where an entity and its legacy table disagree.
