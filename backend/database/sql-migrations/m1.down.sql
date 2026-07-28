-- database/sql-migrations/m1.down.sql
--
-- Exact block-for-block reverse of m1.sql, in reverse order — same rule
-- as before (this file must have exactly as many blocks as m1.sql, in
-- exactly reversed order) for the runner's best-effort revert-on-failure
-- to work. Also idempotent, same reasoning as m1.sql: only drops a
-- column/table/key/constraint if it currently exists, so re-running this
-- file (or the runner invoking a slice of it during a partial revert)
-- never errors on "doesn't exist". Uses a distinct `dstmt<N>` prepared-
-- statement naming namespace from m1.sql's `stmt<N>` so a leaked prepared
-- statement from a failed up-block (its own DEALLOCATE never runs if
-- EXECUTE itself is what failed) can never collide with a down-block's
-- name on the same connection during revert.

-- TARGET: AUTO_INCREMENT master_visit_status.m_visit_id
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'master_visit_status' AND column_name = 'm_visit_id' AND EXTRA LIKE '%auto_increment%');
SET @sql := IF(@exists = 1, 'ALTER TABLE `master_visit_status` MODIFY `m_visit_id` INT UNSIGNED NOT NULL', 'SELECT 1');
PREPARE dstmt18 FROM @sql;
EXECUTE dstmt18;
DEALLOCATE PREPARE dstmt18;

-- TARGET: AUTO_INCREMENT master_bre_category.m_bre_cat_id
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'master_bre_category' AND column_name = 'm_bre_cat_id' AND EXTRA LIKE '%auto_increment%');
SET @sql := IF(@exists = 1, 'ALTER TABLE `master_bre_category` MODIFY `m_bre_cat_id` INT UNSIGNED NOT NULL', 'SELECT 1');
PREPARE dstmt19 FROM @sql;
EXECUTE dstmt19;
DEALLOCATE PREPARE dstmt19;

-- TARGET: CONSTRAINT disbursal_authorised_users.FK_disbursal_authorised_users_userId
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'disbursal_authorised_users' AND constraint_name = 'FK_disbursal_authorised_users_userId');
SET @sql := IF(@exists = 1, 'ALTER TABLE `disbursal_authorised_users` DROP FOREIGN KEY `FK_disbursal_authorised_users_userId`', 'SELECT 1');
PREPARE dstmt16 FROM @sql;
EXECUTE dstmt16;
DEALLOCATE PREPARE dstmt16;

-- TARGET: TABLE disbursal_authorised_users
DROP TABLE IF EXISTS `disbursal_authorised_users`;

-- TARGET: COLUMN password_reset_requests.otpAttemptCount
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'password_reset_requests' AND column_name = 'otpAttemptCount');
SET @sql := IF(@exists = 1, 'ALTER TABLE `password_reset_requests` DROP COLUMN `otpAttemptCount`', 'SELECT 1');
PREPARE dstmt17 FROM @sql;
EXECUTE dstmt17;
DEALLOCATE PREPARE dstmt17;

-- TARGET: TRIGGER before_insert_collection_bucket_wise_permission
DROP TRIGGER IF EXISTS `before_insert_collection_bucket_wise_permission`;

-- TARGET: TABLE crm_settings
DROP TABLE IF EXISTS `crm_settings`;

-- TARGET: TABLE api_url_shortener_logs
DROP TABLE IF EXISTS `api_url_shortener_logs`;

-- TARGET: TABLE api_callback_video_ekyc
DROP TABLE IF EXISTS `api_callback_video_ekyc`;

-- TARGET: TABLE api_finbox_device_connect_logs
DROP TABLE IF EXISTS `api_finbox_device_connect_logs`;

-- TARGET: TABLE api_call_campaign_logs
DROP TABLE IF EXISTS `api_call_campaign_logs`;

-- TARGET: TABLE api_appsflyer_push_events
DROP TABLE IF EXISTS `api_appsflyer_push_events`;

-- TARGET: TABLE master_collection_bucket_wise
DROP TABLE IF EXISTS `master_collection_bucket_wise`;

-- TARGET: TABLE master_blacklist_pincode
DROP TABLE IF EXISTS `master_blacklist_pincode`;

-- TARGET: TABLE lead_audit
DROP TABLE IF EXISTS `lead_audit`;

-- TARGET: TABLE uan_verification_logs
DROP TABLE IF EXISTS `uan_verification_logs`;

-- TARGET: TABLE email_validation_logs
DROP TABLE IF EXISTS `email_validation_logs`;

-- TARGET: TABLE customer_feedback_responses
DROP TABLE IF EXISTS `customer_feedback_responses`;

-- TARGET: TABLE customer_feedbacks
DROP TABLE IF EXISTS `customer_feedbacks`;

-- TARGET: CONSTRAINT refresh_tokens.FK_610102b60fea1455310ccd299de
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'refresh_tokens' AND constraint_name = 'FK_610102b60fea1455310ccd299de');
SET @sql := IF(@exists = 1, 'ALTER TABLE `refresh_tokens` DROP FOREIGN KEY `FK_610102b60fea1455310ccd299de`', 'SELECT 1');
PREPARE dstmt1 FROM @sql;
EXECUTE dstmt1;
DEALLOCATE PREPARE dstmt1;

-- TARGET: CONSTRAINT password_reset_requests.FK_91edfdb7662932426087df8df4d
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'password_reset_requests' AND constraint_name = 'FK_91edfdb7662932426087df8df4d');
SET @sql := IF(@exists = 1, 'ALTER TABLE `password_reset_requests` DROP FOREIGN KEY `FK_91edfdb7662932426087df8df4d`', 'SELECT 1');
PREPARE dstmt2 FROM @sql;
EXECUTE dstmt2;
DEALLOCATE PREPARE dstmt2;

