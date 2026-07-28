-- database/sql-migrations/m1.sql
--
-- Brings ANY starting database forward to match this backend's current
-- @finance-crm/database entities: additive columns on existing legacy tables,
-- four legacy-table primary keys, and CREATE TABLE for every NEW/
-- ADOPT-UNVERIFIED table (see docs/SCHEMA-MAP.md). Additions only — no
-- DROP, no RENAME, no MODIFY of a legacy column's data (the four ADD
-- PRIMARY KEY items are the one exception, and change no stored value or
-- type). Every added column here is nullable or has a default, so
-- existing legacy PHP INSERTs that don't mention it keep working.
--
-- tbl_verification's primary key is included even though prod/dev already
-- have it (confirmed against a real schema export) — idempotency (below)
-- means it safely no-ops there, while still fixing environments (UAT,
-- confirmed) that are missing it. Don't remove it again for prod/dev's
-- sake; that's exactly the gap this file's idempotency exists to close.
--
-- Every item is idempotent — safe to run against a database that already
-- has some or all of it (e.g. prod/dev already have some columns/tables
-- a less-current environment like UAT doesn't yet), and safe to re-run.
-- Real MySQL (prod is 8.0.45) does NOT support the `ADD COLUMN IF NOT
-- EXISTS` shorthand (confirmed: it's MariaDB-only, fails with a syntax
-- error on real MySQL) — so every ADD COLUMN/ADD PRIMARY KEY/ADD
-- CONSTRAINT item below checks information_schema itself and builds the
-- real statement as dynamic SQL (SET/PREPARE/EXECUTE/DEALLOCATE) only
-- when the target is actually missing. CREATE TABLE IF NOT EXISTS is
-- native and portable, no dynamic SQL needed there.
--
-- Each item is one blank-line-separated block, led by a `-- TARGET: ...`
-- comment the runner (database/src/run-sql-migrations.ts) parses to know
-- what to check — required for every block, don't drop it even though
-- it looks like documentation. Run via `bun run migrate` (defaults to
-- this file) or `bun run migrate --m1`, or paste directly into
-- phpMyAdmin/any MySQL client (the TARGET comments are inert there,
-- just comments). m1.down.sql is this file's exact block-for-block
-- reverse, in reverse order, each equally idempotent — see that file's
-- header before adding a new mN.sql/mN.down.sql pair.
--
-- The last three blocks were a separate m2.sql (the OTP attempt counter,
-- 2026-08-06) and a proposed m3 (`disbursal_authorised_users`, 2026-08-07);
-- both were folded back in here so there stays exactly ONE migration file
-- for an operator to run. That is only safe because every block is
-- idempotent: an environment that already ran an earlier m1 just re-runs it
-- and no-ops on everything it already has.

-- TARGET: COLUMN users.user_password_hash
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'user_password_hash');
SET @sql := IF(@exists = 0, 'ALTER TABLE `users` ADD `user_password_hash` VARCHAR(255) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stmt1 FROM @sql;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

-- TARGET: COLUMN company_login.company_active
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'company_login' AND column_name = 'company_active');
SET @sql := IF(@exists = 0, 'ALTER TABLE `company_login` ADD `company_active` TINYINT UNSIGNED NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt2 FROM @sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- TARGET: COLUMN company_login.company_deleted
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'company_login' AND column_name = 'company_deleted');
SET @sql := IF(@exists = 0, 'ALTER TABLE `company_login` ADD `company_deleted` TINYINT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt3 FROM @sql;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- TARGET: COLUMN company_login.company_cin
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'company_login' AND column_name = 'company_cin');
SET @sql := IF(@exists = 0, 'ALTER TABLE `company_login` ADD `company_cin` VARCHAR(50) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stmt4 FROM @sql;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;

-- TARGET: COLUMN company_login.company_logo_file_key
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'company_login' AND column_name = 'company_logo_file_key');
SET @sql := IF(@exists = 0, 'ALTER TABLE `company_login` ADD `company_logo_file_key` VARCHAR(255) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stmt5 FROM @sql;
EXECUTE stmt5;
DEALLOCATE PREPARE stmt5;

-- TARGET: COLUMN tbl_rejection_master.is_deleted
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'tbl_rejection_master' AND column_name = 'is_deleted');
SET @sql := IF(@exists = 0, 'ALTER TABLE `tbl_rejection_master` ADD `is_deleted` TINYINT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt6 FROM @sql;
EXECUTE stmt6;
DEALLOCATE PREPARE stmt6;

-- TARGET: COLUMN tbl_product.product_active
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'tbl_product' AND column_name = 'product_active');
SET @sql := IF(@exists = 0, 'ALTER TABLE `tbl_product` ADD `product_active` TINYINT UNSIGNED NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt7 FROM @sql;
EXECUTE stmt7;
DEALLOCATE PREPARE stmt7;

-- TARGET: COLUMN tbl_product.product_deleted
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'tbl_product' AND column_name = 'product_deleted');
SET @sql := IF(@exists = 0, 'ALTER TABLE `tbl_product` ADD `product_deleted` TINYINT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt8 FROM @sql;
EXECUTE stmt8;
DEALLOCATE PREPARE stmt8;

-- TARGET: COLUMN lead_customer.spouse_mobile
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'lead_customer' AND column_name = 'spouse_mobile');
SET @sql := IF(@exists = 0, 'ALTER TABLE `lead_customer` ADD `spouse_mobile` VARCHAR(15) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stmt9 FROM @sql;
EXECUTE stmt9;
DEALLOCATE PREPARE stmt9;

-- TARGET: PRIMARY_KEY master_religion
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'master_religion' AND constraint_type = 'PRIMARY KEY');
SET @sql := IF(@exists = 0, 'ALTER TABLE `master_religion` MODIFY `religion_id` INT UNSIGNED NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (`religion_id`)', 'SELECT 1');
PREPARE stmt10 FROM @sql;
EXECUTE stmt10;
DEALLOCATE PREPARE stmt10;

-- TARGET: PRIMARY_KEY tbl_verification
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'tbl_verification' AND constraint_type = 'PRIMARY KEY');
SET @sql := IF(@exists = 0, 'ALTER TABLE `tbl_verification` MODIFY `verify_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (`verify_id`)', 'SELECT 1');
PREPARE stmt15 FROM @sql;
EXECUTE stmt15;
DEALLOCATE PREPARE stmt15;

-- TARGET: PRIMARY_KEY api_adjust_logs
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'api_adjust_logs' AND constraint_type = 'PRIMARY KEY');
SET @sql := IF(@exists = 0, 'ALTER TABLE `api_adjust_logs` MODIFY `ad_log_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (`ad_log_id`)', 'SELECT 1');
PREPARE stmt11 FROM @sql;
EXECUTE stmt11;
DEALLOCATE PREPARE stmt11;

-- TARGET: PRIMARY_KEY api_java_middleware_logs
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'api_java_middleware_logs' AND constraint_type = 'PRIMARY KEY');
SET @sql := IF(@exists = 0, 'ALTER TABLE `api_java_middleware_logs` MODIFY `middleware_log_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (`middleware_log_id`)', 'SELECT 1');
PREPARE stmt12 FROM @sql;
EXECUTE stmt12;
DEALLOCATE PREPARE stmt12;