-- TARGET: TABLE refresh_tokens
DROP TABLE IF EXISTS `refresh_tokens`;

-- TARGET: TABLE password_reset_requests
DROP TABLE IF EXISTS `password_reset_requests`;

-- TARGET: PRIMARY_KEY api_java_middleware_logs
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'api_java_middleware_logs' AND constraint_type = 'PRIMARY KEY');
SET @sql := IF(@exists = 1, 'ALTER TABLE `api_java_middleware_logs` DROP PRIMARY KEY, MODIFY `middleware_log_id` BIGINT UNSIGNED NOT NULL', 'SELECT 1');
PREPARE dstmt3 FROM @sql;
EXECUTE dstmt3;
DEALLOCATE PREPARE dstmt3;

-- TARGET: PRIMARY_KEY api_adjust_logs
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'api_adjust_logs' AND constraint_type = 'PRIMARY KEY');
SET @sql := IF(@exists = 1, 'ALTER TABLE `api_adjust_logs` DROP PRIMARY KEY, MODIFY `ad_log_id` BIGINT UNSIGNED NOT NULL', 'SELECT 1');
PREPARE dstmt4 FROM @sql;
EXECUTE dstmt4;
DEALLOCATE PREPARE dstmt4;

-- TARGET: PRIMARY_KEY tbl_verification
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'tbl_verification' AND constraint_type = 'PRIMARY KEY');
SET @sql := IF(@exists = 1, 'ALTER TABLE `tbl_verification` DROP PRIMARY KEY, MODIFY `verify_id` BIGINT UNSIGNED NOT NULL', 'SELECT 1');
PREPARE dstmt15 FROM @sql;
EXECUTE dstmt15;
DEALLOCATE PREPARE dstmt15;

-- TARGET: PRIMARY_KEY master_religion
SET @exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'master_religion' AND constraint_type = 'PRIMARY KEY');
SET @sql := IF(@exists = 1, 'ALTER TABLE `master_religion` DROP PRIMARY KEY, MODIFY `religion_id` INT UNSIGNED NOT NULL', 'SELECT 1');
PREPARE dstmt5 FROM @sql;
EXECUTE dstmt5;
DEALLOCATE PREPARE dstmt5;

-- TARGET: COLUMN lead_customer.spouse_mobile
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'lead_customer' AND column_name = 'spouse_mobile');
SET @sql := IF(@exists = 1, 'ALTER TABLE `lead_customer` DROP COLUMN `spouse_mobile`', 'SELECT 1');
PREPARE dstmt6 FROM @sql;
EXECUTE dstmt6;
DEALLOCATE PREPARE dstmt6;

-- TARGET: COLUMN tbl_product.product_deleted
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'tbl_product' AND column_name = 'product_deleted');
SET @sql := IF(@exists = 1, 'ALTER TABLE `tbl_product` DROP COLUMN `product_deleted`', 'SELECT 1');
PREPARE dstmt7 FROM @sql;
EXECUTE dstmt7;
DEALLOCATE PREPARE dstmt7;

-- TARGET: COLUMN tbl_product.product_active
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'tbl_product' AND column_name = 'product_active');
SET @sql := IF(@exists = 1, 'ALTER TABLE `tbl_product` DROP COLUMN `product_active`', 'SELECT 1');
PREPARE dstmt8 FROM @sql;
EXECUTE dstmt8;
DEALLOCATE PREPARE dstmt8;

-- TARGET: COLUMN tbl_rejection_master.is_deleted
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'tbl_rejection_master' AND column_name = 'is_deleted');
SET @sql := IF(@exists = 1, 'ALTER TABLE `tbl_rejection_master` DROP COLUMN `is_deleted`', 'SELECT 1');
PREPARE dstmt9 FROM @sql;
EXECUTE dstmt9;
DEALLOCATE PREPARE dstmt9;

-- TARGET: COLUMN company_login.company_logo_file_key
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'company_login' AND column_name = 'company_logo_file_key');
SET @sql := IF(@exists = 1, 'ALTER TABLE `company_login` DROP COLUMN `company_logo_file_key`', 'SELECT 1');
PREPARE dstmt10 FROM @sql;
EXECUTE dstmt10;
DEALLOCATE PREPARE dstmt10;

-- TARGET: COLUMN company_login.company_cin
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'company_login' AND column_name = 'company_cin');
SET @sql := IF(@exists = 1, 'ALTER TABLE `company_login` DROP COLUMN `company_cin`', 'SELECT 1');
PREPARE dstmt11 FROM @sql;
EXECUTE dstmt11;
DEALLOCATE PREPARE dstmt11;

-- TARGET: COLUMN company_login.company_deleted
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'company_login' AND column_name = 'company_deleted');
SET @sql := IF(@exists = 1, 'ALTER TABLE `company_login` DROP COLUMN `company_deleted`', 'SELECT 1');
PREPARE dstmt12 FROM @sql;
EXECUTE dstmt12;
DEALLOCATE PREPARE dstmt12;

-- TARGET: COLUMN company_login.company_active
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'company_login' AND column_name = 'company_active');
SET @sql := IF(@exists = 1, 'ALTER TABLE `company_login` DROP COLUMN `company_active`', 'SELECT 1');
PREPARE dstmt13 FROM @sql;
EXECUTE dstmt13;
DEALLOCATE PREPARE dstmt13;

-- TARGET: COLUMN users.user_password_hash
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'user_password_hash');
SET @sql := IF(@exists = 1, 'ALTER TABLE `users` DROP COLUMN `user_password_hash`', 'SELECT 1');
PREPARE dstmt14 FROM @sql;
EXECUTE dstmt14;
DEALLOCATE PREPARE dstmt14;