-- TARGET: TABLE password_reset_requests
CREATE TABLE IF NOT EXISTS `password_reset_requests` (`id` int NOT NULL AUTO_INCREMENT, `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, `isActive` tinyint NOT NULL DEFAULT 1, `isDeleted` tinyint NOT NULL DEFAULT 0, `otpHash` varchar(255) NOT NULL, `otpExpiresAt` datetime NOT NULL, `verifiedAt` datetime NULL, `resetTokenHash` varchar(255) NULL, `resetTokenExpiresAt` datetime NULL, `consumedAt` datetime NULL, `userId` bigint UNSIGNED NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB;

-- TARGET: TABLE refresh_tokens
CREATE TABLE IF NOT EXISTS `refresh_tokens` (`id` int NOT NULL AUTO_INCREMENT, `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, `isActive` tinyint NOT NULL DEFAULT 1, `isDeleted` tinyint NOT NULL DEFAULT 0, `tokenHash` varchar(255) NOT NULL, `expiresAt` datetime NOT NULL, `revokedAt` datetime NULL, `userId` bigint UNSIGNED NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB;

-- TARGET: CONSTRAINT password_reset_requests.FK_91edfdb7662932426087df8df4d
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'password_reset_requests' AND constraint_name = 'FK_91edfdb7662932426087df8df4d');
SET @sql := IF(@exists = 0, 'ALTER TABLE `password_reset_requests` ADD CONSTRAINT `FK_91edfdb7662932426087df8df4d` FOREIGN KEY (`userId`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt13 FROM @sql;
EXECUTE stmt13;
DEALLOCATE PREPARE stmt13;

-- TARGET: CONSTRAINT refresh_tokens.FK_610102b60fea1455310ccd299de
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'refresh_tokens' AND constraint_name = 'FK_610102b60fea1455310ccd299de');
SET @sql := IF(@exists = 0, 'ALTER TABLE `refresh_tokens` ADD CONSTRAINT `FK_610102b60fea1455310ccd299de` FOREIGN KEY (`userId`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt14 FROM @sql;
EXECUTE stmt14;
DEALLOCATE PREPARE stmt14;

-- TARGET: TABLE customer_feedbacks
CREATE TABLE IF NOT EXISTS `customer_feedbacks` (`id` int NOT NULL AUTO_INCREMENT, `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, `isActive` tinyint NOT NULL DEFAULT 1, `isDeleted` tinyint NOT NULL DEFAULT 0, `customerName` varchar(150) NULL, `email` varchar(150) NULL, `mobile` varchar(20) NULL, `remarks` text NULL, `leadId` bigint UNSIGNED NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB;

-- TARGET: TABLE customer_feedback_responses
CREATE TABLE IF NOT EXISTS `customer_feedback_responses` (`id` int NOT NULL AUTO_INCREMENT, `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, `isActive` tinyint NOT NULL DEFAULT 1, `isDeleted` tinyint NOT NULL DEFAULT 0, `feedbackId` int NULL, `questionId` int UNSIGNED NULL, `answerId` int UNSIGNED NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB;

-- TARGET: TABLE email_validation_logs
CREATE TABLE IF NOT EXISTS `email_validation_logs` (`id` int NOT NULL AUTO_INCREMENT, `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, `isActive` tinyint NOT NULL DEFAULT 1, `isDeleted` tinyint NOT NULL DEFAULT 0, `emailType` tinyint NOT NULL, `email` varchar(150) NOT NULL, `provider` varchar(20) NOT NULL DEFAULT 'sendgrid', `isValid` tinyint NOT NULL DEFAULT 0, `verdict` varchar(50) NULL, `request` text NULL, `response` text NULL, `status` enum ('0', '1', '2', '3', '4') NOT NULL DEFAULT '0', `errors` varchar(500) NULL, `requestedAt` datetime NULL, `respondedAt` datetime NULL, `leadId` bigint UNSIGNED NULL, `userId` bigint UNSIGNED NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB;

-- TARGET: TABLE uan_verification_logs
CREATE TABLE IF NOT EXISTS `uan_verification_logs` (`id` int NOT NULL AUTO_INCREMENT, `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, `isActive` tinyint NOT NULL DEFAULT 1, `isDeleted` tinyint NOT NULL DEFAULT 0, `pancard` varchar(20) NULL, `request` text NULL, `response` longtext NULL, `uanFound` tinyint NOT NULL DEFAULT 0, `uanNumbers` varchar(255) NULL, `employerName` varchar(255) NULL, `status` enum ('0', '1', '2', '3', '4') NOT NULL DEFAULT '0', `errors` varchar(500) NULL, `requestedAt` datetime NULL, `respondedAt` datetime NULL, `leadId` bigint UNSIGNED NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB;

-- TARGET: TABLE lead_audit
CREATE TABLE IF NOT EXISTS `lead_audit` (`id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, `audit_lead_id` bigint UNSIGNED NOT NULL, `audit_assign_user_id` int UNSIGNED NULL, `audit_user_id` int UNSIGNED NULL, `audit_assign_date_time` datetime NULL, `audit_lead_status_id` int UNSIGNED NULL, `audit_case_type_id` tinyint UNSIGNED NULL, `audit_status` varchar(255) NULL, `audit_remarks` text NULL, `audit_created_on` datetime NULL, `audit_active` tinyint UNSIGNED NOT NULL DEFAULT 1, `audit_deleted` tinyint UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (`id`)) ENGINE=InnoDB;

-- TARGET: TABLE master_blacklist_pincode
CREATE TABLE IF NOT EXISTS `master_blacklist_pincode` (`mbp_id` int UNSIGNED NOT NULL AUTO_INCREMENT, `mbp_pincode` mediumint UNSIGNED NOT NULL, `mbp_publish_by` bigint UNSIGNED NULL, `mbp_created_on` datetime NULL, `mbp_updated_on` datetime NULL, `mbp_active` tinyint UNSIGNED NOT NULL DEFAULT 1, `mbp_deleted` tinyint UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (`mbp_id`)) ENGINE=InnoDB;

-- TARGET: TABLE master_collection_bucket_wise
CREATE TABLE IF NOT EXISTS `master_collection_bucket_wise` (`mcbw_id` int UNSIGNED NOT NULL AUTO_INCREMENT, `mcbw_name` varchar(150) NOT NULL, `mcbw_start` int NOT NULL, `mcbw_end` int NOT NULL, `mcbw_active` tinyint UNSIGNED NOT NULL DEFAULT 1, `mcbw_deleted` tinyint UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (`mcbw_id`)) ENGINE=InnoDB;

-- TARGET: TABLE api_appsflyer_push_events
CREATE TABLE IF NOT EXISTS `api_appsflyer_push_events` (`aape_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, `aape_lead_id` bigint UNSIGNED NOT NULL, `aape_profile_id` varchar(150) NULL, `aape_appsflyer_id` varchar(150) NOT NULL, `aape_app_id` varchar(100) NULL, `aape_event_name` varchar(50) NOT NULL, `aape_data_source_id` mediumint UNSIGNED NULL, `aape_utm_source` varchar(150) NULL, `aape_utm_medium` varchar(150) NULL, `aape_utm_campaign` varchar(150) NULL, `aape_utm_term` varchar(150) NULL, `aape_request` text NULL, `aape_response` longtext NULL, `aape_api_status_id` mediumint UNSIGNED NOT NULL, `aape_errors` varchar(500) NULL, `aape_request_datetime` datetime NULL, `aape_response_datetime` datetime NULL, `aape_active` tinyint UNSIGNED NOT NULL DEFAULT 1, `aape_deleted` tinyint UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (`aape_id`)) ENGINE=InnoDB;

-- TARGET: TABLE api_call_campaign_logs
CREATE TABLE IF NOT EXISTS `api_call_campaign_logs` (`id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, `call_campaign_name` varchar(255) NULL, `call_campaign_method_id` tinyint NULL, `call_campaign_status_id` mediumint NULL, `call_campaign_request` text NULL, `call_campaign_response` text NULL, `call_campaign_errors` varchar(500) NULL, `call_campaign_request_datetime` datetime NULL, `call_campaign_response_datetime` datetime NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB;

-- TARGET: TABLE api_finbox_device_connect_logs
CREATE TABLE IF NOT EXISTS `api_finbox_device_connect_logs` (`finbox_dc_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, `finbox_dc_lead_id` bigint UNSIGNED NULL, `finbox_dc_user_id` bigint UNSIGNED NULL, `finbox_dc_provider_id` tinyint UNSIGNED NOT NULL, `finbox_dc_method_id` tinyint NOT NULL, `finbox_dc_request` text NULL, `finbox_dc_response` text NULL, `finbox_dc_api_status_id` mediumint UNSIGNED NOT NULL, `finbox_dc_errors` varchar(500) NULL, `finbox_dc_request_datetime` datetime NULL, `finbox_dc_response_datetime` datetime NULL, `finbox_dc_active` tinyint UNSIGNED NOT NULL DEFAULT 1, `finbox_dc_deleted` tinyint UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (`finbox_dc_id`)) ENGINE=InnoDB;

-- TARGET: TABLE api_callback_video_ekyc
CREATE TABLE IF NOT EXISTS `api_callback_video_ekyc` (`acvk_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, `acvk_lead_id` bigint UNSIGNED NULL, `acvk_method_id` tinyint NOT NULL, `acvk_request_id` varchar(255) NOT NULL, `acvk_response` text NOT NULL, `acvk_status` varchar(50) NOT NULL, `acvk_errors` varchar(500) NULL, `acvk_response_datetime` datetime NOT NULL, PRIMARY KEY (`acvk_id`)) ENGINE=InnoDB;

-- TARGET: TABLE api_url_shortener_logs
CREATE TABLE IF NOT EXISTS `api_url_shortener_logs` (`us_log_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, `us_provider_id` tinyint UNSIGNED NOT NULL, `us_method_id` tinyint UNSIGNED NOT NULL, `us_lead_id` bigint UNSIGNED NULL, `us_request` text NULL, `us_response` text NULL, `us_url` varchar(1000) NULL, `us_short_url` varchar(255) NULL, `us_api_status_id` mediumint UNSIGNED NOT NULL, `us_errors` varchar(500) NULL, `us_request_datetime` datetime NULL, `us_response_datetime` datetime NULL, `us_user_id` int UNSIGNED NULL, PRIMARY KEY (`us_log_id`)) ENGINE=InnoDB;

-- TARGET: TABLE crm_settings
CREATE TABLE IF NOT EXISTS `crm_settings` (`id` int NOT NULL AUTO_INCREMENT, `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, `isActive` tinyint NOT NULL DEFAULT 1, `isDeleted` tinyint NOT NULL DEFAULT 0, `serviceName` varchar(50) NOT NULL DEFAULT '', `settingKey` varchar(150) NOT NULL, `settingValue` text NOT NULL, UNIQUE INDEX `IDX_crm_settings_service_key` (`serviceName`, `settingKey`), PRIMARY KEY (`id`)) ENGINE=InnoDB;

-- TARGET: TRIGGER before_insert_collection_bucket_wise_permission
-- Confirmed present in real prod/dev (byte-identical), absent from real
-- UAT — same class of cross-environment gap as tbl_verification's
-- primary key above. Can't use the PREPARE/EXECUTE pattern here: real
-- MySQL's prepared-statement protocol explicitly rejects CREATE TRIGGER
-- ("not supported in the prepared statement protocol yet", confirmed).
-- DROP-then-CREATE reaches the same idempotent end state without it.
DROP TRIGGER IF EXISTS `before_insert_collection_bucket_wise_permission`;
DELIMITER $$
CREATE TRIGGER `before_insert_collection_bucket_wise_permission` BEFORE INSERT ON `collection_bucket_wise_permission` FOR EACH ROW BEGIN
   IF NEW.cbwp_ip_address IS NULL OR NEW.cbwp_ip_address = '' THEN
      SET NEW.cbwp_ip_address = SUBSTRING_INDEX(USER(), '@', -1);
   END IF;
END
$$
DELIMITER ;

-- TARGET: COLUMN password_reset_requests.otpAttemptCount
-- Security-review follow-up (2026-08-06), folded in from the former m2.sql:
-- a wrong-guess counter so `AuthService.verifyPasswordResetOtp` can hard-cap
-- brute force against a 6-digit OTP instead of allowing unlimited guesses
-- inside the OTP's 10-minute validity window.
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'password_reset_requests' AND column_name = 'otpAttemptCount');
SET @sql := IF(@exists = 0, 'ALTER TABLE `password_reset_requests` ADD `otpAttemptCount` INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt16 FROM @sql;
EXECUTE stmt16;
DEALLOCATE PREPARE stmt16;

-- TARGET: TABLE disbursal_authorised_users
-- The named-individual whitelist for the money-moving ONLINE disbursal path
-- (2026-08-07). Legacy hardcoded it as `in_array($user_id, array(37, 31, 69,
-- 83, 115))` in `payday_disbursement_icici_helper.php:159`; the port checks
-- this table instead, on top of (not instead of) the route's role guard.
-- See `DisbursalAuthorisedUser`'s doc comment and docs/TODO.md.
--
-- Created EMPTY on purpose. No row means nobody can disburse online, which
-- is the correct fail-closed default for a money path — the client names the
-- real people (the legacy five are legacy user-ids and must be confirmed,
-- not assumed to still be the right humans).
CREATE TABLE IF NOT EXISTS `disbursal_authorised_users` (`id` int NOT NULL AUTO_INCREMENT, `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, `isActive` tinyint NOT NULL DEFAULT 1, `isDeleted` tinyint NOT NULL DEFAULT 0, `userId` bigint UNSIGNED NOT NULL, `grantedById` bigint UNSIGNED NULL, UNIQUE INDEX `IDX_disbursal_authorised_users_userId` (`userId`), PRIMARY KEY (`id`)) ENGINE=InnoDB;

-- TARGET: CONSTRAINT disbursal_authorised_users.FK_disbursal_authorised_users_userId
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'disbursal_authorised_users' AND constraint_name = 'FK_disbursal_authorised_users_userId');
SET @sql := IF(@exists = 0, 'ALTER TABLE `disbursal_authorised_users` ADD CONSTRAINT `FK_disbursal_authorised_users_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION', 'SELECT 1');
PREPARE stmt17 FROM @sql;
EXECUTE stmt17;
DEALLOCATE PREPARE stmt17;

-- TARGET: AUTO_INCREMENT master_bre_category.m_bre_cat_id
-- init.sql's phpMyAdmin-style export carries an "AUTO_INCREMENT for table"
-- ALTER block for every other table with a generated single-column PK
-- (e.g. `master_bre_rule`, its immediate neighbor in that section) but is
-- missing this one's entirely — an export/copy-paste gap in the source
-- file itself, present in every environment that ever ran it, not
-- something one database drifted into. Confirmed live, 2026-08-12: every
-- attempt to create a new BRE category 500'd, since `@PrimaryGeneratedColumn`
-- relies on the database generating the id. The column is already the
-- table's PRIMARY KEY, so a plain MODIFY is enough — MySQL sets the
-- AUTO_INCREMENT counter to MAX(id)+1 automatically when the attribute is
-- added to a populated table.
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'master_bre_category' AND column_name = 'm_bre_cat_id' AND EXTRA LIKE '%auto_increment%');
SET @sql := IF(@exists = 0, 'ALTER TABLE `master_bre_category` MODIFY `m_bre_cat_id` INT UNSIGNED NOT NULL AUTO_INCREMENT', 'SELECT 1');
PREPARE stmt18 FROM @sql;
EXECUTE stmt18;
DEALLOCATE PREPARE stmt18;

-- TARGET: AUTO_INCREMENT master_visit_status.m_visit_id
-- Same export gap as `master_bre_category` above, found by scanning every
-- numeric single-column PRIMARY KEY in the live schema for a missing
-- AUTO_INCREMENT rather than assuming this was the only one. This table
-- has no current @finance-crm/database entity (unmapped legacy table), so nothing
-- in the app writes to it today — fixed anyway since it's the same root
-- cause in the same migration file.
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'master_visit_status' AND column_name = 'm_visit_id' AND EXTRA LIKE '%auto_increment%');
SET @sql := IF(@exists = 0, 'ALTER TABLE `master_visit_status` MODIFY `m_visit_id` INT UNSIGNED NOT NULL AUTO_INCREMENT', 'SELECT 1');
PREPARE stmt19 FROM @sql;
EXECUTE stmt19;
DEALLOCATE PREPARE stmt19;
