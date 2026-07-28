-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Aug 01, 2026 at 04:37 PM
-- Server version: 11.8.8-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `finance_crm_prod`
--

-- --------------------------------------------------------

--
-- Table structure for table `address_lat_long_api_logs`
--

CREATE TABLE `address_lat_long_api_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `method_id` mediumint(9) DEFAULT NULL,
  `provider_id` tinyint(4) DEFAULT NULL,
  `lead_id` int(11) NOT NULL,
  `address` text DEFAULT NULL,
  `address_type` tinyint(4) DEFAULT NULL COMMENT '1=>current,2=>aadhaar',
  `api_name` varchar(100) NOT NULL,
  `request` text DEFAULT NULL,
  `response` text DEFAULT NULL,
  `error_message` varchar(200) DEFAULT NULL,
  `message` varchar(255) DEFAULT NULL,
  `http_status_code` smallint(6) DEFAULT NULL,
  `api_status_id` tinyint(4) NOT NULL COMMENT '1 = Success, 0 = Failure',
  `user_id` bigint(20) DEFAULT 0,
  `request_time` datetime NOT NULL,
  `response_time` datetime DEFAULT NULL,
  `duration` int(11) DEFAULT NULL COMMENT 'Execution time in milliseconds',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `latitude` varchar(50) DEFAULT NULL,
  `longitude` varchar(50) DEFAULT NULL,
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `deleted` tinyint(4) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `address_lat_long_api_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_account_aggregator_logs`
--

CREATE TABLE `api_account_aggregator_logs` (
  `aa_id` bigint(20) NOT NULL,
  `aa_provider` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=>SIGNZY,2=>novel pattern',
  `aa_lead_id` bigint(20) NOT NULL,
  `aa_method_id` tinyint(4) NOT NULL COMMENT '1 => Consent Request, 2 => Consent Status, 3 => FI Request, 4 => FI Request Status, 5 => FI Fetch Data, 6 => Analytics Report ',
  `aa_request` text DEFAULT NULL,
  `aa_response` longtext DEFAULT NULL,
  `aa_api_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `aa_status_message` varchar(255) DEFAULT NULL,
  `aa_error_message` varchar(255) NOT NULL,
  `aa_consentHandleId` varchar(255) DEFAULT NULL,
  `aa_consentId` varchar(255) DEFAULT NULL,
  `aa_sessionId` varchar(255) DEFAULT NULL,
  `aa_token` text DEFAULT NULL COMMENT 'API token',
  `aa_request_datetime` datetime NOT NULL,
  `aa_response_datetime` datetime DEFAULT NULL,
  `aa_active` tinyint(4) NOT NULL DEFAULT 1,
  `aa_deleted` tinyint(4) NOT NULL DEFAULT 0,
  `aa_file` varchar(255) DEFAULT NULL COMMENT 'Account aggregator file after final response',
  `aa_callback_status` tinyint(4) DEFAULT NULL,
  `aa_doc_id` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `api_account_aggregator_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_adjust_logs`
--

CREATE TABLE `api_adjust_logs` (
  `ad_log_id` bigint(20) UNSIGNED NOT NULL,
  `ad_request` text DEFAULT NULL,
  `ad_response` text DEFAULT NULL,
  `ad_request_datetime` datetime DEFAULT NULL,
  `ad_response_datetime` datetime DEFAULT NULL,
  `ad_api_status_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `ad_errors` varchar(500) DEFAULT NULL,
  `ad_lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ad_created_on` datetime NOT NULL,
  `ad_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `ad_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `api_banking_cart_log`
--

CREATE TABLE `api_banking_cart_log` (
  `cart_log_id` bigint(20) UNSIGNED NOT NULL,
  `cart_method_id` mediumint(8) UNSIGNED NOT NULL COMMENT '1=>Upload,2=>Download',
  `cart_lead_id` bigint(20) UNSIGNED NOT NULL,
  `cart_doc_id` bigint(20) UNSIGNED DEFAULT NULL,
  `cart_return_novel_doc_id` varchar(100) DEFAULT NULL,
  `cart_request_id` varchar(20) DEFAULT NULL,
  `cart_api_status_id` mediumint(8) UNSIGNED NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>RP Error',
  `cart_request` text DEFAULT NULL,
  `cart_response` longtext DEFAULT NULL,
  `cart_encrypted_request` longtext DEFAULT NULL,
  `cart_encrypted_response` longtext DEFAULT NULL,
  `cart_errors` varchar(500) DEFAULT NULL,
  `cart_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `cart_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `cart_lan_no` varchar(20) DEFAULT NULL,
  `cart_request_datetime` datetime DEFAULT NULL,
  `cart_response_datetime` datetime DEFAULT NULL,
  `cart_user_id` int(10) UNSIGNED DEFAULT NULL,
  `s3_flag` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>Uploaded'
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `api_banking_cart_log`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_bank_account_verification_logs`
--

CREATE TABLE `api_bank_account_verification_logs` (
  `bav_id` bigint(20) NOT NULL,
  `bav_provider_id` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>NUPAY, 2=>Signzy, 3=>Digitap',
  `bav_method_id` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>token api, 2->penny drop',
  `bav_lead_id` bigint(20) NOT NULL,
  `bav_cust_banking_id` bigint(20) UNSIGNED DEFAULT NULL,
  `bav_request` text DEFAULT NULL,
  `bav_response` text DEFAULT NULL,
  `bav_api_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `bav_errors` varchar(500) DEFAULT NULL,
  `bav_old_lead_id` int(11) DEFAULT NULL,
  `bav_request_datetime` datetime NOT NULL,
  `bav_response_datetime` datetime DEFAULT NULL,
  `bav_active` tinyint(4) NOT NULL DEFAULT 1,
  `bav_deleted` tinyint(4) NOT NULL DEFAULT 0,
  `bav_user_id` int(10) UNSIGNED DEFAULT NULL,
  `bav_auth_token` varchar(1000) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `api_bank_account_verification_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_callback_upi`
--

CREATE TABLE `api_callback_upi` (
  `acu_id` bigint(20) NOT NULL,
  `acu_method_id` tinyint(4) NOT NULL COMMENT '1=>QRCode, 2=>CollectPay',
  `acu_lead_id` bigint(20) UNSIGNED NOT NULL,
  `acu_transaction_id` varchar(255) DEFAULT NULL,
  `acu_response` text DEFAULT NULL,
  `acu_encrypt_response` longtext DEFAULT NULL,
  `acu_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `acu_errors` varchar(500) DEFAULT NULL,
  `acu_response_datetime` datetime DEFAULT NULL,
  `acu_requested_amount` bigint(20) DEFAULT NULL,
  `acu_active` tinyint(1) NOT NULL DEFAULT 1,
  `acu_deleted` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `api_credeau_log`
--

CREATE TABLE `api_credeau_log` (
  `acl_id` bigint(20) NOT NULL,
  `acl_provider` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>CREDEAU',
  `acl_method_id` tinyint(4) NOT NULL COMMENT '1=>Upload Document,2=>Request,3=>Download Docs',
  `acl_lead_id` bigint(20) UNSIGNED NOT NULL,
  `acl_request_packet` longtext DEFAULT NULL,
  `acl_request` longtext DEFAULT NULL,
  `acl_response` longtext DEFAULT NULL,
  `acl_api_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `acl_credeau_status_id` tinyint(4) DEFAULT NULL COMMENT '1 => Approve, 2 => Proceed to Bank, 3 => Reject',
  `acl_errors` varchar(500) DEFAULT NULL,
  `acl_success` varchar(500) DEFAULT NULL,
  `acl_request_datetime` datetime DEFAULT NULL,
  `acl_response_datetime` datetime DEFAULT NULL,
  `acl_active` tinyint(1) NOT NULL DEFAULT 1,
  `acl_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `acl_user_id` int(10) UNSIGNED DEFAULT NULL,
  `acl_return_url` varchar(250) DEFAULT NULL,
  `s3_flag` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>Uploaded',
  `credeau_decision` varchar(20) DEFAULT NULL,
  `credeau_approved_amount` bigint(10) DEFAULT NULL,
  `credeau_risk_grade` tinyint(4) DEFAULT NULL,
  `credeau_repayment_date` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `api_credeau_log`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_disburse_logs`
--

CREATE TABLE `api_disburse_logs` (
  `disburse_log_id` bigint(20) UNSIGNED NOT NULL,
  `disburse_bank_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT '1=>ICICI',
  `disburse_method_id` mediumint(8) UNSIGNED NOT NULL COMMENT '1=>Disburse,2=>Status Check',
  `disburse_trans_type_id` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1=>IMPS,2=>NEFT',
  `disburse_lead_id` bigint(20) UNSIGNED NOT NULL,
  `disburse_trans_refno` varchar(50) DEFAULT NULL,
  `disburse_api_status_id` mediumint(8) UNSIGNED NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `disburse_bank_reference_no` varchar(255) DEFAULT NULL,
  `disburse_payment_reference_no` varchar(255) DEFAULT NULL,
  `disburse_request` text DEFAULT NULL,
  `disburse_response` text DEFAULT NULL,
  `disburse_encrypted_request` longtext DEFAULT NULL,
  `disburse_encrypted_response` longtext DEFAULT NULL,
  `disburse_errors` varchar(500) DEFAULT NULL,
  `disburse_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `disburse_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `disburse_lan_no` varchar(20) DEFAULT NULL,
  `disburse_request_datetime` datetime DEFAULT NULL,
  `disburse_response_datetime` datetime DEFAULT NULL,
  `disburse_beneficiary_account_no` varchar(20) DEFAULT NULL,
  `disburse_beneficiary_ifsc_code` varchar(20) DEFAULT NULL,
  `disburse_beneficiary_name` varchar(50) DEFAULT NULL,
  `disburse_user_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `api_domain_verification_logs`
--

CREATE TABLE `api_domain_verification_logs` (
  `dv_id` bigint(20) NOT NULL,
  `dv_provider` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>Signzy',
  `dv_method_id` tinyint(4) NOT NULL COMMENT '1=>Get Domain Details',
  `dv_lead_id` bigint(20) UNSIGNED NOT NULL,
  `dv_email` varchar(255) DEFAULT NULL,
  `dv_domain` varchar(255) DEFAULT NULL,
  `dv_registration_date` varchar(255) DEFAULT NULL,
  `dv_request` text DEFAULT NULL,
  `dv_response` text DEFAULT NULL,
  `dv_api_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>SOT Error',
  `dv_errors` varchar(500) DEFAULT NULL,
  `dv_request_datetime` datetime DEFAULT NULL,
  `dv_response_datetime` datetime DEFAULT NULL,
  `dv_user_id` int(10) UNSIGNED DEFAULT NULL,
  `dv_active` tinyint(1) NOT NULL DEFAULT 1,
  `dv_deleted` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `api_domain_verification_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_ekyc_logs`
--

CREATE TABLE `api_ekyc_logs` (
  `ekyc_id` bigint(20) NOT NULL,
  `ekyc_provider` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>signzy digilocker, 2=>DigiTap',
  `ekyc_method_id` tinyint(4) NOT NULL COMMENT '1=>Create URL, 2=>Get Details, 3=>Get Files, 4=>Get E-Aadhaar, 5=>Pull Document',
  `ekyc_lead_id` bigint(20) UNSIGNED NOT NULL,
  `ekyc_aadhaar_no` varchar(20) DEFAULT NULL,
  `ekyc_request` longtext DEFAULT NULL,
  `ekyc_response` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ekyc_api_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `ekyc_errors` varchar(500) DEFAULT NULL,
  `ekyc_request_datetime` datetime DEFAULT NULL,
  `ekyc_response_datetime` datetime DEFAULT NULL,
  `ekyc_active` tinyint(1) NOT NULL DEFAULT 1,
  `ekyc_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `ekyc_user_id` int(10) UNSIGNED DEFAULT NULL,
  `ekyc_return_url` text DEFAULT NULL,
  `ekyc_return_request_id` varchar(100) DEFAULT NULL,
  `ekyc_eaadhaar_available_flag` char(1) DEFAULT NULL COMMENT 'Y=>Yes,N=>No',
  `s3_flag` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>Uploaded'
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `api_ekyc_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_email_logs`
--

CREATE TABLE `api_email_logs` (
  `email_log_id` bigint(20) UNSIGNED NOT NULL,
  `email_provider` varchar(50) DEFAULT NULL,
  `email_type_id` mediumint(8) UNSIGNED NOT NULL,
  `email_address` varchar(150) NOT NULL,
  `email_content` text DEFAULT NULL,
  `email_api_status_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `email_errors` varchar(500) DEFAULT NULL,
  `email_lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `email_created_on` datetime NOT NULL,
  `email_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `email_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `api_email_verification_logs`
--

CREATE TABLE `api_email_verification_logs` (
  `ev_id` bigint(20) NOT NULL,
  `ev_provider_id` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>mailgun, 2=>signzy',
  `ev_method_id` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>Personal Email Validation, 2=>Office Email Valdiation',
  `ev_lead_id` bigint(20) NOT NULL,
  `ev_email` varchar(150) DEFAULT NULL,
  `ev_request` text DEFAULT NULL,
  `ev_response` text DEFAULT NULL,
  `ev_api_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `ev_email_validate_status` tinyint(1) DEFAULT NULL COMMENT '1=>Yes,2=>No',
  `ev_errors` varchar(500) DEFAULT NULL,
  `ev_request_datetime` datetime NOT NULL,
  `ev_response_datetime` datetime NOT NULL,
  `ev_active` tinyint(1) NOT NULL DEFAULT 1,
  `ev_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `ev_user_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `api_email_verification_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_enach_logs`
--

CREATE TABLE `api_enach_logs` (
  `id` bigint(20) NOT NULL,
  `enach_provider` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>Worldline 2=>DigiTap',
  `enach_request_id` tinyint(4) NOT NULL COMMENT '1=>Register, 2=>Get Details, 3=>Get Files, 4=>Get E-Aadhaar, 5=>Pull Document',
  `enach_loan_no` varchar(50) NOT NULL,
  `enach_txn_id` varchar(50) NOT NULL,
  `enach_mandate_id` varchar(100) DEFAULT NULL,
  `enach_request` longtext DEFAULT NULL,
  `enach_response` longtext DEFAULT NULL,
  `enach_api_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `enach_status_code` varchar(4) DEFAULT NULL,
  `enach_errors` varchar(500) DEFAULT NULL,
  `enach_request_datetime` datetime DEFAULT NULL,
  `enach_response_datetime` datetime DEFAULT NULL,
  `enach_user_id` int(10) UNSIGNED DEFAULT NULL,
  `enach_return_url` text DEFAULT NULL,
  `enach_active` tinyint(1) NOT NULL DEFAULT 1,
  `enach_deleted` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `api_esign_logs`
--

CREATE TABLE `api_esign_logs` (
  `esign_id` bigint(20) NOT NULL,
  `esign_provider` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>Signzy, 2=>DigiTap',
  `esign_method_id` tinyint(4) NOT NULL COMMENT '1=>Upload Document,2=>eSgin Request,3=>Download Docs',
  `esign_lead_id` bigint(20) UNSIGNED NOT NULL,
  `esign_type_id` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '	1=>KFS, 2=>Sanction Letter',
  `esign_aadhaar_no` varchar(20) DEFAULT NULL,
  `esign_request` text DEFAULT NULL,
  `esign_response` text DEFAULT NULL,
  `esign_api_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `esign_errors` varchar(500) DEFAULT NULL,
  `esign_request_datetime` datetime DEFAULT NULL,
  `esign_response_datetime` datetime DEFAULT NULL,
  `esign_active` tinyint(1) NOT NULL DEFAULT 1,
  `esign_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `esign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `esign_return_url` varchar(250) DEFAULT NULL,
  `s3_flag` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>Uploaded'
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `api_esign_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_face_match_logs`
--

CREATE TABLE `api_face_match_logs` (
  `fm_id` bigint(20) NOT NULL,
  `fm_provider` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>Signzy',
  `fm_method_id` tinyint(4) NOT NULL COMMENT '1=>Verify Face Match',
  `fm_lead_id` bigint(20) UNSIGNED NOT NULL,
  `fm_score` varchar(255) DEFAULT NULL,
  `fm_request` text DEFAULT NULL,
  `fm_response` text DEFAULT NULL,
  `fm_api_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>SOT Error',
  `fm_errors` varchar(500) DEFAULT NULL,
  `fm_request_datetime` datetime DEFAULT NULL,
  `fm_response_datetime` datetime DEFAULT NULL,
  `fm_user_id` int(10) UNSIGNED DEFAULT NULL,
  `fm_active` tinyint(1) NOT NULL DEFAULT 1,
  `fm_deleted` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `api_face_match_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_java_middleware_logs`
--

CREATE TABLE `api_java_middleware_logs` (
  `middleware_log_id` bigint(20) UNSIGNED NOT NULL,
  `middleware_product_id` smallint(5) UNSIGNED NOT NULL,
  `middleware_method_id` smallint(5) UNSIGNED NOT NULL COMMENT '1=> Encrypt, 2=> Decrypt',
  `middleware_api_name` varchar(100) NOT NULL,
  `middleware_lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `middleware_api_status_id` mediumint(8) UNSIGNED NOT NULL COMMENT '1=>Success,2=>APi Error,3=>Conn Error, 4=> LW Error',
  `middleware_request` text DEFAULT NULL,
  `middleware_response` text DEFAULT NULL,
  `middleware_errors` text DEFAULT NULL,
  `middleware_request_datetime` datetime DEFAULT NULL,
  `middleware_response_datetime` datetime DEFAULT NULL,
  `middleware_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `middleware_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `api_poi_verification_logs`
--

CREATE TABLE `api_poi_verification_logs` (
  `poi_veri_id` bigint(20) NOT NULL,
  `poi_veri_provider` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>Signzy, 2=>DigiTap',
  `poi_veri_method_id` tinyint(4) NOT NULL COMMENT '1=>PAN FETCH',
  `poi_veri_lead_id` bigint(20) UNSIGNED NOT NULL,
  `poi_veri_request` text DEFAULT NULL,
  `poi_veri_response` text DEFAULT NULL,
  `poi_veri_proof_no` varchar(50) DEFAULT NULL,
  `poi_veri_api_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `poi_veri_errors` varchar(500) DEFAULT NULL,
  `poi_veri_request_datetime` datetime DEFAULT NULL,
  `poi_veri_response_datetime` datetime DEFAULT NULL,
  `poi_veri_active` tinyint(1) NOT NULL DEFAULT 1,
  `poi_veri_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `poi_veri_user_id` int(10) UNSIGNED DEFAULT NULL,
  `poi_veri_father_name` varchar(100) DEFAULT NULL,
  `poi_veri_profile_id` bigint(20) UNSIGNED DEFAULT NULL,
  `poi_other_pan_veri_flag` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1=>Other Pan Card '
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `api_poi_verification_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_repayment_logs`
--

CREATE TABLE `api_repayment_logs` (
  `repayment_log_id` bigint(20) UNSIGNED NOT NULL,
  `repayment_provider_id` mediumint(9) NOT NULL COMMENT '1 => EasyPay, 2 => RazorPay, 3 => ccAvenue, 4=>PayU, 5=>ICICI UPI',
  `repayment_method_id` smallint(5) UNSIGNED NOT NULL COMMENT '1=>Website, 2=>LINK',
  `repayment_lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `repayment_loan_id` varchar(255) DEFAULT NULL,
  `repayment_trans_no` varchar(255) DEFAULT NULL,
  `repayment_api_status_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT '1=>Success,2=>APi Error,3=>Conn Error, 4=>Code  Error, 5 => Pending',
  `repayment_request` text DEFAULT NULL,
  `repayment_response` text DEFAULT NULL,
  `repayment_errors` varchar(500) DEFAULT NULL,
  `repayment_request_datetime` datetime DEFAULT NULL,
  `repayment_response_datetime` datetime DEFAULT NULL,
  `repayment_tid` varchar(500) DEFAULT NULL,
  `repayment_order_id` varchar(500) DEFAULT NULL,
  `repayment_amount` int(10) UNSIGNED DEFAULT NULL,
  `repayment_transaction_date` datetime DEFAULT NULL,
  `repayment_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `repayment_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `repayment_source_id` smallint(5) UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=>Website,2=>Link generated by Executive',
  `repayment_user_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `api_reverse_geo_code`
--

CREATE TABLE `api_reverse_geo_code` (
  `rg_log_id` bigint(20) UNSIGNED NOT NULL,
  `rg_lead_id` bigint(20) UNSIGNED NOT NULL,
  `rg_api_status_id` mediumint(8) UNSIGNED NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>RP Error',
  `rg_request` text CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `rg_response` longtext CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `rg_latitude` varchar(500) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `rg_longitude` varchar(500) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `rg_errors` varchar(500) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `rg_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `rg_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `rg_lan_no` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `rg_request_datetime` datetime DEFAULT NULL,
  `rg_response_datetime` datetime DEFAULT NULL,
  `rg_user_id` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `api_reverse_geo_code`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_sms_logs`
--

CREATE TABLE `api_sms_logs` (
  `sms_log_id` bigint(20) UNSIGNED NOT NULL,
  `sms_provider` varchar(50) DEFAULT NULL COMMENT '1=> VAPIO, 2=> WHISTLE, 3=> VIRTUSO',
  `sms_type_id` mediumint(8) UNSIGNED NOT NULL,
  `sms_mobile` varchar(250) NOT NULL DEFAULT '""',
  `sms_content` text DEFAULT NULL,
  `sms_template_id` varchar(20) DEFAULT NULL,
  `sms_template_source` varchar(20) DEFAULT NULL,
  `sms_api_status_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `sms_errors` varchar(500) DEFAULT NULL,
  `sms_lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `sms_user_id` int(10) UNSIGNED DEFAULT NULL,
  `sms_created_on` datetime DEFAULT NULL,
  `sms_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `sms_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `sms_provider_used` varchar(255) DEFAULT NULL,
  `sms_attempted_providers` varchar(255) DEFAULT NULL,
  `sms_api_response` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `api_sms_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `api_upi_logs`
--

CREATE TABLE `api_upi_logs` (
  `au_id` bigint(20) NOT NULL,
  `au_provider` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>ICICI',
  `au_method_id` tinyint(4) NOT NULL COMMENT '1=>Get QRCode, 2=>CollectPay, 3=>Check Transaction Status',
  `au_lead_id` bigint(20) UNSIGNED NOT NULL,
  `au_transaction_id` varchar(255) DEFAULT NULL,
  `au_request` text DEFAULT NULL,
  `au_response` text DEFAULT NULL,
  `au_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `au_errors` varchar(500) DEFAULT NULL,
  `au_request_datetime` datetime DEFAULT NULL,
  `au_response_datetime` datetime DEFAULT NULL,
  `au_encrypt_request` longtext DEFAULT NULL,
  `au_encrypt_response` longtext DEFAULT NULL,
  `au_requested_amount` varchar(255) DEFAULT NULL,
  `au_status_check` tinyint(3) UNSIGNED DEFAULT 0,
  `au_user_id` int(10) UNSIGNED DEFAULT NULL,
  `au_active` tinyint(1) NOT NULL DEFAULT 1,
  `au_deleted` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `api_video_ekyc_logs`
--

CREATE TABLE `api_video_ekyc_logs` (
  `avedl_id` bigint(20) NOT NULL,
  `avedl_provider` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>Signzy',
  `avedl_method_id` tinyint(4) NOT NULL COMMENT '1=>Request, 2=>Email Sent, 3=>Callback',
  `avedl_lead_id` bigint(20) UNSIGNED NOT NULL,
  `avedl_request_id` varchar(255) DEFAULT NULL,
  `avedl_request` text DEFAULT NULL,
  `avedl_response` text DEFAULT NULL,
  `avedl_return_url` text DEFAULT NULL,
  `avedl_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>FLP Error',
  `avedl_errors` varchar(500) DEFAULT NULL,
  `avedl_request_datetime` datetime DEFAULT NULL,
  `avedl_response_datetime` datetime DEFAULT NULL,
  `avedl_user_id` int(10) UNSIGNED DEFAULT NULL,
  `avedl_active` tinyint(1) NOT NULL DEFAULT 1,
  `avedl_deleted` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `api_video_ekyc_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `callback_logs`
--

CREATE TABLE `callback_logs` (
  `id` bigint(20) NOT NULL,
  `headers` longtext DEFAULT NULL,
  `body` longtext DEFAULT NULL,
  `method` varchar(10) DEFAULT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `callback_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `cif_customer`
--

CREATE TABLE `cif_customer` (
  `cif_id` bigint(20) UNSIGNED NOT NULL,
  `cif_number` varchar(20) DEFAULT NULL,
  `cif_first_name` varchar(255) DEFAULT NULL,
  `cif_middle_name` varchar(50) DEFAULT NULL,
  `cif_sur_name` varchar(50) DEFAULT NULL,
  `cif_gender` smallint(5) UNSIGNED DEFAULT NULL COMMENT '1=>Male,2=>Female',
  `cif_dob` date DEFAULT NULL,
  `cif_pancard` varchar(15) DEFAULT NULL,
  `cif_pancard_verified` tinyint(3) UNSIGNED DEFAULT 0,
  `cif_pancard_verified_on` datetime DEFAULT NULL,
  `cif_personal_email` varchar(150) DEFAULT NULL,
  `cif_office_email` varchar(150) DEFAULT NULL,
  `cif_mobile` bigint(20) UNSIGNED DEFAULT NULL,
  `cif_alternate_mobile` bigint(20) UNSIGNED DEFAULT NULL,
  `cif_residence_address_1` varchar(500) DEFAULT NULL,
  `cif_residence_address_2` varchar(255) DEFAULT NULL,
  `cif_residence_address_3` varchar(255) DEFAULT NULL,
  `cif_residence_landmark` varchar(255) DEFAULT NULL,
  `cif_residence_city_id` int(10) UNSIGNED DEFAULT NULL,
  `cif_residence_state_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `cif_residence_pincode` mediumint(8) UNSIGNED DEFAULT NULL,
  `cif_residence_since` date DEFAULT NULL,
  `cif_residence_type` varchar(20) DEFAULT NULL,
  `cif_residence_residing_with_family` varchar(10) DEFAULT NULL,
  `cif_aadhaar_no` varchar(15) DEFAULT NULL,
  `cif_aadhaar_ref_key` varchar(15) DEFAULT NULL,
  `cif_office_address_1` varchar(250) DEFAULT NULL,
  `cif_office_address_2` varchar(250) DEFAULT NULL,
  `cif_office_address_3` varchar(250) DEFAULT NULL,
  `cif_office_address_landmark` varchar(250) DEFAULT NULL,
  `cif_office_city_id` int(10) UNSIGNED DEFAULT NULL,
  `cif_office_state_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `cif_office_pincode` mediumint(8) UNSIGNED DEFAULT NULL,
  `cif_company_name` varchar(500) DEFAULT NULL,
  `cif_company_website` varchar(255) DEFAULT NULL,
  `cif_company_type_id` varchar(50) DEFAULT NULL,
  `cif_aadhaar_same_as_residence` tinyint(3) UNSIGNED DEFAULT 0,
  `cif_aadhaar_address_1` varchar(250) DEFAULT NULL,
  `cif_aadhaar_address_2` varchar(250) DEFAULT NULL,
  `cif_aadhaar_address_3` varchar(250) DEFAULT NULL,
  `cif_aadhaar_landmark` varchar(250) DEFAULT NULL,
  `cif_aadhaar_city_id` int(10) UNSIGNED DEFAULT NULL,
  `cif_aadhaar_state_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `cif_aadhaar_pincode` mediumint(8) UNSIGNED DEFAULT NULL,
  `cif_loan_is_disbursed` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '1=>Loan dsibursed',
  `cif_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `cif_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `cif_office_working_since` date DEFAULT NULL,
  `cif_office_designation` varchar(50) DEFAULT NULL,
  `cif_office_department` varchar(100) DEFAULT NULL,
  `cif_created_by` int(10) UNSIGNED DEFAULT NULL,
  `cif_created_on` datetime DEFAULT NULL,
  `cif_updated_by` int(10) UNSIGNED DEFAULT NULL,
  `cif_updated_on` datetime DEFAULT NULL,
  `cif_income_type` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1=>salaried;2=>self-employed',
  `cif_digital_ekyc_flag` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '1=>Yes',
  `cif_digital_ekyc_datetime` datetime DEFAULT NULL,
  `cif_aadhaar_no_old` varchar(20) DEFAULT NULL,
  `cif_father_name` varchar(100) DEFAULT NULL,
  `cif_religion_id` int(10) UNSIGNED DEFAULT NULL,
  `cif_marital_status_id` int(11) NOT NULL DEFAULT 0,
  `cif_spouse_name` varchar(100) NOT NULL,
  `cif_spouse_occupation_id` int(11) NOT NULL DEFAULT 0,
  `cif_qualification_id` int(11) NOT NULL DEFAULT 0,
  `cif_occupation_id` int(11) NOT NULL DEFAULT 0,
  `cif_executive_reloan_flag` tinyint(4) NOT NULL DEFAULT 0,
  `cif_executive_reloan_remark` varchar(500) DEFAULT NULL,
  `cif_executive_reloan_user_id` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `cif_customer`
--


-- --------------------------------------------------------

--
-- Table structure for table `collection`
--

CREATE TABLE `collection` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `old_recovery_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_id` bigint(20) UNSIGNED NOT NULL,
  `company_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 1,
  `product_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 1,
  `customer_id` varchar(20) DEFAULT NULL,
  `loan_no` varchar(20) NOT NULL,
  `payment_mode` varchar(255) NOT NULL,
  `payment_mode_id` tinyint(3) UNSIGNED DEFAULT NULL,
  `received_amount` double(10,2) NOT NULL,
  `refrence_no` varchar(255) DEFAULT NULL,
  `repayment_type` varchar(255) NOT NULL,
  `company_account_no` varchar(100) NOT NULL,
  `docs` varchar(255) NOT NULL,
  `discount` double(10,2) NOT NULL,
  `refund` double(10,2) DEFAULT NULL,
  `date_of_recived` date DEFAULT NULL,
  `recovery_status` varchar(20) NOT NULL,
  `payment_verification` int(10) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=Pending, 1=Approved, 2=Reject',
  `sattelment` double(10,2) NOT NULL DEFAULT 0.00,
  `remarks` varchar(255) NOT NULL,
  `noc` varchar(10) DEFAULT '0',
  `ip` varchar(20) NOT NULL,
  `collection_executive_payment_created_on` datetime NOT NULL,
  `collection_executive_user_id` int(10) UNSIGNED DEFAULT NULL,
  `closure_user_id` int(10) UNSIGNED DEFAULT NULL,
  `closure_payment_updated_on` datetime DEFAULT NULL,
  `closure_remarks` varchar(500) DEFAULT NULL,
  `collection_type` varchar(255) DEFAULT NULL COMMENT '0=collection default,1=collection new,2=collection reschedule',
  `collection_active` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `collection_deleted` int(10) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `collection`
--


-- --------------------------------------------------------

--
-- Table structure for table `collection_bucket_wise_permission`
--

CREATE TABLE `collection_bucket_wise_permission` (
  `cbwp_id` int(10) UNSIGNED NOT NULL,
  `cbwp_mcbw_id` int(10) UNSIGNED NOT NULL COMMENT 'from master_collection_bucket_wise',
  `cbwp_user_role_id` int(10) UNSIGNED DEFAULT NULL,
  `cbwp_user_id` int(10) UNSIGNED NOT NULL,
  `cbwp_created_user_id` int(11) DEFAULT NULL,
  `cbwp_created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `cbwp_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `cbwp_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `cbwp_updated_user_id` int(11) DEFAULT NULL,
  `cbwp_updated_at` datetime DEFAULT NULL,
  `cbwp_ip_address` varchar(45) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_holiday`
--

CREATE TABLE `company_holiday` (
  `ch_id` int(10) UNSIGNED NOT NULL,
  `ch_holiday_date` date NOT NULL,
  `ch_holiday_name` varchar(500) NOT NULL,
  `ch_active` tinyint(1) NOT NULL DEFAULT 1,
  `ch_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `ch_created_by` int(10) UNSIGNED DEFAULT NULL,
  `ch_created_datetime` datetime DEFAULT NULL,
  `ch_deleted_by` int(10) UNSIGNED DEFAULT NULL,
  `ch_deleted_datetime` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_login`
--

CREATE TABLE `company_login` (
  `company_id` bigint(20) UNSIGNED NOT NULL,
  `company_name` text NOT NULL,
  `company_code` varchar(255) NOT NULL,
  `company_type` varchar(255) NOT NULL,
  `url` text NOT NULL,
  `address` text NOT NULL,
  `company_contact` varchar(255) NOT NULL,
  `created_by` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_by` int(11) NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `credit_analysis_memo`
--

CREATE TABLE `credit_analysis_memo` (
  `cam_id` bigint(20) UNSIGNED NOT NULL,
  `company_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 1,
  `product_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 1,
  `lead_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` varchar(50) DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `ntc` varchar(50) DEFAULT NULL,
  `run_other_pd_loan` varchar(50) DEFAULT NULL,
  `delay_other_loan_30_days` varchar(50) DEFAULT NULL,
  `job_stability` varchar(50) DEFAULT NULL,
  `city_category` varchar(5) DEFAULT NULL,
  `salary_credit1` varchar(50) DEFAULT NULL,
  `salary_credit1_date` varchar(50) DEFAULT NULL,
  `salary_credit1_amount` int(10) UNSIGNED DEFAULT NULL,
  `salary_credit2` varchar(50) DEFAULT NULL,
  `salary_credit2_date` varchar(50) DEFAULT NULL,
  `salary_credit2_amount` int(10) UNSIGNED DEFAULT NULL,
  `salary_credit3` varchar(50) DEFAULT NULL,
  `salary_credit3_date` varchar(50) DEFAULT NULL,
  `salary_credit3_amount` int(10) UNSIGNED DEFAULT NULL,
  `next_pay_date` varchar(50) DEFAULT NULL,
  `median_salary` int(10) UNSIGNED DEFAULT NULL,
  `salary_variance` varchar(50) DEFAULT NULL,
  `salary_on_time` varchar(50) DEFAULT NULL,
  `borrower_age` varchar(50) DEFAULT NULL,
  `end_use` varchar(50) DEFAULT NULL,
  `eligible_foir_percentage` float DEFAULT NULL,
  `eligible_loan` double(10,2) DEFAULT NULL,
  `loan_recommended` int(11) DEFAULT NULL,
  `final_foir_percentage` float DEFAULT NULL,
  `foir_enhanced_by` varchar(50) DEFAULT NULL,
  `processing_fee_percent` float DEFAULT NULL,
  `roi` double(10,2) DEFAULT NULL,
  `admin_fee` double DEFAULT NULL COMMENT 'pf with gst',
  `disbursal_date` date DEFAULT NULL,
  `repayment_date` date DEFAULT NULL,
  `adminFeeWithGST` double DEFAULT NULL COMMENT 'calculated GST',
  `total_admin_fee` double DEFAULT NULL COMMENT 'net pf without gst',
  `tenure` int(11) DEFAULT NULL,
  `net_disbursal_amount` double DEFAULT NULL,
  `repayment_amount` double DEFAULT NULL,
  `panel_roi` float DEFAULT NULL,
  `b2b_disbursal` varchar(50) DEFAULT NULL,
  `b2b_number` int(11) DEFAULT NULL,
  `deviationsApprovedBy` varchar(50) DEFAULT NULL,
  `cam_status` mediumint(8) UNSIGNED DEFAULT NULL COMMENT '''0''=>''Not Recommend or Sanction'', ''1''=>''Recommend or Sanction''',
  `remark` varchar(500) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_by` int(10) UNSIGNED DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `cam_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `cam_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `cam_sanction_letter_file_name` varchar(150) DEFAULT NULL,
  `cam_sanction_letter_esgin_type_id` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '1=>aadhaar eSign',
  `cam_sanction_letter_esgin_file_name` varchar(150) DEFAULT NULL,
  `cam_esgin_audit_trail_file_name` varchar(255) DEFAULT NULL,
  `cam_sanction_letter_esgin_on` datetime DEFAULT NULL,
  `cam_sanction_letter_ip_address` varchar(20) DEFAULT NULL,
  `cam_sanction_letter_esgin_count` tinyint(3) UNSIGNED DEFAULT 0,
  `cam_risk_profile` varchar(10) DEFAULT NULL,
  `cam_risk_score` int(10) UNSIGNED DEFAULT NULL,
  `cam_advance_interest_amount` double UNSIGNED DEFAULT 0,
  `cam_appraised_obligations` double DEFAULT 0,
  `cam_appraised_monthly_income` double DEFAULT 0,
  `cam_blacklist_removed_flag` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '1=>Yes,0=>No',
  `cam_sanction_remarks` varchar(500) DEFAULT NULL,
  `cam_processing_fee_gst_type_id` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>Inclusive,2=>Exclusive'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `credit_analysis_memo`
--


-- --------------------------------------------------------

--
-- Table structure for table `cron_logs`
--

CREATE TABLE `cron_logs` (
  `id` int(11) NOT NULL,
  `job_id` varchar(100) NOT NULL,
  `job_type` tinyint(4) NOT NULL DEFAULT 1 COMMENT '0 = Automate, 1 = Reminder, 2 = Wishes',
  `job_name` varchar(100) NOT NULL,
  `job_log` longtext NOT NULL,
  `job_status` tinyint(4) NOT NULL DEFAULT 0 COMMENT '0 = Running, 1 = Completed, 2 = Failed',
  `job_url` varchar(150) NOT NULL,
  `started_at` datetime NOT NULL,
  `completed_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `cron_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `cron_scheduler_logs`
--

CREATE TABLE `cron_scheduler_logs` (
  `cs_id` bigint(20) UNSIGNED NOT NULL,
  `cs_name` varchar(255) NOT NULL,
  `cs_start_datetime` datetime DEFAULT NULL,
  `cs_end_datetime` datetime DEFAULT NULL,
  `cs_ip` varchar(50) DEFAULT NULL,
  `cs_active` tinyint(1) NOT NULL DEFAULT 1,
  `cs_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `cs_success_count` int(10) UNSIGNED DEFAULT NULL,
  `cs_failed_count` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `cron_scheduler_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `customer_api_data`
--

CREATE TABLE `customer_api_data` (
  `api_id` bigint(20) NOT NULL,
  `api_provider` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>Signzy, 2=>DigiTap, 3 => Surepass',
  `api_type` tinyint(4) NOT NULL COMMENT '1=>PAN FETCH, 2 => PAN TO EMAIL, 3 => PAN TO UAN',
  `api_lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `api_unique_id` varchar(50) DEFAULT NULL,
  `api_request` text DEFAULT NULL,
  `api_response` text DEFAULT NULL,
  `api_custom_response` text DEFAULT NULL,
  `api_request_datetime` datetime DEFAULT NULL,
  `api_response_datetime` datetime DEFAULT NULL,
  `api_profile_id` bigint(20) UNSIGNED DEFAULT NULL,
  `api_status_id` mediumint(9) NOT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `api_url` varchar(500) DEFAULT NULL,
  `api_source` tinyint(4) NOT NULL DEFAULT 1 COMMENT '0 = Web, 1=> CRM',
  `api_active` tinyint(4) NOT NULL DEFAULT 1,
  `api_deleted` tinyint(4) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `customer_api_data`
--


-- --------------------------------------------------------

--
-- Table structure for table `customer_banking`
--

CREATE TABLE `customer_banking` (
  `id` bigint(20) NOT NULL,
  `customer_id` varchar(20) DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `bank_name` varchar(100) NOT NULL,
  `ifsc_code` varchar(20) NOT NULL,
  `branch` varchar(255) DEFAULT NULL,
  `beneficiary_name` varchar(100) DEFAULT NULL,
  `account` varchar(20) NOT NULL,
  `confirm_account` varchar(20) NOT NULL,
  `account_type` varchar(30) DEFAULT NULL,
  `account_status` varchar(60) DEFAULT NULL,
  `account_status_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT 'master_bank_account_status id',
  `remark` varchar(255) DEFAULT NULL,
  `same_account` int(11) NOT NULL DEFAULT 0,
  `cancelled_cheque` varchar(255) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_on` datetime DEFAULT NULL,
  `updated_by` int(10) UNSIGNED DEFAULT NULL,
  `updated_on` datetime DEFAULT NULL,
  `customer_banking_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `customer_banking_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `customer_banking`
--


-- --------------------------------------------------------

--
-- Table structure for table `customer_black_list`
--

CREATE TABLE `customer_black_list` (
  `bl_id` bigint(20) UNSIGNED NOT NULL,
  `bl_source_entity` tinyint(3) UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=>SOT',
  `bl_lead_id` bigint(20) DEFAULT NULL,
  `bl_loan_no` varchar(20) DEFAULT NULL,
  `bl_customer_first_name` varchar(50) DEFAULT NULL,
  `bl_customer_middle_name` varchar(50) DEFAULT NULL,
  `bl_customer_sur_name` varchar(50) DEFAULT NULL,
  `bl_customer_mobile` bigint(20) UNSIGNED DEFAULT NULL,
  `bl_customer_alternate_mobile` bigint(20) DEFAULT NULL,
  `bl_customer_pancard` varchar(15) NOT NULL,
  `bl_customer_dob` date DEFAULT NULL,
  `bl_customer_email` varchar(150) NOT NULL,
  `bl_customer_alternate_email` varchar(150) DEFAULT NULL,
  `bl_city_id` int(10) UNSIGNED DEFAULT NULL,
  `bl_state_id` int(10) UNSIGNED DEFAULT NULL,
  `bl_created_on` datetime NOT NULL,
  `bl_updated_on` datetime DEFAULT NULL,
  `bl_created_user_id` int(10) UNSIGNED DEFAULT NULL,
  `bl_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `bl_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `bl_reason_id` int(10) UNSIGNED DEFAULT NULL,
  `bl_reason_remark` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_employment`
--

CREATE TABLE `customer_employment` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` varchar(255) DEFAULT NULL,
  `company_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 1,
  `product_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 1,
  `lead_id` bigint(20) UNSIGNED NOT NULL,
  `employer_name` varchar(255) DEFAULT NULL,
  `emp_state` varchar(255) DEFAULT NULL,
  `emp_city` varchar(255) DEFAULT NULL,
  `emp_district` varchar(60) DEFAULT NULL,
  `emp_pincode` int(10) UNSIGNED DEFAULT NULL,
  `emp_house` varchar(500) DEFAULT NULL,
  `emp_street` varchar(255) DEFAULT NULL,
  `emp_landmark` varchar(255) DEFAULT NULL,
  `emp_residence_since` date DEFAULT NULL,
  `emp_designation` varchar(255) DEFAULT NULL,
  `emp_department` varchar(100) DEFAULT NULL,
  `emp_employer_type` varchar(255) DEFAULT NULL,
  `presentServiceTenure` varchar(40) DEFAULT NULL,
  `emp_website` varchar(255) DEFAULT NULL,
  `monthly_income` double DEFAULT NULL,
  `emp_salary_mode` varchar(50) DEFAULT NULL,
  `industry` varchar(255) DEFAULT NULL,
  `sector` varchar(255) DEFAULT NULL,
  `income_type` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1=>salaried;2=>self-employed',
  `salary_mode` varchar(100) DEFAULT NULL,
  `emp_status` enum('YES','NO') DEFAULT NULL,
  `emp_created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_on` datetime DEFAULT NULL,
  `emp_updated_by` int(10) UNSIGNED DEFAULT NULL,
  `updated_on` datetime DEFAULT NULL,
  `emp_locality` varchar(255) DEFAULT NULL,
  `emp_lankmark` varchar(255) DEFAULT NULL,
  `emp_shopNo` varchar(45) DEFAULT NULL,
  `office_address` varchar(255) DEFAULT NULL,
  `emp_email` varchar(100) DEFAULT NULL,
  `emp_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `emp_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `state_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `city_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `emp_work_mode` varchar(25) DEFAULT NULL,
  `emp_linkedin_url` varchar(1000) DEFAULT NULL,
  `emp_occupation_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `emp_uan` varchar(500) DEFAULT NULL,
  `emp_uan_employer` varchar(500) DEFAULT NULL,
  `emp_uan_doj` date DEFAULT NULL,
  `emp_uan_doe` date DEFAULT NULL,
  `next_salary_date` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `customer_employment`
--


-- --------------------------------------------------------

--
-- Table structure for table `customer_enquiry`
--

CREATE TABLE `customer_enquiry` (
  `cust_enquiry_id` bigint(20) UNSIGNED NOT NULL,
  `cust_enquiry_lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `cust_enquiry_name` varchar(150) NOT NULL,
  `cust_enquiry_mobile` bigint(20) UNSIGNED NOT NULL,
  `cust_enquiry_email` varchar(150) DEFAULT NULL,
  `cust_enquiry_data_source_id` mediumint(8) UNSIGNED NOT NULL,
  `cust_enquiry_loan_amount` double DEFAULT NULL,
  `cust_enquiry_type_id` smallint(5) UNSIGNED NOT NULL COMMENT '1=>Enquiry, 2=> Contact Us',
  `cust_enquiry_city_name` varchar(100) DEFAULT NULL,
  `cust_enquiry_city_id` int(10) UNSIGNED DEFAULT NULL,
  `cust_enquiry_remarks` varchar(1000) DEFAULT NULL,
  `cust_enquiry_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `cust_enquiry_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `cust_enquiry_ip_address` varchar(100) DEFAULT NULL,
  `cust_enquiry_created_datetime` datetime NOT NULL,
  `cust_enquiry_updated_datetime` datetime DEFAULT NULL,
  `cust_enquiry_geo_coordinates` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_otp`
--

CREATE TABLE `customer_otp` (
  `otp_id` bigint(20) NOT NULL,
  `otp_mobile` bigint(20) UNSIGNED NOT NULL,
  `otp` varchar(6) NOT NULL,
  `otp_verified_at` datetime DEFAULT NULL,
  `otp_valid_till` datetime DEFAULT NULL,
  `otp_provider` varchar(500) DEFAULT NULL,
  `otp_created_at` datetime NOT NULL,
  `otp_status` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `utm_source` varchar(50) DEFAULT NULL,
  `utm_term` varchar(50) DEFAULT NULL,
  `utm_campaign` varchar(50) DEFAULT NULL,
  `utm_medium` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `customer_otp`
--


-- --------------------------------------------------------

--
-- Table structure for table `customer_profile`
--

CREATE TABLE `customer_profile` (
  `cp_id` bigint(20) NOT NULL,
  `cp_lead_id` bigint(20) DEFAULT NULL,
  `cp_first_name` varchar(255) DEFAULT NULL,
  `cp_middle_name` varchar(50) DEFAULT NULL,
  `cp_sur_name` varchar(100) DEFAULT NULL,
  `cp_mobile` bigint(20) DEFAULT NULL,
  `cp_mobile_otp` varchar(6) DEFAULT NULL,
  `cp_mobile_verified` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Yes,0=>No',
  `cp_alternate_mobile` bigint(20) DEFAULT NULL,
  `cp_aadhaar_no` varchar(12) DEFAULT NULL,
  `cp_pancard` varchar(20) DEFAULT NULL,
  `cp_pancard_verified_status` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>Not Verified,1=>Verified',
  `cp_pancard_verified_on` datetime DEFAULT NULL,
  `cp_father_name` varchar(150) DEFAULT NULL,
  `cp_user_type` enum('NEW','REPEAT','UNPAID-REPEAT') DEFAULT NULL,
  `cp_dob` date DEFAULT NULL,
  `cp_gender` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1=>Male,2=>Female',
  `cp_geo_lat` varchar(50) DEFAULT NULL,
  `cp_geo_long` varchar(50) DEFAULT NULL,
  `cp_login_geo_lat` varchar(50) DEFAULT NULL,
  `cp_login_geo_long` varchar(50) DEFAULT NULL,
  `cp_residence_city_id` int(11) DEFAULT NULL,
  `cp_residence_state_id` mediumint(9) DEFAULT NULL,
  `cp_residence_pincode` mediumint(9) DEFAULT NULL,
  `cp_residence_type_id` mediumint(9) DEFAULT NULL,
  `cp_residence_branch_id` mediumint(9) DEFAULT NULL,
  `cp_residence_address_1` text DEFAULT NULL,
  `cp_residence_address_2` text DEFAULT NULL,
  `cp_residence_landmark` text DEFAULT NULL,
  `cp_aadhaar_address_1` varchar(255) DEFAULT NULL,
  `cp_digital_ekyc_flag` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>Yes',
  `cp_digital_ekyc_done_on` datetime DEFAULT NULL,
  `cp_aadhaar_address_2` varchar(255) DEFAULT NULL,
  `cp_aadhaar_landmark` varchar(255) DEFAULT NULL,
  `cp_aadhaar_city_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `cp_aadhaar_state_id` smallint(5) UNSIGNED DEFAULT NULL,
  `cp_aadhaar_pincode` mediumint(8) UNSIGNED DEFAULT NULL,
  `cp_personal_email` varchar(200) DEFAULT NULL,
  `cp_personal_email_verified_status` smallint(6) DEFAULT NULL,
  `cp_personal_email_verified_on` datetime DEFAULT NULL,
  `cp_office_email` varchar(200) DEFAULT NULL,
  `cp_income_type_id` mediumint(9) DEFAULT NULL,
  `cp_monthly_income` double DEFAULT NULL,
  `cp_salary_mode` varchar(50) DEFAULT NULL,
  `cp_salary_date` date DEFAULT NULL,
  `cp_religion_id` tinyint(4) DEFAULT NULL,
  `cp_active` tinyint(4) NOT NULL DEFAULT 1,
  `cp_deleted` tinyint(4) NOT NULL DEFAULT 0,
  `cp_is_cif_fetched` tinyint(4) DEFAULT NULL COMMENT '1=>Yes,0=>No',
  `cp_cif_no` varchar(250) DEFAULT NULL,
  `cp_profile_pic` varchar(150) DEFAULT NULL,
  `cp_journey_type_id` tinyint(4) DEFAULT NULL COMMENT '1=>Web,2=>App',
  `cp_journey_stage` varchar(50) DEFAULT NULL,
  `cp_registration_successful` tinyint(4) NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `cp_is_journey_completed` tinyint(4) DEFAULT NULL,
  `cp_adjust_adid` varchar(250) DEFAULT NULL COMMENT 'adjust device id',
  `cp_adjust_gps_adid` varchar(250) DEFAULT NULL COMMENT 'adjust google id',
  `cp_adjust_idfa` varchar(250) DEFAULT NULL COMMENT 'adjust ios id',
  `cp_marital_status_id` mediumint(9) DEFAULT NULL,
  `cp_spouse_name` varchar(150) DEFAULT NULL,
  `cp_spouse_mobile` bigint(20) UNSIGNED DEFAULT NULL,
  `cp_created_at` datetime DEFAULT current_timestamp(),
  `cp_updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cp_status_id` smallint(6) DEFAULT NULL,
  `cp_data_source_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `cp_utm_source` varchar(250) DEFAULT NULL,
  `cp_utm_medium` varchar(250) DEFAULT NULL,
  `cp_utm_campaign` varchar(250) DEFAULT NULL,
  `cp_utm_term` varchar(250) DEFAULT NULL,
  `cp_fcm_token` varchar(250) DEFAULT NULL,
  `cp_login_fcm_token` varchar(250) DEFAULT NULL,
  `cp_ip_address` varchar(250) DEFAULT NULL,
  `cp_app_src_id` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1=>ANDROID,2=>IOS',
  `cp_data_delete_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '0=>NO,1=>YES',
  `cp_data_delete_datetime` datetime DEFAULT NULL,
  `cp_doable_to_application_status` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '0=>Customer, 1=>Campaign, 2=> Self Model, 3=> Assisted Model',
  `cp_obligations` double DEFAULT NULL,
  `cp_device_id` varchar(200) DEFAULT NULL,
  `cp_utm_source_updated_date` datetime DEFAULT NULL,
  `cp_is_mobile_verified` tinyint(1) NOT NULL DEFAULT 0,
  `utm_click_id` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `customer_profile`
--


-- --------------------------------------------------------

--
-- Table structure for table `docs`
--

CREATE TABLE `docs` (
  `docs_id` bigint(20) UNSIGNED NOT NULL,
  `lead_id` bigint(20) UNSIGNED NOT NULL,
  `application_no` varchar(50) DEFAULT NULL,
  `company_id` mediumint(8) UNSIGNED DEFAULT 1,
  `customer_id` varchar(20) DEFAULT NULL,
  `pancard` varchar(15) DEFAULT NULL,
  `mobile` bigint(20) UNSIGNED DEFAULT NULL,
  `docs_type` varchar(255) DEFAULT '',
  `sub_docs_type` varchar(255) DEFAULT NULL,
  `pwd` varchar(100) DEFAULT NULL,
  `file` varchar(255) DEFAULT NULL,
  `ip` varchar(255) DEFAULT NULL,
  `created_on` datetime NOT NULL DEFAULT current_timestamp(),
  `upload_by` int(11) DEFAULT NULL,
  `removed_by` int(11) DEFAULT NULL,
  `removed_date` datetime DEFAULT NULL,
  `docs_active` tinyint(3) UNSIGNED DEFAULT 1,
  `docs_deleted` tinyint(3) UNSIGNED DEFAULT 0,
  `docs_novel_return_id` varchar(50) DEFAULT NULL,
  `docs_master_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `docs_aadhaar_masked` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '1=>Yes'
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `docs`
--


-- --------------------------------------------------------

--
-- Table structure for table `docs_download_logs`
--

CREATE TABLE `docs_download_logs` (
  `ddl_id` bigint(20) UNSIGNED NOT NULL,
  `ddl_lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ddl_document_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ddl_user_id` int(10) UNSIGNED DEFAULT NULL,
  `ddl_user_role_id` int(10) UNSIGNED DEFAULT NULL,
  `ddl_user_platform` varchar(500) DEFAULT NULL,
  `ddl_user_browser` varchar(500) DEFAULT NULL,
  `ddl_user_agent` varchar(500) DEFAULT NULL,
  `ddl_user_ip` varchar(50) DEFAULT NULL,
  `ddl_created_on` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `docs_master`
--

CREATE TABLE `docs_master` (
  `id` int(10) UNSIGNED NOT NULL COMMENT 'DOCS ID',
  `heading` varchar(200) NOT NULL,
  `docs_type` varchar(200) NOT NULL COMMENT 'DOCS TYPE',
  `docs_sub_type` varchar(200) NOT NULL COMMENT 'DOCS SUB TYPE',
  `docs_required` int(11) NOT NULL,
  `created_on` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'MASTER CREATED ON',
  `updated_on` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'MASTER UPDATED ON',
  `document_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `document_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `utility_flag` tinyint(4) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `docs_master`
--


-- --------------------------------------------------------

--
-- Table structure for table `export_access_logs`
--

CREATE TABLE `export_access_logs` (
  `eal_id` bigint(20) NOT NULL,
  `eal_export_id` int(10) UNSIGNED NOT NULL COMMENT 'master_export id',
  `eal_start_date` date DEFAULT NULL,
  `eal_end_date` date DEFAULT NULL,
  `eal_created_on` datetime NOT NULL,
  `eal_active` tinyint(4) NOT NULL DEFAULT 1,
  `eal_deleted` tinyint(4) NOT NULL DEFAULT 0,
  `eal_user_id` int(10) UNSIGNED DEFAULT NULL,
  `eal_user_platform` varchar(500) DEFAULT NULL,
  `eal_user_browser` varchar(500) DEFAULT NULL,
  `eal_user_agent` varchar(500) DEFAULT NULL,
  `eal_user_ip` varchar(50) DEFAULT NULL,
  `eal_user_role_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `export_access_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `export_schedule_log`
--

CREATE TABLE `export_schedule_log` (
  `esl_id` bigint(20) NOT NULL,
  `esl_export_id` int(10) UNSIGNED NOT NULL,
  `esl_file_name` varchar(255) DEFAULT NULL,
  `esl_available` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Available',
  `esl_start_date` date DEFAULT NULL,
  `esl_end_date` date DEFAULT NULL,
  `esl_created_on` datetime DEFAULT current_timestamp(),
  `esl_user_id` int(11) NOT NULL,
  `esl_expiry_date` datetime DEFAULT NULL,
  `esl_ip` varchar(255) DEFAULT NULL,
  `esl_platform` varchar(255) DEFAULT NULL,
  `esl_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `esl_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `feedback`
--

CREATE TABLE `feedback` (
  `id` int(11) NOT NULL,
  `feedback_id` varchar(50) DEFAULT NULL,
  `feedback_remark` longtext DEFAULT NULL,
  `feedback_attachment` varchar(255) DEFAULT NULL,
  `feedback_ext` varchar(20) DEFAULT NULL,
  `feedback_active` tinyint(1) NOT NULL DEFAULT 1,
  `feedback_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `feedback_created_on` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `icici_collection_log`
--

CREATE TABLE `icici_collection_log` (
  `id` int(11) NOT NULL,
  `order_id` varchar(200) NOT NULL,
  `rrn` text NOT NULL,
  `amount` bigint(20) NOT NULL,
  `loan_number` varchar(200) NOT NULL,
  `pan_number` varchar(200) NOT NULL,
  `status` tinyint(4) NOT NULL DEFAULT 0 COMMENT '0=pending,1=success,2=failed',
  `call_back_response` text DEFAULT NULL,
  `call_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_time` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_time` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `leads`
--

CREATE TABLE `leads` (
  `lead_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` varchar(20) DEFAULT NULL,
  `company_id` smallint(5) UNSIGNED NOT NULL DEFAULT 1,
  `product_id` smallint(5) UNSIGNED NOT NULL DEFAULT 1,
  `application_no` varchar(255) DEFAULT NULL,
  `loan_no` varchar(20) DEFAULT NULL,
  `purpose` varchar(100) DEFAULT NULL,
  `user_type` enum('NEW','REPEAT','UNPAID-REPEAT') DEFAULT NULL,
  `first_name` varchar(50) DEFAULT NULL,
  `mobile` bigint(20) UNSIGNED DEFAULT NULL,
  `lead_is_mobile_verified` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>verified',
  `bank_linked_mobile` varchar(15) DEFAULT NULL COMMENT 'AA mobile linked in Bank',
  `pancard` varchar(15) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `otp` int(11) DEFAULT NULL,
  `alternate_email` varchar(150) DEFAULT NULL,
  `loan_amount` double(10,2) DEFAULT NULL,
  `monthly_salary_amount` double(10,2) DEFAULT NULL,
  `tenure` int(11) DEFAULT NULL,
  `cibil` int(11) DEFAULT NULL,
  `check_cibil_status` int(11) DEFAULT NULL,
  `lead_credeau_status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 => Approve, 2 => Proceed to Bank, 3 => Reject',
  `lead_credeau_approved_amount` varchar(10) DEFAULT NULL COMMENT 'lead_credeau_approved_amount ',
  `obligations` double(10,2) DEFAULT NULL,
  `promocode` varchar(15) DEFAULT NULL,
  `source` varchar(50) DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `lead_branch_id` int(10) UNSIGNED DEFAULT NULL,
  `state_id` int(11) DEFAULT NULL,
  `city_id` int(10) UNSIGNED DEFAULT NULL,
  `pincode` int(10) UNSIGNED DEFAULT NULL,
  `term_and_condition` varchar(255) DEFAULT NULL,
  `coordinates` varchar(150) DEFAULT NULL,
  `status` enum('LEAD-NEW','LEAD-INPROCESS','LEAD-HOLD','APPLICATION-NEW','APPLICATION-INPROCESS','APPLICATION-HOLD','DUPLICATE','SYSTEM-REJECT','REJECT','APPLICATION-RECOMMENDED','APPLICATION-SEND-BACK','SANCTION','DISBURSE-PENDING','DISBURSED','CANCEL','PART-PAYMENT','CLOSED','SETTLED','WRITEOFF','DISBURSAL-NEW','DISBURSAL-INPROCESS','DISBURSAL-HOLD','DISBURSED-WAIVED','DISBURSAL-SEND-BACK','LEAD-REGISTRATION','LEAD-PARTIAL','AUDIT-NEW','AUDIT-INPROCESS','AUDIT-HOLD','AUDIT-RECOMMENDED','TEST-LEAD') NOT NULL,
  `stage` enum('S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12','S13','S14','S15','S16','S17','S18','S19','S20','S21','S22','S25','S30','S31','S32','S33','S34','S49') NOT NULL,
  `lead_status_id` int(10) UNSIGNED DEFAULT NULL,
  `remark` varchar(500) DEFAULT NULL,
  `utm_source` varchar(256) DEFAULT NULL,
  `utm_campaign` varchar(255) DEFAULT NULL,
  `utm_medium` varchar(255) DEFAULT NULL,
  `utm_term` varchar(255) DEFAULT NULL,
  `utm_content` varchar(255) DEFAULT NULL,
  `utm_click_id` varchar(50) DEFAULT NULL,
  `ip` varchar(255) DEFAULT NULL,
  `imei_no` varchar(255) DEFAULT NULL,
  `application_status` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '''0''=>''can''t recommend'', ''1''=> ''Can Recommend''',
  `lead_application_created_on` datetime DEFAULT NULL,
  `created_on` datetime NOT NULL,
  `updated_on` datetime DEFAULT NULL,
  `qde_consent` char(1) DEFAULT NULL COMMENT 'Y=> yes',
  `lead_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `lead_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `lead_entry_date` date DEFAULT NULL,
  `lead_data_source_id` mediumint(9) DEFAULT NULL,
  `lead_fi_scm_residence_assign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_fi_residence_status_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT '1=>pending,2=>postive,3=>negative',
  `lead_fi_scm_office_assign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_fi_office_status_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT '1=>pending,2=>postive,3=>negative',
  `lead_mobile_android_id` varchar(500) DEFAULT NULL,
  `lead_fi_executive_residence_assign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_fi_executive_office_assign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `schedule_time` datetime DEFAULT NULL,
  `lead_reference_no` varchar(15) DEFAULT NULL,
  `lead_screener_call_user_id` int(11) DEFAULT NULL,
  `lead_document_pending_status` tinyint(1) DEFAULT 0,
  `lead_screener_assign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_screener_assign_datetime` datetime DEFAULT NULL,
  `lead_screener_recommend_datetime` datetime DEFAULT NULL,
  `lead_credit_assign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_credit_assign_datetime` datetime DEFAULT NULL,
  `lead_credit_recommend_datetime` datetime DEFAULT NULL,
  `lead_credithead_assign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_credithead_assign_datetime` datetime DEFAULT NULL,
  `lead_credit_approve_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_credit_approve_datetime` datetime DEFAULT NULL,
  `lead_sendback_user_id` int(11) DEFAULT NULL,
  `lead_recommend_sendback_flag` tinyint(4) DEFAULT NULL,
  `lead_recommend_sendback_datetime` datetime DEFAULT NULL,
  `lead_scm_assign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_scm_assign_datetime` datetime DEFAULT NULL,
  `lead_cfe_assign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_cfe_assign_datetime` datetime DEFAULT NULL,
  `lead_collection_executive_assign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_collection_executive_assign_datetime` datetime DEFAULT NULL,
  `lead_closure_assign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_closure_assign_datetime` datetime DEFAULT NULL,
  `lead_doable_to_application_status` tinyint(4) DEFAULT NULL COMMENT '0=>Customer, 1=>Campaign, 2=> Self Model, 3=> Assisted Model ',
  `scheduled_date` datetime DEFAULT NULL,
  `lead_disbursal_assign_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_disbursal_assign_datetime` datetime DEFAULT NULL,
  `lead_disbursal_recommend_datetime` datetime DEFAULT NULL,
  `lead_disbursal_approve_user_id` int(11) DEFAULT NULL,
  `lead_disbursal_approve_datetime` datetime DEFAULT NULL,
  `lead_final_disbursed_date` date DEFAULT NULL,
  `lead_audit_assign_user_id` smallint(5) UNSIGNED DEFAULT NULL,
  `lead_audit_assign_date_time` datetime DEFAULT NULL,
  `audit_send_back` smallint(5) UNSIGNED DEFAULT 0,
  `lead_rejected_reason_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_rejected_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_rejected_datetime` datetime DEFAULT NULL,
  `lead_black_list_flag` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `lead_stp_flag` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Lead Straight-Through Processing',
  `lead_rejected_assign_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `lead_rejected_assign_datetime` datetime DEFAULT NULL,
  `lead_rejected_assign_counter` smallint(5) UNSIGNED NOT NULL DEFAULT 0,
  `lead_journey_type_id` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1=>Web,2=>App',
  `lead_journey_stage_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT 'master_journey_stage',
  `eligibility` tinyint(4) DEFAULT NULL,
  `lead_customer_profile_id` bigint(20) UNSIGNED DEFAULT NULL,
  `lead_audit_head_assign_user_id` mediumint(9) DEFAULT NULL,
  `lead_audit_head_assign_datetime` datetime DEFAULT NULL,
  `lead_direct_disbursal` tinyint(4) DEFAULT NULL COMMENT '1=>Yes',
  `lead_creation_mode` tinyint(1) NOT NULL DEFAULT 0,
  `lead_process_mode` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `leads`
--


-- --------------------------------------------------------

--
-- Table structure for table `leads_otp_trans`
--

CREATE TABLE `leads_otp_trans` (
  `lot_id` bigint(20) UNSIGNED NOT NULL,
  `lot_lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `lot_provider` varchar(255) DEFAULT NULL,
  `lot_user_id` int(11) DEFAULT NULL,
  `lot_mobile_no` bigint(20) UNSIGNED NOT NULL,
  `lot_mobile_otp` varchar(10) NOT NULL,
  `lot_mobile_otp_type` smallint(5) UNSIGNED DEFAULT NULL COMMENT '1=>QDE Form',
  `lot_otp_trigger_time` datetime NOT NULL,
  `lot_otp_verify_flag` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `lot_otp_verify_time` datetime DEFAULT NULL,
  `lot_otp_valid_time` int(11) DEFAULT NULL,
  `lot_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `lot_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `lot_profile_id` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `leads_otp_trans`
--


-- --------------------------------------------------------

--
-- Table structure for table `lead_bre_rule_result`
--

CREATE TABLE `lead_bre_rule_result` (
  `lbrr_id` bigint(20) UNSIGNED NOT NULL,
  `lbrr_lead_id` bigint(20) UNSIGNED NOT NULL,
  `lbrr_rule_id` int(10) UNSIGNED NOT NULL,
  `lbrr_rule_name` varchar(200) NOT NULL,
  `lbrr_rule_cutoff_value` varchar(500) NOT NULL,
  `lbrr_rule_actual_value` varchar(500) NOT NULL,
  `lbrr_rule_relevant_inputs` varchar(500) NOT NULL,
  `lbrr_rule_system_decision_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>Approved, 2=>Referred,3=>Rejected',
  `lbrr_rule_manual_decision_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>Approve, 2=>Refer,3=>Reject',
  `lbrr_rule_manual_decision_remarks` varchar(1000) DEFAULT NULL,
  `lbrr_created_on` datetime NOT NULL,
  `lbrr_updated_on` datetime DEFAULT NULL,
  `lbrr_active` tinyint(1) NOT NULL DEFAULT 1,
  `lbrr_deleted` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `lead_bre_rule_result`
--


-- --------------------------------------------------------

--
-- Table structure for table `lead_customer`
--

CREATE TABLE `lead_customer` (
  `customer_seq_id` bigint(20) UNSIGNED NOT NULL,
  `customer_lead_id` bigint(20) UNSIGNED NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `sur_name` varchar(100) DEFAULT NULL,
  `gender` enum('MALE','FEMALE') DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `pancard` varchar(15) DEFAULT NULL,
  `pancard_verified_status` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>Yes',
  `pancard_verified_on` datetime DEFAULT NULL,
  `pancard_ocr_verified_status` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>Yes',
  `pancard_ocr_verified_on` datetime DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `email_verified_status` varchar(10) DEFAULT NULL,
  `email_verified_on` datetime DEFAULT NULL,
  `alternate_email` varchar(255) DEFAULT NULL,
  `alternate_email_verified_status` varchar(10) DEFAULT NULL,
  `alternate_email_verified_on` datetime DEFAULT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `mobile_verified_status` varchar(20) DEFAULT NULL,
  `alternate_mobile` bigint(20) UNSIGNED DEFAULT NULL,
  `otp` mediumint(8) UNSIGNED DEFAULT NULL,
  `current_house` varchar(255) DEFAULT NULL,
  `current_locality` varchar(255) DEFAULT NULL,
  `current_landmark` varchar(255) DEFAULT NULL,
  `cr_residence_pincode` mediumint(8) UNSIGNED DEFAULT NULL COMMENT 'Current residence pincode',
  `current_district` varchar(100) DEFAULT NULL,
  `current_state` varchar(255) DEFAULT NULL,
  `current_city` varchar(255) DEFAULT NULL,
  `aa_same_as_current_address` varchar(20) DEFAULT NULL,
  `aa_current_house` varchar(255) DEFAULT NULL,
  `aa_current_locality` varchar(255) DEFAULT NULL,
  `aa_current_landmark` varchar(255) DEFAULT NULL,
  `aa_cr_residence_pincode` mediumint(8) UNSIGNED DEFAULT NULL,
  `aa_current_district` varchar(255) DEFAULT NULL,
  `aa_current_state` varchar(255) DEFAULT NULL,
  `aa_current_city` varchar(255) DEFAULT NULL,
  `aa_current_state_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `aa_current_city_id` int(10) UNSIGNED DEFAULT NULL,
  `aa_current_eaadhaar_address` varchar(500) DEFAULT NULL,
  `current_residence_since` varchar(255) DEFAULT NULL,
  `current_residence_type` varchar(255) DEFAULT NULL,
  `current_residing_withfamily` varchar(255) DEFAULT NULL,
  `current_res_status` varchar(10) DEFAULT NULL,
  `created_date` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `state_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT 'Residence state id',
  `city_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Residence city id',
  `customer_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `customer_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `aadhar_no` varchar(20) DEFAULT NULL,
  `customer_religion_id` int(10) UNSIGNED DEFAULT NULL,
  `father_name` varchar(50) DEFAULT NULL,
  `aadhaar_ocr_verified_status` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1=>Yes',
  `aadhaar_ocr_verified_on` datetime DEFAULT NULL,
  `customer_ekyc_request_initiated_on` datetime DEFAULT NULL,
  `customer_ekyc_request_ip` varchar(50) DEFAULT NULL,
  `customer_digital_ekyc_flag` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '1=>Yes',
  `customer_digital_ekyc_done_on` datetime DEFAULT NULL,
  `aadhar_no_old` varchar(20) DEFAULT NULL,
  `customer_docs_available` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '1=>Customer, 2=>Executive',
  `customer_appointment_schedule` datetime DEFAULT NULL,
  `customer_appointment_remark` varchar(500) DEFAULT NULL,
  `customer_lead_finbox_cust_id` varchar(50) DEFAULT NULL,
  `customer_marital_status_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `customer_spouse_name` varchar(100) DEFAULT NULL,
  `customer_spouse_occupation_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `customer_qualification_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `customer_bre_run_flag` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '1=>Yes',
  `customer_bre_run_datetime` datetime DEFAULT NULL,
  `customer_adjust_adid` varchar(100) DEFAULT NULL COMMENT 'adjust device id',
  `customer_adjust_gps_adid` varchar(100) DEFAULT NULL COMMENT 'adjust google id',
  `customer_adjust_idfa` varchar(100) DEFAULT NULL COMMENT 'adjust ios id',
  `customer_electrical_bill_fetch_flag` tinyint(4) DEFAULT NULL,
  `customer_electrical_bill_fectched_on` datetime DEFAULT NULL,
  `customer_vkyc_flag` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `customer_vkyc_completed_on` datetime DEFAULT NULL,
  `customer_domain_flag` tinyint(4) NOT NULL DEFAULT 0,
  `customer_domain_verified_on` datetime DEFAULT NULL,
  `customer_domain_request_ip` varchar(20) DEFAULT NULL,
  `customer_uan_flag` int(11) NOT NULL DEFAULT 0,
  `customer_uan_verified_on` datetime DEFAULT NULL,
  `customer_enach_flag` tinyint(4) DEFAULT NULL COMMENT '1 = Registered, 2 = Active, 3 = Inactive',
  `customer_enach_verified_on` datetime DEFAULT NULL,
  `credeau_executed_flag` tinyint(4) NOT NULL DEFAULT 0,
  `credeau_decision` varchar(20) DEFAULT NULL,
  `credeau_executed_datetime` datetime DEFAULT NULL,
  `credeau_approved_amount` bigint(20) DEFAULT NULL,
  `credeau_risk_grade` tinyint(4) DEFAULT NULL,
  `customer_face_match_flag` tinyint(4) DEFAULT NULL,
  `customer_face_match_verified_on` datetime DEFAULT NULL,
  `customer_face_match_percentage` varchar(5) DEFAULT NULL,
  `customer_live_location_flag` tinyint(4) DEFAULT 0,
  `customer_live_location_address` varchar(255) DEFAULT NULL,
  `customer_live_location_address_datetime` datetime DEFAULT NULL,
  `customer_current_aadhaar_residence_distance` varchar(10) DEFAULT NULL,
  `customer_live_location_coordinates` varchar(250) DEFAULT NULL,
  `aa_aadhaar_address_coordinates` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `lead_customer`
--


-- --------------------------------------------------------

--
-- Table structure for table `lead_customer_references`
--

CREATE TABLE `lead_customer_references` (
  `lcr_id` bigint(20) UNSIGNED NOT NULL,
  `lcr_lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `lcr_name` varchar(100) DEFAULT NULL,
  `lcr_relationType` mediumint(8) UNSIGNED DEFAULT NULL,
  `ref_type` int(11) NOT NULL DEFAULT 0 COMMENT '''1''=>''Customers'',''2''=>''Employees''',
  `lcr_mobile` bigint(20) NOT NULL,
  `lcr_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `lcr_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `lcr_created_by` int(10) UNSIGNED DEFAULT NULL,
  `lcr_created_on` timestamp NOT NULL DEFAULT current_timestamp(),
  `lcr_udpated_by` int(10) UNSIGNED DEFAULT NULL,
  `lcr_updated_on` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `lead_customer_references`
--


-- --------------------------------------------------------

--
-- Table structure for table `lead_disbursement_trans_log`
--

CREATE TABLE `lead_disbursement_trans_log` (
  `disb_trans_id` int(10) UNSIGNED NOT NULL,
  `disb_trans_lead_id` bigint(20) UNSIGNED NOT NULL,
  `disb_trans_reference_no` varchar(50) DEFAULT NULL,
  `disb_trans_bank_id` mediumint(9) NOT NULL,
  `disb_trans_payment_mode_id` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1=>Online,2=>Offline',
  `disb_trans_payment_type_id` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1=>IMPS,2=>NEFT',
  `disb_trans_status_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT '1=>initiated.2=>pending,3=>failed,4=>hold,5=>completed',
  `disb_trans_created_by` int(10) UNSIGNED DEFAULT NULL,
  `disb_trans_created_on` datetime NOT NULL,
  `disb_trans_updated_by` int(10) UNSIGNED DEFAULT NULL,
  `disb_trans_updated_on` datetime DEFAULT NULL,
  `disb_trans_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `disb_trans_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `lead_disbursement_trans_log`
--


-- --------------------------------------------------------

--
-- Table structure for table `lead_eligibility_rules_result`
--

CREATE TABLE `lead_eligibility_rules_result` (
  `lerr_id` bigint(20) NOT NULL,
  `lerr_dob_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Pass,2=>Fail',
  `lerr_city_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Pass,2=>Fail',
  `lerr_state_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Pass,2=>Fail',
  `lerr_cust_blacklisted_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Pass,2=>Fail',
  `lerr_cust_reject_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Pass,2=>Fail',
  `lerr_cust_repeat_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Pass,2=>Fail',
  `lerr_active` tinyint(4) NOT NULL DEFAULT 1 COMMENT '1=>Pass,2=>Fail',
  `lerr_deleted` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Pass,2=>Fail',
  `lerr_cust_income_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Pass,2=>Fail',
  `lerr_emp_type_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Pass,2=>Fail',
  `lerr_cust_duplicate_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Pass,2=>Fail',
  `lerr_loan_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Pass,2=>Fail',
  `lerr_lead_id` tinyint(4) DEFAULT NULL COMMENT '1=>Pass,2=>Fail',
  `lerr_created_on` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `lead_eligibility_rules_result`
--


-- --------------------------------------------------------

--
-- Table structure for table `lead_followup`
--

CREATE TABLE `lead_followup` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `lead_id` bigint(20) UNSIGNED NOT NULL,
  `status` varchar(255) DEFAULT NULL,
  `stage` varchar(20) DEFAULT NULL,
  `lead_followup_status_id` int(10) UNSIGNED DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `customer_id` varchar(100) DEFAULT NULL,
  `scheduled_date` varchar(255) DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `lead_followup_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `lead_followup_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `created_on` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_on` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `lead_followup`
--


-- --------------------------------------------------------

--
-- Table structure for table `lead_journey_events`
--

CREATE TABLE `lead_journey_events` (
  `lje_id` bigint(20) UNSIGNED NOT NULL,
  `lje_lead_id` bigint(20) DEFAULT NULL,
  `lje_profile_id` bigint(20) DEFAULT NULL,
  `lje_journey_type_id` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1=>Web,2=>App',
  `lje_login` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_otp_verify` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_resend_otp` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_residence_pincode` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_pancard_verification` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_income_details` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_personal_details` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_residence_details` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_promocode` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_selfie_upload` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_registration_successful` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_generate_loan_quote` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_employment_work_mode` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_employment_details` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_ekyc_initiated` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_ekyc_verified` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_ekyc_skipped` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_bank_statement_upload` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_pay_slip_upload` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_pan_upload` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_aadhaar_upload` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_residence_proof_upload` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_banking_details` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_loan_quotation_decision` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_thank_you` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_eligibility_failed` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_reject` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_created_at` datetime DEFAULT NULL,
  `lje_updated_at` datetime DEFAULT NULL,
  `lje_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `lje_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `lje_check_eligibility` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_account_aggregator` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_account_aggregator_verify` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '0=>No,1=>Yes',
  `lje_eligibility_confirmed` tinyint(3) UNSIGNED DEFAULT 0,
  `lje_account_aggregator_skipped` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `lje_ekyc` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `lead_journey_events`
--


-- --------------------------------------------------------

--
-- Table structure for table `lead_rejection_reasons`
--

CREATE TABLE `lead_rejection_reasons` (
  `lrr_id` bigint(20) UNSIGNED NOT NULL,
  `lrr_lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `lrr_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lrr_rejected_reason_id` int(10) UNSIGNED DEFAULT NULL,
  `lrr_rejected_remarks` varchar(100) DEFAULT NULL,
  `lrr_rejected_datetime` datetime DEFAULT NULL,
  `lrr_active` tinyint(4) DEFAULT 1,
  `lrr_deleted` tinyint(4) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `lead_rejection_reasons`
--


-- --------------------------------------------------------

--
-- Table structure for table `lead_sms_logs`
--

CREATE TABLE `lead_sms_logs` (
  `lsl_id` bigint(20) UNSIGNED NOT NULL,
  `lsl_lead_id` bigint(20) UNSIGNED NOT NULL,
  `lsl_sms_type_id` mediumint(8) UNSIGNED NOT NULL,
  `lsl_sms_mobile` bigint(20) UNSIGNED NOT NULL,
  `lsl_sms_content` text DEFAULT NULL,
  `lsl_api_status_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `lsl_errors` varchar(500) DEFAULT NULL,
  `lsl_user_id` int(10) UNSIGNED DEFAULT NULL,
  `lsl_created_on` datetime NOT NULL,
  `lsl_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `lsl_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `legal_email_logs`
--

CREATE TABLE `legal_email_logs` (
  `legal_email_log_id` bigint(20) UNSIGNED NOT NULL,
  `legal_email_provider` varchar(50) DEFAULT NULL,
  `legal_email_type_id` mediumint(8) UNSIGNED NOT NULL COMMENT '1=>Legal Email',
  `legal_email_sent_to` varchar(150) NOT NULL,
  `legal_email_sent_cc` varchar(500) DEFAULT NULL,
  `legal_email_sent_bcc` varchar(150) NOT NULL,
  `legal_email_content` text DEFAULT NULL,
  `legal_email_api_status_id` mediumint(8) UNSIGNED DEFAULT NULL COMMENT '1=>Success,2=>Api Error,3=>Conn Error,4=>LW Error',
  `legal_notice_send_by` int(11) DEFAULT NULL,
  `legal_email_errors` varchar(500) DEFAULT NULL,
  `legal_email_loan_no` varchar(50) DEFAULT NULL,
  `legal_email_lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `legal_email_created_on` datetime NOT NULL,
  `legal_email_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `legal_email_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `lists_of_masters`
--

CREATE TABLE `lists_of_masters` (
  `master_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Master ID',
  `company_id` int(10) UNSIGNED NOT NULL COMMENT 'COMPANY ID',
  `product_id` int(10) UNSIGNED NOT NULL COMMENT 'PRODUCT ID',
  `borrower_type` varchar(20) DEFAULT NULL COMMENT 'BORROWER TYPE (USER)',
  `gender_type` varchar(20) DEFAULT NULL COMMENT 'GENDER TYPE',
  `residence_type` varchar(100) DEFAULT NULL COMMENT 'RESIDENCE TYPE',
  `area` varchar(100) DEFAULT NULL COMMENT 'AREA',
  `employer_type` varchar(100) DEFAULT NULL COMMENT 'EMPLOYER TYPE',
  `account_type` varchar(100) DEFAULT NULL COMMENT 'ACCOUNT TYPE',
  `account_verify_status` varchar(100) DEFAULT NULL COMMENT 'ACCOUNT VERIFY STATUS',
  `ntc` varchar(100) DEFAULT NULL COMMENT 'NTC',
  `job_stability` varchar(100) DEFAULT NULL COMMENT 'JOB STABILITY',
  `end_use` varchar(100) DEFAULT NULL COMMENT 'END-USE',
  `salary_on_time` varchar(100) DEFAULT NULL COMMENT 'SALARY ON TIME',
  `scheme` varchar(100) DEFAULT NULL COMMENT 'SCHEME',
  `b2b_disb` varchar(100) DEFAULT NULL COMMENT 'B2B DISB',
  `payment_mode` varchar(50) DEFAULT NULL COMMENT 'PAYMENT MODE',
  `payable_account` varchar(100) DEFAULT NULL COMMENT 'PAYABLE ACCOUNT',
  `created_by` int(10) UNSIGNED NOT NULL COMMENT 'MASTER CREATED BY',
  `created_on` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'MASTER CREATED DATE',
  `updated_by` int(10) UNSIGNED NOT NULL COMMENT 'MASTER UPDATED BY',
  `updated_on` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'MASTER UPDATED DATE',
  `refrence_details` varchar(45) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `loan`
--

CREATE TABLE `loan` (
  `loan_id` int(10) UNSIGNED NOT NULL,
  `company_id` mediumint(8) UNSIGNED DEFAULT 1,
  `product_id` mediumint(8) UNSIGNED DEFAULT 1,
  `lead_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` varchar(20) DEFAULT NULL,
  `loan_no` varchar(20) DEFAULT NULL,
  `recommended_amount` double DEFAULT NULL,
  `company_account_no` varchar(255) DEFAULT NULL,
  `disburse_refrence_no` varchar(255) DEFAULT NULL,
  `screenshot` varchar(255) DEFAULT NULL,
  `remarks` varchar(500) DEFAULT NULL,
  `status` varchar(255) NOT NULL,
  `loan_status_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `loanAgreementLetter` text DEFAULT NULL,
  `loanAgreementRequest` varchar(20) DEFAULT NULL,
  `agrementRequestedDate` varchar(30) DEFAULT NULL,
  `loanAgreementResponse` varchar(20) DEFAULT NULL,
  `agrementUserIP` varchar(20) DEFAULT NULL,
  `agrementResponseDate` varchar(30) DEFAULT NULL,
  `company_ac_no_no_use` varchar(20) DEFAULT NULL,
  `mode_of_payment` varchar(255) DEFAULT NULL,
  `channel` varchar(255) DEFAULT NULL,
  `ip` varchar(20) DEFAULT NULL,
  `sms` varchar(255) DEFAULT NULL,
  `mail` varchar(255) DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `created_on` datetime DEFAULT NULL,
  `updated_by` int(10) UNSIGNED DEFAULT NULL,
  `updated_on` varchar(255) DEFAULT NULL,
  `loan_active` tinyint(3) UNSIGNED DEFAULT 1,
  `loan_deleted` tinyint(3) UNSIGNED DEFAULT 0,
  `loan_disbursement_bank_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `loan_disbursement_trans_status_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'disbursement trans api status',
  `loan_disbursement_trans_status_datetime` datetime DEFAULT NULL,
  `loan_disbursement_trans_log_id` bigint(20) UNSIGNED DEFAULT NULL,
  `loan_disbursement_payment_mode_id` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1=>Online,2=>Offline',
  `loan_disbursement_payment_type_id` tinyint(3) UNSIGNED DEFAULT NULL COMMENT ' 1=>IMPS,2=>NEFT',
  `loan_disburse_waive_user_id` int(10) UNSIGNED DEFAULT NULL,
  `loan_disburse_waive_datetime` datetime DEFAULT NULL,
  `loan_noc_letter_sent_status` tinyint(3) UNSIGNED DEFAULT NULL,
  `loan_noc_letter_sent_datetime` datetime DEFAULT NULL,
  `loan_noc_letter_sent_user_id` int(10) UNSIGNED DEFAULT NULL,
  `loan_recovery_status_id` tinyint(3) UNSIGNED DEFAULT NULL COMMENT '1 => Collection Pending, 2 => Recovery Pending, 3 => Legal ',
  `loan_bureau_report_flag` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '1=>active Loan;2=>Loan Closed',
  `loan_bureau_report_datetime` datetime DEFAULT NULL,
  `loan_principle_payable_amount` double DEFAULT 0,
  `loan_interest_payable_amount` double DEFAULT 0,
  `loan_penalty_payable_amount` double DEFAULT 0,
  `loan_principle_received_amount` double DEFAULT 0,
  `loan_interest_received_amount` double DEFAULT 0,
  `loan_penalty_received_amount` double DEFAULT 0,
  `loan_principle_discount_amount` double DEFAULT 0,
  `loan_interest_discount_amount` double DEFAULT 0,
  `loan_penalty_discount_amount` double DEFAULT 0,
  `loan_principle_outstanding_amount` double DEFAULT 0,
  `loan_interest_outstanding_amount` double DEFAULT 0,
  `loan_penalty_outstanding_amount` double DEFAULT 0,
  `loan_total_payable_amount` double DEFAULT 0,
  `loan_total_received_amount` double DEFAULT 0,
  `loan_total_discount_amount` double DEFAULT 0,
  `loan_total_outstanding_amount` double DEFAULT 0,
  `loan_closure_date` date DEFAULT NULL,
  `loan_settled_date` date DEFAULT NULL,
  `loan_writeoff_date` date DEFAULT NULL,
  `loan_disbursal_letter` varchar(255) DEFAULT NULL,
  `legal_notice_letter` varchar(200) DEFAULT NULL,
  `loan_noc_settlement_letter` varchar(255) DEFAULT NULL,
  `loan_noc_closing_letter` varchar(255) DEFAULT NULL,
  `loan_noc_settled_letter_user_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `loan_noc_settled_letter_datetime` datetime DEFAULT NULL,
  `loan_noc_closed_letter_user_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `loan_noc_closed_letter_datetime` datetime DEFAULT NULL,
  `loan_executive_reloan_flag` tinyint(4) NOT NULL DEFAULT 0,
  `loan_executive_reloan_remark` varchar(500) DEFAULT NULL,
  `loan_executive_reloan_user_id` int(11) DEFAULT NULL,
  `loan_enach_mandate_registration_no` varchar(255) DEFAULT NULL,
  `loan_enach_mandate_datetime` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `loan`
--


-- --------------------------------------------------------

--
-- Table structure for table `loan_collection_followup`
--

CREATE TABLE `loan_collection_followup` (
  `lcf_id` bigint(20) UNSIGNED NOT NULL,
  `lcf_lead_id` bigint(20) UNSIGNED NOT NULL,
  `lcf_type_id` int(10) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'FROM `master_followup_type`',
  `lcf_status_id` int(10) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'FROM `master_followup_status`',
  `lcf_remarks` varchar(500) DEFAULT NULL,
  `lcf_next_schedule_datetime` datetime DEFAULT NULL,
  `lcf_fe_upload_selfie` varchar(255) DEFAULT NULL COMMENT 'Fe=> Field executive upload selfie with customer ',
  `lcf_fe_upload_location` varchar(250) DEFAULT NULL COMMENT 'Fe=> Field executive upload customer location',
  `lcf_user_id` int(10) UNSIGNED NOT NULL,
  `lcf_created_on` datetime NOT NULL,
  `lcf_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `lcf_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `total_distance_covered` double DEFAULT NULL,
  `lcf_runo_call_log_id` varchar(50) DEFAULT NULL,
  `lcf_runo_call_mobile` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `logo`
--

CREATE TABLE `logo` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `company_id` int(10) UNSIGNED NOT NULL,
  `product_id` int(11) NOT NULL DEFAULT 2,
  `title` varchar(255) NOT NULL,
  `link` varchar(255) NOT NULL,
  `url` text NOT NULL,
  `image` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_api_provider`
--

CREATE TABLE `master_api_provider` (
  `id` mediumint(8) UNSIGNED NOT NULL,
  `name` varchar(50) DEFAULT NULL,
  `is_active` tinyint(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `master_api_provider`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_bank_account_status`
--

CREATE TABLE `master_bank_account_status` (
  `bas_id` mediumint(8) UNSIGNED NOT NULL,
  `bas_name` varchar(100) DEFAULT NULL,
  `bas_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `bas_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `bas_created_on` datetime DEFAULT NULL,
  `bas_updated_on` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_bank_account_status`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_bank_type`
--

CREATE TABLE `master_bank_type` (
  `m_bank_type_id` mediumint(8) UNSIGNED NOT NULL,
  `m_bank_type_name` varchar(150) NOT NULL,
  `m_bank_type_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_bank_type_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_bank_type`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_blacklist_reject_reason`
--

CREATE TABLE `master_blacklist_reject_reason` (
  `m_br_id` int(10) UNSIGNED NOT NULL,
  `m_br_name` varchar(100) NOT NULL,
  `m_br_created_on` datetime DEFAULT NULL,
  `m_br_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_br_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_blacklist_reject_reason`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_branch`
--

CREATE TABLE `master_branch` (
  `m_branch_id` mediumint(8) UNSIGNED NOT NULL,
  `m_branch_name` varchar(150) NOT NULL,
  `m_branch_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_branch_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_branch`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_bre_category`
--

CREATE TABLE `master_bre_category` (
  `m_bre_cat_id` int(10) UNSIGNED NOT NULL,
  `m_bre_cat_name` varchar(200) NOT NULL,
  `m_bre_cat_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_bre_cat_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_bre_category`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_bre_rule`
--

CREATE TABLE `master_bre_rule` (
  `m_bre_rule_id` int(10) UNSIGNED NOT NULL,
  `m_bre_rule_catgory_id` int(10) UNSIGNED NOT NULL,
  `m_bre_rule_name` varchar(200) NOT NULL,
  `m_bre_rule_description` varchar(500) DEFAULT NULL,
  `m_bre_rule_created_on` datetime NOT NULL,
  `m_bre_rule_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_bre_rule_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_bre_rule`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_city`
--

CREATE TABLE `master_city` (
  `m_city_id` int(10) UNSIGNED NOT NULL,
  `m_city_name` varchar(150) NOT NULL,
  `m_city_code` varchar(20) DEFAULT NULL,
  `m_city_category` char(1) DEFAULT NULL,
  `m_city_state_id` mediumint(8) UNSIGNED NOT NULL,
  `m_city_branch_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 0,
  `m_city_is_sourcing` tinyint(3) UNSIGNED DEFAULT 0,
  `m_city_trial_sourcing` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Used for new opening city',
  `m_city_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_city_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_city`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_company_type`
--

CREATE TABLE `master_company_type` (
  `m_company_type_id` mediumint(8) UNSIGNED NOT NULL,
  `m_company_type_name` varchar(150) NOT NULL,
  `m_company_type_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_company_type_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_company_type`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_credentials`
--

CREATE TABLE `master_credentials` (
  `id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `provider_id` int(11) NOT NULL,
  `credentials_json` text DEFAULT NULL,
  `threshold_count` int(11) DEFAULT 0,
  `threshold_limit` int(11) DEFAULT 0,
  `prority` int(11) DEFAULT 0,
  `run_limit` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `master_credentials`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_data_source`
--

CREATE TABLE `master_data_source` (
  `data_source_id` mediumint(8) UNSIGNED NOT NULL,
  `data_source_name` varchar(100) NOT NULL,
  `data_source_code` varchar(10) NOT NULL,
  `data_source_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `data_source_deleted` tinyint(3) UNSIGNED DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_data_source`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_department`
--

CREATE TABLE `master_department` (
  `department_id` mediumint(8) UNSIGNED NOT NULL,
  `department_name` varchar(100) NOT NULL,
  `department_active` tinyint(1) NOT NULL DEFAULT 1,
  `department_deleted` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_department`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_designation`
--

CREATE TABLE `master_designation` (
  `m_designation_id` mediumint(8) UNSIGNED NOT NULL,
  `m_designation_name` varchar(150) NOT NULL,
  `m_designation_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_designation_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_designation`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_disbursement_banks`
--

CREATE TABLE `master_disbursement_banks` (
  `disb_bank_id` mediumint(8) UNSIGNED NOT NULL,
  `disb_bank_name` varchar(100) NOT NULL,
  `disb_bank_account_no` varchar(20) NOT NULL,
  `disb_bank_payment_type_id` tinyint(3) UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=>only IMPS,2=>Only NEFT,3=>Both',
  `disb_bank_imps_api_active` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1=>Availabe',
  `disb_bank_neft_api_active` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1=>Availabe',
  `disb_bank_created_by` int(10) UNSIGNED NOT NULL,
  `disb_bank_created_on` datetime NOT NULL,
  `disb_bank_updated_by` int(10) UNSIGNED DEFAULT NULL,
  `disb_bank_updated_on` datetime DEFAULT NULL,
  `disb_bank_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `disb_bank_deleted` tinyint(3) UNSIGNED DEFAULT 0,
  `disb_bank_nbfc_id` tinyint(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_disbursement_banks`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_electrical_provider`
--

CREATE TABLE `master_electrical_provider` (
  `electrical_pro_id` int(11) NOT NULL,
  `provider_name` varchar(250) DEFAULT NULL,
  `provider_des` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_electrical_provider`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_enduse`
--

CREATE TABLE `master_enduse` (
  `enduse_id` mediumint(8) UNSIGNED NOT NULL,
  `enduse_name` varchar(100) NOT NULL,
  `enduse_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `enduse_deleted` tinyint(3) UNSIGNED DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_enduse`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_export`
--

CREATE TABLE `master_export` (
  `m_export_id` int(10) UNSIGNED NOT NULL,
  `m_export_name` varchar(150) NOT NULL,
  `m_export_heading` varchar(150) NOT NULL,
  `m_export_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_export_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `m_export_created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `m_export_is_live` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_export`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_feedback_answers`
--

CREATE TABLE `master_feedback_answers` (
  `mfa_id` int(10) UNSIGNED NOT NULL,
  `mfa_answer` varchar(20) NOT NULL,
  `mfa_icons` varchar(200) NOT NULL,
  `mfa_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `mfa_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `mfa_created_on` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_feedback_answers`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_feedback_questions`
--

CREATE TABLE `master_feedback_questions` (
  `mfq_id` int(10) UNSIGNED NOT NULL,
  `mfq_question` varchar(500) NOT NULL,
  `mfq_active` tinyint(1) NOT NULL DEFAULT 1,
  `mfq_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `mfq_created_on` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_feedback_questions`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_followup_status`
--

CREATE TABLE `master_followup_status` (
  `m_followup_status_id` int(10) UNSIGNED NOT NULL,
  `m_followup_status_name` varchar(100) NOT NULL,
  `m_followup_status_heading` varchar(100) NOT NULL,
  `m_followup_status_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_followup_status_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `m_followup_status_created_on` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_followup_status`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_followup_type`
--

CREATE TABLE `master_followup_type` (
  `m_followup_type_id` int(10) UNSIGNED NOT NULL,
  `m_followup_type_name` varchar(100) NOT NULL,
  `m_followup_type_heading` varchar(100) NOT NULL,
  `m_followup_type_icons` varchar(50) DEFAULT NULL,
  `m_followup_type_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_followup_type_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `m_followup_type_created_on` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_followup_type`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_industry`
--

CREATE TABLE `master_industry` (
  `m_industry_id` mediumint(8) UNSIGNED NOT NULL,
  `m_industry_name` varchar(150) NOT NULL,
  `m_industry_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_industry_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_industry`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_journey_stage`
--

CREATE TABLE `master_journey_stage` (
  `m_journey_id` mediumint(8) UNSIGNED NOT NULL,
  `m_journey_type_id` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>WEB, 2=>App',
  `m_journey_stage` varchar(50) NOT NULL,
  `m_journey_code` varchar(50) DEFAULT NULL,
  `m_journey_active` tinyint(1) NOT NULL,
  `m_journey_deleted` tinyint(4) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_journey_stage`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_lms_menu`
--

CREATE TABLE `master_lms_menu` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `company_id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `menu_name` varchar(255) NOT NULL,
  `stage` varchar(45) NOT NULL,
  `route_link` varchar(255) NOT NULL,
  `menu_config` varchar(255) DEFAULT NULL,
  `menu_order` int(11) DEFAULT NULL,
  `icon` varchar(255) DEFAULT NULL,
  `box_bg_color` varchar(20) NOT NULL,
  `role_id` int(11) NOT NULL,
  `role` varchar(100) NOT NULL,
  `user_labels` varchar(100) NOT NULL,
  `is_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `created_by` int(10) UNSIGNED NOT NULL,
  `created_on` datetime NOT NULL,
  `updated_by` int(10) UNSIGNED NOT NULL,
  `updated_on` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_lms_menu`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_marital_status`
--

CREATE TABLE `master_marital_status` (
  `m_marital_status_id` mediumint(8) UNSIGNED NOT NULL,
  `m_marital_status_name` varchar(150) NOT NULL,
  `m_marital_status_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_marital_status_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_marital_status`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_marketing_channel`
--

CREATE TABLE `master_marketing_channel` (
  `mmc_id` int(10) UNSIGNED NOT NULL,
  `mmc_name` varchar(100) DEFAULT NULL,
  `mmc_type` tinyint(3) UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=>Main,2=>Others',
  `mmc_affiliate_model_type` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>Doable Lead, 2=> Disbursal,3=>Application',
  `mmc_affiliate_pricing` double(10,2) UNSIGNED NOT NULL DEFAULT 0.00,
  `mmc_affiliate_flag` tinyint(3) UNSIGNED NOT NULL COMMENT '1=>YES',
  `mmc_affiliate_mmp_pid_name` varchar(100) DEFAULT NULL,
  `mmc_affiliate_mmp_partner_name` varchar(100) DEFAULT NULL,
  `mmc_active` tinyint(3) UNSIGNED DEFAULT 1,
  `mmc_deleted` tinyint(3) UNSIGNED DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_marketing_channel`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_mis_report`
--

CREATE TABLE `master_mis_report` (
  `m_report_id` int(10) UNSIGNED NOT NULL,
  `m_report_name` varchar(150) NOT NULL,
  `m_report_heading` varchar(150) CHARACTER SET latin1 COLLATE latin1_spanish_ci NOT NULL,
  `m_report_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_report_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `m_report_created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `m_report_is_live` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_mis_report`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_occupation`
--

CREATE TABLE `master_occupation` (
  `m_occupation_id` mediumint(8) UNSIGNED NOT NULL,
  `m_occupation_name` varchar(150) NOT NULL,
  `m_occupation_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_occupation_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_occupation`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_payment_mode`
--

CREATE TABLE `master_payment_mode` (
  `mpm_id` int(10) UNSIGNED NOT NULL,
  `mpm_name` varchar(50) NOT NULL,
  `mpm_heading` varchar(50) NOT NULL,
  `mpm_active` tinyint(4) NOT NULL DEFAULT 1,
  `mpm_deleted` tinyint(4) NOT NULL DEFAULT 0,
  `mpm_created_on` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_payment_mode`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_pincode`
--

CREATE TABLE `master_pincode` (
  `m_pincode_id` int(10) UNSIGNED NOT NULL,
  `m_pincode_value` mediumint(8) UNSIGNED NOT NULL,
  `m_pincode_city_id` int(10) UNSIGNED NOT NULL,
  `m_pincode_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_pincode_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_pincode`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_providers`
--

CREATE TABLE `master_providers` (
  `id` int(11) NOT NULL,
  `provider` varchar(255) NOT NULL,
  `type` enum('OTP','EKYC','VKYC','PAN','UAN','DUALPAN','CIBIL','BANK') DEFAULT 'OTP',
  `key` varchar(255) NOT NULL,
  `environment` tinyint(4) NOT NULL DEFAULT 0 COMMENT '0 = DEVELOPMENT, 1 = PRODUCTION',
  `url` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1 COMMENT '0=> Inactive, 1 => Active ',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `master_providers`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_qualification`
--

CREATE TABLE `master_qualification` (
  `m_qualification_id` mediumint(8) UNSIGNED NOT NULL,
  `m_qualification_name` varchar(150) NOT NULL,
  `m_qualification_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_qualification_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_qualification`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_relation_type`
--

CREATE TABLE `master_relation_type` (
  `mrt_id` bigint(20) UNSIGNED NOT NULL,
  `mrt_name` varchar(100) DEFAULT NULL,
  `mrt_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `mrt_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `mrt_created_on` timestamp NOT NULL DEFAULT current_timestamp(),
  `mrt_updated_on` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_relation_type`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_religion`
--

CREATE TABLE `master_religion` (
  `religion_id` int(10) UNSIGNED NOT NULL,
  `religion_name` varchar(100) DEFAULT NULL,
  `religion_active` tinyint(1) NOT NULL DEFAULT 1,
  `religion_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `religion_created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_religion`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_residence_type`
--

CREATE TABLE `master_residence_type` (
  `m_residence_type_id` mediumint(8) UNSIGNED NOT NULL,
  `m_residence_type_name` varchar(150) NOT NULL,
  `m_residence_type_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_residence_type_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_residence_type`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_role_type`
--

CREATE TABLE `master_role_type` (
  `role_type_id` mediumint(8) UNSIGNED NOT NULL,
  `role_type_product_id` mediumint(9) NOT NULL,
  `role_type_name` varchar(255) NOT NULL,
  `role_type_heading` varchar(255) NOT NULL,
  `role_type_labels` varchar(20) NOT NULL,
  `role_type_created_on` timestamp NOT NULL DEFAULT current_timestamp(),
  `role_type_updated_on` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `role_type_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `role_type_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `role_type_branch_flag` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT ' Flag for branch mapping '
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_role_type`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_role_wise_buckets`
--

CREATE TABLE `master_role_wise_buckets` (
  `role_type_id` mediumint(8) UNSIGNED NOT NULL,
  `id` bigint(20) UNSIGNED NOT NULL,
  `ftc_menu_ids` text NOT NULL COMMENT 'Comma-separated FTC menu IDs',
  `active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `created_on` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_on` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(10) UNSIGNED NOT NULL,
  `updated_by` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_salary_mode`
--

CREATE TABLE `master_salary_mode` (
  `m_salary_mode_id` mediumint(8) UNSIGNED NOT NULL,
  `m_salary_mode_name` varchar(150) NOT NULL,
  `m_salary_mode_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_salary_mode_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_salary_mode`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_services`
--

CREATE TABLE `master_services` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `service_name` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `master_services`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_sms_template`
--

CREATE TABLE `master_sms_template` (
  `m_st_id` int(10) UNSIGNED NOT NULL,
  `m_st_provider` tinyint(4) DEFAULT NULL,
  `m_st_type_id` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>collection',
  `m_st_template_id` varchar(50) NOT NULL,
  `m_st_template_source` varchar(250) NOT NULL,
  `m_st_description` varchar(500) DEFAULT NULL,
  `m_st_content` text NOT NULL,
  `m_st_variables_count` tinyint(4) NOT NULL DEFAULT 0,
  `m_st_created_on` datetime NOT NULL,
  `m_st_active` tinyint(1) NOT NULL DEFAULT 1,
  `m_st_deleted` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_sms_template`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_state`
--

CREATE TABLE `master_state` (
  `m_state_id` mediumint(8) UNSIGNED NOT NULL,
  `m_state_name` varchar(150) NOT NULL,
  `m_state_code` varchar(20) DEFAULT NULL,
  `cibil_state_code` mediumint(8) UNSIGNED DEFAULT NULL,
  `m_state_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_state_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `m_state_is_sourcing` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_state`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_status`
--

CREATE TABLE `master_status` (
  `status_id` int(10) UNSIGNED NOT NULL,
  `status_name` varchar(100) NOT NULL,
  `status_stage` varchar(100) NOT NULL,
  `created_on` timestamp NOT NULL DEFAULT current_timestamp(),
  `status_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `status_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `status_order` smallint(5) UNSIGNED DEFAULT NULL,
  `status_customer_label` varchar(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `master_status`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_templates`
--

CREATE TABLE `master_templates` (
  `temp_id` int(10) UNSIGNED NOT NULL,
  `type_id` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>collection',
  `job_name` varchar(500) DEFAULT NULL,
  `sms_template_id` varchar(50) NOT NULL,
  `sms_header` varchar(250) NOT NULL,
  `sms_content` text NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '0= Deleted, 1 = Active',
  `created_on` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_templates`
--


-- --------------------------------------------------------

--
-- Table structure for table `master_visit_status`
--

CREATE TABLE `master_visit_status` (
  `m_visit_id` int(10) UNSIGNED NOT NULL,
  `m_visit_name` varchar(100) NOT NULL,
  `m_visit_heading` varchar(100) NOT NULL,
  `m_visti_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `m_visit_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `m_visit_created_on` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `master_visit_status`
--


-- --------------------------------------------------------

--
-- Table structure for table `mis_access_logs`
--

CREATE TABLE `mis_access_logs` (
  `mal_id` bigint(20) NOT NULL,
  `mal_mis_id` int(10) UNSIGNED NOT NULL COMMENT 'master_mis id',
  `mal_start_date` date DEFAULT NULL,
  `mal_end_date` date DEFAULT NULL,
  `mal_created_on` datetime NOT NULL,
  `mal_active` tinyint(4) NOT NULL DEFAULT 1,
  `mal_deleted` tinyint(4) NOT NULL DEFAULT 0,
  `mal_user_id` int(10) UNSIGNED DEFAULT NULL,
  `mal_user_platform` varchar(500) DEFAULT NULL,
  `mal_user_browser` varchar(500) DEFAULT NULL,
  `mal_user_agent` varchar(500) DEFAULT NULL,
  `mal_user_ip` varchar(50) DEFAULT NULL,
  `mal_user_role_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `mis_access_logs`
--


-- --------------------------------------------------------

--
-- Table structure for table `mobileapp_login_trans`
--

CREATE TABLE `mobileapp_login_trans` (
  `mlt_id` bigint(20) UNSIGNED NOT NULL,
  `mlt_user_id` int(10) UNSIGNED DEFAULT NULL,
  `mlt_token` varchar(255) DEFAULT NULL,
  `mlt_login_time` datetime DEFAULT NULL,
  `mlt_token_valid_time` int(11) NOT NULL,
  `mlt_valid_datetime` datetime DEFAULT NULL,
  `mlt_request_ip` varchar(100) DEFAULT NULL,
  `mlt_browser_history` varchar(500) DEFAULT NULL,
  `mlt_app_version` varchar(20) DEFAULT NULL,
  `mlt_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `mlt_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `mlt_updated_on` datetime DEFAULT NULL,
  `mlt_created_on` datetime DEFAULT NULL,
  `mlt_profile_id` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `mobileapp_login_trans`
--


-- --------------------------------------------------------

--
-- Table structure for table `support_categories`
--

CREATE TABLE `support_categories` (
  `id` int(11) NOT NULL,
  `category_name` varchar(255) DEFAULT NULL,
  `priority_id` tinyint(4) DEFAULT NULL COMMENT '1=>''Low'', 2=>''Medium'', 3=>''High'', 4=>''Critical'' ',
  `approval_required` tinyint(4) DEFAULT 0,
  `created_at` datetime NOT NULL,
  `active` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `support_categories`
--


-- --------------------------------------------------------

--
-- Table structure for table `support_tickets`
--

CREATE TABLE `support_tickets` (
  `ticket_id` bigint(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `lead_id` bigint(20) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status_id` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>''Open'', 2=>''In Progress'', 3=>''Closed'', 4=>Re-Open',
  `priority_id` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>''Low'', 2=>''Medium'', 3=>''High'', 4=>''Critical''',
  `assigned_to` int(11) DEFAULT NULL,
  `approval_user_id` int(11) DEFAULT NULL,
  `approval_required` tinyint(4) NOT NULL DEFAULT 3 COMMENT '0=>Pending, 1=>Approved, 3=>Approval Not Required',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `file_name` varchar(500) DEFAULT NULL,
  `reopen_counts` tinyint(4) NOT NULL DEFAULT 0,
  `resolved_type` tinyint(4) NOT NULL DEFAULT 0 COMMENT '0=>agent, 1=>auto resolved',
  `ticket_stage` enum('PENDING APPROVAL','UNASSIGNED','ASSIGNED','REOPENED','RESOLVED','AUTO RESOLVED') DEFAULT NULL COMMENT 'Ticket stage: 1-Pending Approval, 2-Unassigned, 3-Assigned, 4-Reopened, 5-Resolved, 6-Auto Resolved'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `support_ticket_logs`
--

CREATE TABLE `support_ticket_logs` (
  `log_id` bigint(20) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `updated_by` int(11) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `active` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_bank_details`
--

CREATE TABLE `tbl_bank_details` (
  `bank_id` int(11) NOT NULL,
  `bank_name` varchar(49) DEFAULT NULL,
  `bank_ifsc` varchar(11) DEFAULT NULL,
  `bank_branch` varchar(74) DEFAULT NULL,
  `bank_address` varchar(195) DEFAULT NULL,
  `bank_city` varchar(50) DEFAULT NULL,
  `bank_district` varchar(50) DEFAULT NULL,
  `bank_state` varchar(26) DEFAULT NULL,
  `updated_by` int(10) UNSIGNED NOT NULL,
  `ip` varchar(255) NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_bank_details`
--


-- --------------------------------------------------------

--
-- Table structure for table `tbl_cibil`
--

CREATE TABLE `tbl_cibil` (
  `cibil_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` varchar(20) DEFAULT NULL,
  `lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `cibil_pancard` varchar(20) DEFAULT NULL,
  `company_id` mediumint(8) UNSIGNED DEFAULT 1,
  `applicationId` varchar(50) DEFAULT NULL,
  `document_Id` int(10) UNSIGNED DEFAULT NULL,
  `cibilScore` varchar(11) DEFAULT NULL,
  `cibil_file` longtext DEFAULT NULL,
  `cibil_created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `cibil_updated_by` int(10) UNSIGNED DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `memberCode` varchar(50) DEFAULT NULL,
  `totalAccount` varchar(50) DEFAULT NULL,
  `totalBalance` varchar(50) DEFAULT NULL,
  `highCrSanAmt` varchar(50) DEFAULT NULL,
  `overDueAccount` varchar(50) DEFAULT NULL,
  `overDueAmount` varchar(50) DEFAULT NULL,
  `zeroBalance` varchar(50) DEFAULT NULL,
  `cibil_active` tinyint(3) UNSIGNED DEFAULT 1,
  `cibil_deleted` tinyint(3) UNSIGNED DEFAULT 0,
  `cibil_bureau_type` tinyint(3) UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=>TU,2=>CRIF',
  `s3_flag` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `tbl_cibil`
--


-- --------------------------------------------------------

--
-- Table structure for table `tbl_cibil_log`
--

CREATE TABLE `tbl_cibil_log` (
  `cibil_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` varchar(20) DEFAULT NULL,
  `lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `company_id` mediumint(8) UNSIGNED DEFAULT 1,
  `customer_name` varchar(255) DEFAULT NULL,
  `customer_email` varchar(255) DEFAULT NULL,
  `customer_mobile` int(10) UNSIGNED DEFAULT NULL,
  `customer_mobile_1` varchar(50) NOT NULL,
  `gender` varchar(255) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `pancard` varchar(255) DEFAULT NULL,
  `loan_amount` double DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `state_id` mediumint(8) UNSIGNED DEFAULT NULL,
  `pincode` int(10) UNSIGNED DEFAULT NULL,
  `api1_request` text DEFAULT NULL,
  `api1_response` longtext DEFAULT NULL,
  `applicationId` varchar(100) DEFAULT NULL,
  `api2_request` text DEFAULT NULL,
  `api2_response` longtext DEFAULT NULL,
  `document_Id` int(11) DEFAULT NULL,
  `api3_request` varchar(100) DEFAULT NULL,
  `api3_response` varchar(100) DEFAULT NULL,
  `cibil_file` longtext DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `memberCode` varchar(50) DEFAULT NULL,
  `cibilScore` varchar(50) DEFAULT NULL,
  `totalAccount` varchar(50) DEFAULT NULL,
  `totalBalance` varchar(50) DEFAULT NULL,
  `highCrSanAmt` varchar(50) DEFAULT NULL,
  `overDueAccount` varchar(50) DEFAULT NULL,
  `overDueAmount` varchar(50) DEFAULT NULL,
  `zeroBalance` varchar(50) DEFAULT NULL,
  `cibil_bureau_type` tinyint(3) UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=>TU,2=>CRIF',
  `api1_request_s3` varchar(255) DEFAULT NULL,
  `api1_response_s3` varchar(255) DEFAULT NULL,
  `s3_flag` tinyint(4) DEFAULT 0 COMMENT '1=>Uploaded',
  `cibil_flag` int(11) DEFAULT 0,
  `cibil_log_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `cibil_log_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `cibil_bearau_status` varchar(3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `tbl_cibil_log`
--


-- --------------------------------------------------------

--
-- Table structure for table `tbl_collection_followup`
--

CREATE TABLE `tbl_collection_followup` (
  `followup_id` bigint(20) UNSIGNED NOT NULL,
  `lead_id` bigint(20) UNSIGNED DEFAULT NULL,
  `loan_no` varchar(30) DEFAULT NULL,
  `company_id` mediumint(8) UNSIGNED DEFAULT 1,
  `product_id` mediumint(8) UNSIGNED DEFAULT 1,
  `collection_id` bigint(20) UNSIGNED DEFAULT NULL,
  `paid_amount` double DEFAULT NULL,
  `followup_remark` varchar(500) DEFAULT NULL,
  `followup_date` datetime DEFAULT NULL,
  `total_distance` double DEFAULT NULL,
  `executive_start_longitude` double DEFAULT NULL,
  `executive_start_letitude` double DEFAULT NULL,
  `executive_ending_latitude` double DEFAULT NULL,
  `executive_ending_longitude` double DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Visitors User ID',
  `followup_started_at` datetime DEFAULT NULL COMMENT 'Visit Start Date Time',
  `updated_by` int(10) UNSIGNED DEFAULT NULL COMMENT 'Visitors Visit Updated By',
  `followup_ended_at` datetime DEFAULT NULL COMMENT 'Visitors Visit End Date',
  `created_at` datetime DEFAULT NULL,
  `next_visit_date` datetime DEFAULT NULL,
  `payment_type` varchar(100) DEFAULT NULL,
  `wavier_status` mediumint(8) UNSIGNED DEFAULT NULL COMMENT '1=''regular'',2=''settlement'',3=''write off'',4=''discount''',
  `visit_address` varchar(500) DEFAULT NULL,
  `reject_reason` varchar(100) DEFAULT NULL,
  `payment_status` varchar(50) DEFAULT NULL,
  `discounted_amount` double DEFAULT NULL,
  `payment_mode` tinyint(4) DEFAULT NULL COMMENT '1=online,2=offline',
  `payment_method` tinyint(4) DEFAULT NULL COMMENT '1=website,2=QR Code,3=UPI',
  `recieved_amount` int(11) DEFAULT NULL,
  `collection_img` varchar(255) DEFAULT NULL,
  `collection_followup_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `collection_followup_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbl_product`
--

CREATE TABLE `tbl_product` (
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `company_id` mediumint(8) UNSIGNED NOT NULL,
  `product_code` varchar(255) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `product_type` varchar(255) NOT NULL,
  `source` varchar(50) NOT NULL,
  `created_by` varchar(255) NOT NULL,
  `updated_by` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `tbl_product`
--


-- --------------------------------------------------------

--
-- Table structure for table `tbl_rejection_master`
--

CREATE TABLE `tbl_rejection_master` (
  `id` int(10) UNSIGNED NOT NULL,
  `company_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `user_access` enum('0','1','2','3','4') NOT NULL,
  `status` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `sms_sent_flag` tinyint(3) UNSIGNED DEFAULT 1,
  `email_sent_flag` tinyint(3) UNSIGNED NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `tbl_rejection_master`
--


-- --------------------------------------------------------

--
-- Table structure for table `tbl_verification`
--

CREATE TABLE `tbl_verification` (
  `verify_id` bigint(20) UNSIGNED NOT NULL,
  `company_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'COMPANY ID',
  `product_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'PRODUCT ID',
  `lead_id` bigint(20) UNSIGNED NOT NULL COMMENT 'LEAD ID',
  `mobile_verified` enum('NO','YES') DEFAULT 'NO' COMMENT 'MOBILE VERIFICATION',
  `alternate_mobile_verified` enum('NO','YES') DEFAULT 'NO' COMMENT 'ALTERNATE MOBILE VERIFICATION',
  `office_email_verification_send_on` enum('NO','YES') DEFAULT 'NO' COMMENT 'Office Email Verification Sent On',
  `office_email_verified_on` datetime DEFAULT NULL COMMENT 'Office Email Verified On *',
  `pan_verified` enum('NO','YES') DEFAULT 'NO' COMMENT 'PAN verified *',
  `aadhar_verified` enum('NO','YES') DEFAULT 'NO' COMMENT 'Aadhar Verified *',
  `bank_statement_verified` enum('NO','YES') DEFAULT 'NO' COMMENT 'Bank Statement Verified *',
  `app_download_on` enum('NO','YES') DEFAULT 'NO' COMMENT 'App Downloaded On *',
  `digital_kyc_verified` enum('NO','YES') DEFAULT 'NO' COMMENT 'Digital KYC Verified',
  `init_office_email_verification` enum('NO','YES') DEFAULT 'NO' COMMENT 'Initiate Office Email Verification',
  `init_mobile_verification` enum('NO','YES') DEFAULT 'NO' COMMENT 'Initiate Mobile Verification',
  `mobile_otp` varchar(20) DEFAULT NULL COMMENT 'Enter OTP for Mobile',
  `init_residence_cpv` enum('NO','YES') DEFAULT 'NO' COMMENT 'Initiate Residence CPV',
  `residece_cpv_allocated_to` int(10) UNSIGNED DEFAULT NULL COMMENT 'Residence CPV Allocated To',
  `residence_cpv_allocated_on` datetime DEFAULT NULL COMMENT 'Residence CPV Allocated On',
  `init_office_cpv` enum('NO','YES') DEFAULT NULL COMMENT 'Initiate Office CPV',
  `office_cpv_allocated_to` int(10) UNSIGNED DEFAULT NULL COMMENT 'Office CPV Allocated To',
  `office_cvp_allocated_on` datetime DEFAULT NULL COMMENT 'Office CPV Allocated On',
  `visit_requested_by` int(10) UNSIGNED DEFAULT NULL COMMENT 'Who Wants Visit Verification',
  `visit_requested_on` datetime DEFAULT NULL COMMENT 'Which Date time Wants Visit Verification',
  `residence_initiated_on` datetime DEFAULT NULL COMMENT 'Field verification  residence - Initiated on',
  `received_on` datetime DEFAULT NULL COMMENT 'Field verification Residence - Received On',
  `met_with` varchar(100) DEFAULT '-' COMMENT 'Field verification Residence - met with',
  `relation` varchar(100) DEFAULT NULL COMMENT 'Field verification Residence - Relation Met with',
  `res_employer_name` varchar(100) DEFAULT NULL,
  `residence_type` varchar(100) DEFAULT NULL COMMENT 'Field Verification Residence Type',
  `office_residence_house_type` varchar(100) DEFAULT NULL COMMENT 'Residence House Type',
  `office_residence_ease_of_identification` varchar(100) DEFAULT NULL COMMENT 'Residence Ease of Identification',
  `office_residence_locality` varchar(100) DEFAULT NULL COMMENT 'Residance Locality',
  `office_residence_residing_since` varchar(100) DEFAULT NULL COMMENT 'Residence Residing since',
  `office_residence_total_members_in_family` varchar(255) DEFAULT NULL COMMENT 'Residence Total members in family',
  `office_residence_earn_ng_members_in_family` varchar(255) DEFAULT NULL COMMENT 'Residence Earning members in family',
  `office_residence_living_standard` varchar(255) DEFAULT NULL COMMENT 'Residence Living standard',
  `office_residence_neighbour_check` varchar(255) DEFAULT NULL COMMENT 'Residence Neighbour check',
  `office_residence_geo_cordinates` varchar(255) DEFAULT NULL COMMENT 'Geo-cordinates',
  `office_residence_visit_on` datetime DEFAULT NULL COMMENT 'Residence Visit On',
  `office_residence_remarks` text NOT NULL COMMENT 'Residence Remarks',
  `office_residence_document_verified` varchar(255) DEFAULT NULL COMMENT 'Residence Document verified',
  `office_residence_photo` varchar(255) DEFAULT NULL COMMENT 'Photo of Residence',
  `office_residence_status` varchar(255) DEFAULT '1' COMMENT '1=pending,2=positive,3=negitive',
  `office_initiated_on` datetime DEFAULT NULL COMMENT 'Field Verification Initiated on',
  `office_received_on` datetime DEFAULT NULL COMMENT 'Field Verification Received On',
  `office_met_with` varchar(255) DEFAULT NULL COMMENT 'Field Verification Field Verification Met with',
  `office_relation` varchar(255) DEFAULT NULL COMMENT 'Field Verification Field Verification Relation',
  `office_entry_allowed` varchar(255) DEFAULT NULL COMMENT 'Field Verification Field Verification Entry Allowed',
  `office_employer_name` varchar(255) DEFAULT NULL COMMENT 'Field Verification Employer Name',
  `office_company_signboard_sighted` varchar(255) DEFAULT NULL COMMENT 'Field Verification Company Signboard sighted',
  `office_locality` varchar(255) DEFAULT NULL COMMENT 'Field Verification Locality',
  `office_no_of_staff_sighted` varchar(255) DEFAULT NULL COMMENT 'Field Verification\\r\\nNo. of staff sighted',
  `office_employee_strength` varchar(255) DEFAULT NULL COMMENT 'Field Verification Employee strength',
  `office_employed_since` varchar(255) DEFAULT NULL COMMENT 'Field Verification Employed since',
  `office_geo_cordinates` varchar(255) DEFAULT NULL COMMENT 'Field Verification Geo-cordinates',
  `office_visit_on` datetime DEFAULT NULL COMMENT 'Field Verification Visit On',
  `office_remarks` varchar(255) DEFAULT NULL COMMENT 'Field Verification Remarks',
  `office_document_verified` varchar(255) DEFAULT NULL COMMENT 'Field Verification Document verified',
  `office_photo_of_office` text DEFAULT NULL COMMENT 'Field Verification Photo of Office',
  `office_report_status` varchar(255) DEFAULT '1' COMMENT '1=pending,2=positive,3=nagitive',
  `office_comp_type` int(11) DEFAULT NULL,
  `office_col_status` int(11) DEFAULT NULL,
  `verify_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `verify_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `lead_office_start_lat` varchar(45) DEFAULT NULL,
  `lead_office_start_lang` varchar(45) DEFAULT NULL,
  `lead_res_start_lat` varchar(45) DEFAULT NULL,
  `lead_res_start_lang` varchar(45) DEFAULT NULL,
  `lead_office_end_lat` varchar(45) DEFAULT NULL,
  `lead_office_end_lang` varchar(45) DEFAULT NULL,
  `lead_res_end_lat` varchar(45) DEFAULT NULL,
  `lead_res_end_lang` varchar(45) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `user_name` varchar(50) DEFAULT NULL,
  `company_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 1,
  `product_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 1,
  `role_id` int(10) UNSIGNED DEFAULT NULL,
  `labels` varchar(100) DEFAULT NULL,
  `role` varchar(255) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `mobile` bigint(20) UNSIGNED NOT NULL,
  `password` varchar(255) NOT NULL,
  `gender` varchar(50) DEFAULT NULL,
  `dob` varchar(50) DEFAULT NULL,
  `marital_status` varchar(50) DEFAULT NULL,
  `father_name` varchar(50) DEFAULT NULL,
  `branch` varchar(255) DEFAULT NULL,
  `center` varchar(100) DEFAULT NULL,
  `status` enum('Active','InActive','Closed','Blocked') DEFAULT 'Active',
  `otp` mediumint(9) DEFAULT NULL,
  `last_activity` varchar(255) DEFAULT NULL,
  `is_Active` tinyint(1) NOT NULL DEFAULT 1,
  `ip` varchar(20) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_on` datetime DEFAULT NULL,
  `user_scm_id` int(10) UNSIGNED DEFAULT NULL,
  `user_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `user_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `updated_by` int(10) UNSIGNED DEFAULT NULL,
  `updated_on` datetime DEFAULT NULL,
  `user_last_login_ip` varchar(50) DEFAULT NULL,
  `user_last_login_datetime` datetime DEFAULT NULL,
  `user_dialer_id` varchar(150) DEFAULT NULL,
  `user_status_id` mediumint(8) UNSIGNED DEFAULT 1 COMMENT '1=>"Active", 2=>"InActive", 3=>"Closed", 4=>"Blocked"',
  `user_allocation_type_id` tinyint(3) UNSIGNED DEFAULT NULL COMMENT ' 1=> Below Inc 50K, 2=> Above 50K, 3=>Hold Bucket, 4=>Audit, 5=> Repeat Direct',
  `user_bucket_type_id` tinyint(4) DEFAULT 0 COMMENT '1=>Lead, 2=>Application, 3=>Both',
  `call_assigned` tinyint(4) NOT NULL DEFAULT 0,
  `user_is_loanwalle` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `user_total_login_count` int(10) UNSIGNED DEFAULT 0,
  `user_logins_failed_count` tinyint(4) DEFAULT 0,
  `user_last_password_reset_datetime` datetime DEFAULT NULL,
  `user_login_allow_time_status` tinyint(3) UNSIGNED DEFAULT 0 COMMENT '1=>Yes,0=>No',
  `user_login_allow_start_time` time DEFAULT NULL,
  `user_login_allow_end_time` time DEFAULT NULL,
  `user_token` varchar(255) DEFAULT NULL,
  `user_legal_notice_flag` tinyint(4) DEFAULT NULL,
  `user_photo` varchar(255) DEFAULT NULL COMMENT 'passport size photo'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--


-- --------------------------------------------------------

--
-- Table structure for table `user_activity_log`
--

CREATE TABLE `user_activity_log` (
  `ual_id` bigint(20) UNSIGNED NOT NULL,
  `ual_url` varchar(1000) DEFAULT NULL,
  `ual_platform` varchar(1000) DEFAULT NULL,
  `ual_browser` varchar(1000) DEFAULT NULL,
  `ual_agent` varchar(1000) DEFAULT NULL,
  `ual_ip` varchar(20) DEFAULT NULL,
  `ual_type_id` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>login,2=>role change,3=>logout',
  `ual_datetime` datetime NOT NULL,
  `ual_user_id` int(11) NOT NULL,
  `ual_role_id` int(11) DEFAULT NULL,
  `ual_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `ual_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `ual_source_type` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>web,2=>mobile',
  `ual_geolocation` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `user_activity_log`
--


-- --------------------------------------------------------

--
-- Table structure for table `user_export_permission`
--

CREATE TABLE `user_export_permission` (
  `export_permission_id` int(10) UNSIGNED NOT NULL,
  `export_permission_export_id` int(10) UNSIGNED NOT NULL,
  `export_permission_user_role_id` int(10) UNSIGNED DEFAULT NULL,
  `export_permission_user_id` int(10) UNSIGNED NOT NULL,
  `export_permission_created_user_id` int(11) DEFAULT NULL,
  `export_permission_created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `export_permission_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `export_permission_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `export_permission_updated_user_id` int(11) DEFAULT NULL,
  `export_permission_updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `user_export_permission`
--


-- --------------------------------------------------------

--
-- Table structure for table `user_lead_allocation_log`
--

CREATE TABLE `user_lead_allocation_log` (
  `ula_id` bigint(20) UNSIGNED NOT NULL,
  `ula_user_id` int(10) UNSIGNED NOT NULL,
  `ula_user_status` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>Active,2=>Inactive',
  `ula_user_case_type` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT '1=>FRESH, 2=>REPEAT',
  `ula_created_on` datetime NOT NULL,
  `ula_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `ula_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_mis_permission`
--

CREATE TABLE `user_mis_permission` (
  `mis_permission_id` int(10) UNSIGNED NOT NULL,
  `mis_permission_mis_id` int(10) UNSIGNED NOT NULL,
  `mis_permission_user_role_id` int(10) UNSIGNED NOT NULL,
  `mis_permission_user_id` int(10) UNSIGNED NOT NULL,
  `mis_permission_created_user_id` int(11) DEFAULT NULL,
  `mis_permission_created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `mis_permission_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `mis_permission_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `mis_permission_updated_user_id` int(11) DEFAULT NULL,
  `mis_permission_updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `user_mis_permission`
--


-- --------------------------------------------------------

--
-- Table structure for table `user_roles`
--

CREATE TABLE `user_roles` (
  `user_role_id` bigint(20) UNSIGNED NOT NULL,
  `user_role_type_id` mediumint(8) UNSIGNED NOT NULL,
  `user_role_user_id` bigint(20) UNSIGNED NOT NULL,
  `user_role_created_by` int(10) UNSIGNED DEFAULT NULL,
  `user_role_created_on` datetime DEFAULT NULL,
  `user_role_updated_by` int(10) UNSIGNED DEFAULT NULL,
  `user_role_updated_on` datetime DEFAULT NULL,
  `user_role_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `user_role_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `user_role_export_flag` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `user_role_product_id` mediumint(8) UNSIGNED NOT NULL DEFAULT 1,
  `user_role_supervisor_role_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_role_level` varchar(3) DEFAULT NULL COMMENT 'Level of user role L1,L2,L3,L4',
  `user_type` tinyint(4) DEFAULT 0 COMMENT '0=Both, 1=New, 2=Repeat',
  `lead_allocation_type` tinyint(4) DEFAULT 0 COMMENT '0=>No Allocation Required,1=>Lead-New,3=>Lead-Hold, 4=>Application-New,6=>Application-Hold'
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `user_roles`
--


-- --------------------------------------------------------

--
-- Table structure for table `user_role_locations`
--

CREATE TABLE `user_role_locations` (
  `user_rl_id` bigint(20) UNSIGNED NOT NULL,
  `user_rl_role_id` bigint(20) UNSIGNED NOT NULL COMMENT '`user_role_id` From `user_roles`',
  `user_rl_location_type_id` mediumint(8) UNSIGNED NOT NULL COMMENT '1=>city,2=>state,3=> branch',
  `user_rl_location_id` int(11) NOT NULL,
  `user_rl_created_by` int(10) UNSIGNED DEFAULT NULL,
  `user_rl_created_on` datetime DEFAULT NULL,
  `user_rl_updated_by` int(11) DEFAULT NULL,
  `user_rl_updated_on` datetime DEFAULT NULL,
  `user_rl_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `user_rl_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_target_allocation_log`
--

CREATE TABLE `user_target_allocation_log` (
  `uta_id` bigint(20) UNSIGNED NOT NULL,
  `uta_type_id` tinyint(4) NOT NULL DEFAULT 0 COMMENT '1=>Sanction Target,2=>Collection Target',
  `uta_user_id` int(10) UNSIGNED NOT NULL,
  `uta_user_target_cases` int(10) UNSIGNED DEFAULT 0,
  `uta_user_target_amount` double UNSIGNED DEFAULT 0,
  `uta_user_achieve_cases` int(10) UNSIGNED DEFAULT 0,
  `uta_user_achieve_amount` double UNSIGNED DEFAULT 0,
  `uta_user_target_followups` int(10) UNSIGNED DEFAULT 0,
  `uta_user_achieve_followups` int(10) UNSIGNED DEFAULT 0,
  `uta_user_loan_total_cases` int(10) UNSIGNED DEFAULT 0,
  `uta_user_loan_total_principle` double UNSIGNED DEFAULT 0,
  `uta_user_loan_payable_amount` double UNSIGNED DEFAULT 0,
  `uta_user_loan_closed_cases` int(10) UNSIGNED DEFAULT 0,
  `uta_user_loan_principle_received` double UNSIGNED DEFAULT 0,
  `uta_user_loan_int_received` double UNSIGNED DEFAULT 0,
  `uta_user_loan_total_received` double UNSIGNED DEFAULT 0,
  `uta_user_loan_principle_outstanding` double UNSIGNED DEFAULT 0,
  `uta_user_loan_interest_outstanding` double UNSIGNED DEFAULT 0,
  `uta_created_on` datetime NOT NULL,
  `uta_updated_on` datetime DEFAULT NULL,
  `uta_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `uta_deleted` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `address_lat_long_api_logs`
--
ALTER TABLE `address_lat_long_api_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `api_account_aggregator_logs`
--
ALTER TABLE `api_account_aggregator_logs`
  ADD PRIMARY KEY (`aa_id`),
  ADD KEY `aa_lead_id` (`aa_lead_id`),
  ADD KEY `aa_lead_id_2` (`aa_lead_id`,`aa_api_status_id`,`aa_active`,`aa_deleted`);

--
-- Indexes for table `api_banking_cart_log`
--
ALTER TABLE `api_banking_cart_log`
  ADD PRIMARY KEY (`cart_log_id`),
  ADD KEY `cart_method_id` (`cart_method_id`),
  ADD KEY `cart_lead_id` (`cart_lead_id`),
  ADD KEY `cart_doc_id` (`cart_doc_id`),
  ADD KEY `cart_api_status_id` (`cart_api_status_id`),
  ADD KEY `cart_active` (`cart_active`,`cart_deleted`),
  ADD KEY `idx_cart_filter` (`cart_method_id`,`cart_api_status_id`,`cart_active`,`cart_deleted`,`cart_request_datetime`,`cart_lead_id`);

--
-- Indexes for table `api_bank_account_verification_logs`
--
ALTER TABLE `api_bank_account_verification_logs`
  ADD PRIMARY KEY (`bav_id`);

--
-- Indexes for table `api_callback_upi`
--
ALTER TABLE `api_callback_upi`
  ADD PRIMARY KEY (`acu_id`);

--
-- Indexes for table `api_credeau_log`
--
ALTER TABLE `api_credeau_log`
  ADD PRIMARY KEY (`acl_id`),
  ADD KEY `acl_lead_id` (`acl_lead_id`);

--
-- Indexes for table `api_disburse_logs`
--
ALTER TABLE `api_disburse_logs`
  ADD PRIMARY KEY (`disburse_log_id`);

--
-- Indexes for table `api_domain_verification_logs`
--
ALTER TABLE `api_domain_verification_logs`
  ADD PRIMARY KEY (`dv_id`) USING BTREE,
  ADD KEY `dv_active` (`dv_active`,`dv_deleted`) USING BTREE,
  ADD KEY `dv_lead_id` (`dv_lead_id`) USING BTREE,
  ADD KEY `dv_email` (`dv_email`) USING BTREE;

--
-- Indexes for table `api_ekyc_logs`
--
ALTER TABLE `api_ekyc_logs`
  ADD PRIMARY KEY (`ekyc_id`);

--
-- Indexes for table `api_email_logs`
--
ALTER TABLE `api_email_logs`
  ADD PRIMARY KEY (`email_log_id`);

--
-- Indexes for table `api_email_verification_logs`
--
ALTER TABLE `api_email_verification_logs`
  ADD PRIMARY KEY (`ev_id`);

--
-- Indexes for table `api_enach_logs`
--
ALTER TABLE `api_enach_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `enach_loan_no` (`enach_loan_no`);

--
-- Indexes for table `api_esign_logs`
--
ALTER TABLE `api_esign_logs`
  ADD PRIMARY KEY (`esign_id`),
  ADD KEY `esign_lead_id` (`esign_lead_id`);

--
-- Indexes for table `api_face_match_logs`
--
ALTER TABLE `api_face_match_logs`
  ADD PRIMARY KEY (`fm_id`) USING BTREE,
  ADD KEY `fm_active` (`fm_active`,`fm_deleted`) USING BTREE,
  ADD KEY `fm_lead_id` (`fm_lead_id`) USING BTREE;

--
-- Indexes for table `api_poi_verification_logs`
--
ALTER TABLE `api_poi_verification_logs`
  ADD PRIMARY KEY (`poi_veri_id`),
  ADD KEY `poi_veri_active` (`poi_veri_active`,`poi_veri_deleted`),
  ADD KEY `poi_veri_method_id` (`poi_veri_method_id`),
  ADD KEY `poi_veri_lead_id` (`poi_veri_lead_id`),
  ADD KEY `poi_veri_api_status_id` (`poi_veri_api_status_id`),
  ADD KEY `poi_veri_proof_no` (`poi_veri_proof_no`),
  ADD KEY `poi_veri_profile_id` (`poi_veri_profile_id`);

--
-- Indexes for table `api_repayment_logs`
--
ALTER TABLE `api_repayment_logs`
  ADD PRIMARY KEY (`repayment_log_id`);

--
-- Indexes for table `api_reverse_geo_code`
--
ALTER TABLE `api_reverse_geo_code`
  ADD PRIMARY KEY (`rg_log_id`) USING BTREE,
  ADD KEY `rg_lead_id` (`rg_lead_id`) USING BTREE,
  ADD KEY `rg_api_status_id` (`rg_api_status_id`) USING BTREE,
  ADD KEY `rg_active` (`rg_active`,`rg_deleted`) USING BTREE;

--
-- Indexes for table `api_sms_logs`
--
ALTER TABLE `api_sms_logs`
  ADD PRIMARY KEY (`sms_log_id`),
  ADD KEY `sms_mobile` (`sms_mobile`),
  ADD KEY `sms_active` (`sms_active`,`sms_deleted`);

--
-- Indexes for table `api_upi_logs`
--
ALTER TABLE `api_upi_logs`
  ADD PRIMARY KEY (`au_id`);

--
-- Indexes for table `api_video_ekyc_logs`
--
ALTER TABLE `api_video_ekyc_logs`
  ADD PRIMARY KEY (`avedl_id`),
  ADD KEY `avedl_lead_id` (`avedl_lead_id`),
  ADD KEY `avedl_active` (`avedl_active`,`avedl_deleted`),
  ADD KEY `avedl_request_id` (`avedl_request_id`);

--
-- Indexes for table `callback_logs`
--
ALTER TABLE `callback_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `cif_customer`
--
ALTER TABLE `cif_customer`
  ADD PRIMARY KEY (`cif_id`),
  ADD UNIQUE KEY `cif_pancard` (`cif_pancard`),
  ADD UNIQUE KEY `cif_number` (`cif_number`),
  ADD KEY `cif_mobile` (`cif_mobile`),
  ADD KEY `cif_residence_city_id` (`cif_residence_city_id`),
  ADD KEY `cif_residence_state_id` (`cif_residence_state_id`),
  ADD KEY `cif_office_city_id` (`cif_office_city_id`),
  ADD KEY `cif_office_state_id` (`cif_office_state_id`),
  ADD KEY `cif_loan_is_disbursed` (`cif_loan_is_disbursed`),
  ADD KEY `cif_active` (`cif_active`,`cif_deleted`);

--
-- Indexes for table `collection`
--
ALTER TABLE `collection`
  ADD PRIMARY KEY (`id`),
  ADD KEY `recovery_id` (`id`),
  ADD KEY `lead_id` (`lead_id`),
  ADD KEY `company_id` (`company_id`,`product_id`),
  ADD KEY `loan_no` (`loan_no`),
  ADD KEY `payment_mode` (`payment_mode`(1)),
  ADD KEY `repayment_type` (`repayment_type`(1)),
  ADD KEY `date_of_recived` (`date_of_recived`),
  ADD KEY `payment_verification` (`payment_verification`),
  ADD KEY `collection_executive_user_id` (`collection_executive_user_id`),
  ADD KEY `closure_user_id` (`closure_user_id`),
  ADD KEY `collection_type` (`collection_type`),
  ADD KEY `collection_active` (`collection_active`,`collection_deleted`),
  ADD KEY `old_recovery_id` (`old_recovery_id`),
  ADD KEY `payment_mode_id` (`payment_mode_id`);

--
-- Indexes for table `collection_bucket_wise_permission`
--
ALTER TABLE `collection_bucket_wise_permission`
  ADD PRIMARY KEY (`cbwp_id`),
  ADD KEY `export_permission_active` (`cbwp_active`,`cbwp_deleted`),
  ADD KEY `export_permission_export_id` (`cbwp_mcbw_id`),
  ADD KEY `export_permission_user_role_id` (`cbwp_user_role_id`),
  ADD KEY `export_permission_user_id` (`cbwp_user_id`),
  ADD KEY `cbwp_user_id` (`cbwp_user_id`,`cbwp_active`,`cbwp_deleted`);

--
-- Indexes for table `company_holiday`
--
ALTER TABLE `company_holiday`
  ADD PRIMARY KEY (`ch_id`);

--
-- Indexes for table `company_login`
--
ALTER TABLE `company_login`
  ADD PRIMARY KEY (`company_id`);

--
-- Indexes for table `credit_analysis_memo`
--
ALTER TABLE `credit_analysis_memo`
  ADD PRIMARY KEY (`cam_id`),
  ADD KEY `company_id` (`company_id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `lead_id` (`lead_id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `repayment_date` (`repayment_date`),
  ADD KEY `cam_active` (`cam_active`,`cam_deleted`),
  ADD KEY `cam_status` (`cam_status`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `disbursal_date` (`disbursal_date`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `cron_logs`
--
ALTER TABLE `cron_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `cron_scheduler_logs`
--
ALTER TABLE `cron_scheduler_logs`
  ADD PRIMARY KEY (`cs_id`),
  ADD KEY `cs_start_datetime` (`cs_start_datetime`),
  ADD KEY `cs_name` (`cs_name`),
  ADD KEY `cs_active` (`cs_active`,`cs_deleted`);

--
-- Indexes for table `customer_api_data`
--
ALTER TABLE `customer_api_data`
  ADD PRIMARY KEY (`api_id`),
  ADD KEY `IDX_43529563c205c54d3c2e645166` (`api_type`),
  ADD KEY `IDX_030d7df7be00c1989d822cd09c` (`api_lead_id`),
  ADD KEY `IDX_608de75633dcc6a82cc48be12e` (`api_unique_id`),
  ADD KEY `IDX_345fff141e77cfc20b73981a5d` (`api_status_id`);

--
-- Indexes for table `customer_banking`
--
ALTER TABLE `customer_banking`
  ADD PRIMARY KEY (`id`),
  ADD KEY `lead_id` (`lead_id`),
  ADD KEY `account_status_id` (`account_status_id`),
  ADD KEY `customer_banking_active` (`customer_banking_active`,`customer_banking_deleted`);

--
-- Indexes for table `customer_black_list`
--
ALTER TABLE `customer_black_list`
  ADD PRIMARY KEY (`bl_id`),
  ADD KEY `bl_customer_mobile` (`bl_customer_mobile`),
  ADD KEY `bl_customer_alternate_mobile` (`bl_customer_alternate_mobile`),
  ADD KEY `bl_customer_pancard` (`bl_customer_pancard`),
  ADD KEY `bl_active` (`bl_active`,`bl_deleted`),
  ADD KEY `bl_customer_email` (`bl_customer_email`),
  ADD KEY `bl_customer_alternate_email` (`bl_customer_alternate_email`),
  ADD KEY `bl_lead_id` (`bl_lead_id`),
  ADD KEY `bl_loan_no` (`bl_loan_no`);

--
-- Indexes for table `customer_employment`
--
ALTER TABLE `customer_employment`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `customer_enquiry`
--
ALTER TABLE `customer_enquiry`
  ADD PRIMARY KEY (`cust_enquiry_id`),
  ADD KEY `cust_enquiry_active` (`cust_enquiry_active`,`cust_enquiry_deleted`),
  ADD KEY `cust_enquiry_data_source_id` (`cust_enquiry_data_source_id`),
  ADD KEY `cust_enquiry_mobile` (`cust_enquiry_mobile`),
  ADD KEY `cust_enquiry_created_datetime` (`cust_enquiry_created_datetime`);

--
-- Indexes for table `customer_otp`
--
ALTER TABLE `customer_otp`
  ADD PRIMARY KEY (`otp_id`);

--
-- Indexes for table `customer_profile`
--
ALTER TABLE `customer_profile`
  ADD PRIMARY KEY (`cp_id`),
  ADD KEY `cp_lead_id` (`cp_lead_id`),
  ADD KEY `cp_pancard` (`cp_pancard`),
  ADD KEY `cp_mobile` (`cp_mobile`);

--
-- Indexes for table `docs`
--
ALTER TABLE `docs`
  ADD PRIMARY KEY (`docs_id`),
  ADD KEY `docs_active` (`docs_active`,`docs_deleted`),
  ADD KEY `pancard` (`pancard`),
  ADD KEY `mobile` (`mobile`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `docs_master_id` (`docs_master_id`),
  ADD KEY `lead_id` (`lead_id`);

--
-- Indexes for table `docs_download_logs`
--
ALTER TABLE `docs_download_logs`
  ADD PRIMARY KEY (`ddl_id`);

--
-- Indexes for table `docs_master`
--
ALTER TABLE `docs_master`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `export_access_logs`
--
ALTER TABLE `export_access_logs`
  ADD PRIMARY KEY (`eal_id`),
  ADD KEY `eal_export_id` (`eal_export_id`),
  ADD KEY `eal_created_on` (`eal_created_on`),
  ADD KEY `eal_active` (`eal_active`,`eal_deleted`),
  ADD KEY `eal_user_id` (`eal_user_id`);

--
-- Indexes for table `export_schedule_log`
--
ALTER TABLE `export_schedule_log`
  ADD PRIMARY KEY (`esl_id`);

--
-- Indexes for table `feedback`
--
ALTER TABLE `feedback`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `icici_collection_log`
--
ALTER TABLE `icici_collection_log`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `leads`
--
ALTER TABLE `leads`
  ADD PRIMARY KEY (`lead_id`),
  ADD KEY `state_id` (`state_id`),
  ADD KEY `stage` (`stage`),
  ADD KEY `status` (`status`),
  ADD KEY `mobile` (`mobile`),
  ADD KEY `pancard` (`pancard`),
  ADD KEY `loan_no` (`loan_no`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `city_id` (`city_id`),
  ADD KEY `company_id` (`company_id`,`product_id`),
  ADD KEY `lead_active` (`lead_active`,`lead_deleted`),
  ADD KEY `lead_entry_date` (`lead_entry_date`),
  ADD KEY `lead_status_id` (`lead_status_id`),
  ADD KEY `lead_fi_scm_residence_assign_user_id` (`lead_fi_scm_residence_assign_user_id`,`lead_fi_residence_status_id`),
  ADD KEY `lead_fi_scm_office_assign_user_id` (`lead_fi_scm_office_assign_user_id`,`lead_fi_office_status_id`),
  ADD KEY `lead_reference_no` (`lead_reference_no`),
  ADD KEY `lead_screener_assign_user_id` (`lead_screener_assign_user_id`),
  ADD KEY `email` (`email`),
  ADD KEY `lead_data_source_id` (`lead_data_source_id`),
  ADD KEY `lead_rejected_reason_id` (`lead_rejected_reason_id`),
  ADD KEY `lead_credithead_assign_user_id` (`lead_credithead_assign_user_id`),
  ADD KEY `lead_credit_assign_user_id` (`lead_credit_assign_user_id`),
  ADD KEY `lead_disbursal_assign_user_id` (`lead_disbursal_assign_user_id`),
  ADD KEY `lead_disbursal_approve_user_id` (`lead_disbursal_approve_user_id`),
  ADD KEY `lead_branch_id` (`lead_branch_id`),
  ADD KEY `lead_rejected_assign_user_id` (`lead_rejected_assign_user_id`),
  ADD KEY `lead_rejected_user_id` (`lead_rejected_user_id`),
  ADD KEY `lead_audit_assign_user_id` (`lead_audit_assign_user_id`),
  ADD KEY `lead_audit_assign_date_time` (`lead_audit_assign_date_time`),
  ADD KEY `lead_audit_head_assign_user_id` (`lead_audit_head_assign_user_id`),
  ADD KEY `lead_audit_head_assign_datetime` (`lead_audit_head_assign_datetime`),
  ADD KEY `lead_customer_profile_id` (`lead_customer_profile_id`);

--
-- Indexes for table `leads_otp_trans`
--
ALTER TABLE `leads_otp_trans`
  ADD PRIMARY KEY (`lot_id`),
  ADD KEY `lot_lead_id` (`lot_lead_id`),
  ADD KEY `lot_mobile_no` (`lot_mobile_no`),
  ADD KEY `lot_otp_trigger_time` (`lot_otp_trigger_time`),
  ADD KEY `lot_active` (`lot_active`,`lot_deleted`),
  ADD KEY `lot_user_id` (`lot_user_id`);

--
-- Indexes for table `lead_bre_rule_result`
--
ALTER TABLE `lead_bre_rule_result`
  ADD PRIMARY KEY (`lbrr_id`),
  ADD KEY `lbrr_active` (`lbrr_active`,`lbrr_deleted`),
  ADD KEY `lbrr_lead_id` (`lbrr_lead_id`),
  ADD KEY `lbrr_rule_id` (`lbrr_rule_id`),
  ADD KEY `lbrr_rule_manual_decision_id` (`lbrr_rule_manual_decision_id`),
  ADD KEY `lbrr_rule_system_decision_id` (`lbrr_rule_system_decision_id`);

--
-- Indexes for table `lead_customer`
--
ALTER TABLE `lead_customer`
  ADD PRIMARY KEY (`customer_seq_id`),
  ADD UNIQUE KEY `customer_lead_id` (`customer_lead_id`),
  ADD KEY `customer_lead_id_2` (`customer_lead_id`);

--
-- Indexes for table `lead_customer_references`
--
ALTER TABLE `lead_customer_references`
  ADD PRIMARY KEY (`lcr_id`),
  ADD KEY `lcr_active` (`lcr_active`,`lcr_deleted`);

--
-- Indexes for table `lead_disbursement_trans_log`
--
ALTER TABLE `lead_disbursement_trans_log`
  ADD PRIMARY KEY (`disb_trans_id`);

--
-- Indexes for table `lead_eligibility_rules_result`
--
ALTER TABLE `lead_eligibility_rules_result`
  ADD PRIMARY KEY (`lerr_id`);

--
-- Indexes for table `lead_followup`
--
ALTER TABLE `lead_followup`
  ADD PRIMARY KEY (`id`),
  ADD KEY `lead_id` (`lead_id`);

--
-- Indexes for table `lead_journey_events`
--
ALTER TABLE `lead_journey_events`
  ADD PRIMARY KEY (`lje_id`);

--
-- Indexes for table `lead_rejection_reasons`
--
ALTER TABLE `lead_rejection_reasons`
  ADD PRIMARY KEY (`lrr_id`);

--
-- Indexes for table `lead_sms_logs`
--
ALTER TABLE `lead_sms_logs`
  ADD PRIMARY KEY (`lsl_id`),
  ADD KEY `lsl_sms_type_id` (`lsl_sms_type_id`),
  ADD KEY `lsl_active` (`lsl_active`,`lsl_deleted`),
  ADD KEY `lsl_created_on` (`lsl_created_on`),
  ADD KEY `lsl_api_status_id` (`lsl_api_status_id`),
  ADD KEY `lsl_lead_id` (`lsl_lead_id`);

--
-- Indexes for table `legal_email_logs`
--
ALTER TABLE `legal_email_logs`
  ADD PRIMARY KEY (`legal_email_log_id`),
  ADD KEY `legal_email_type_id` (`legal_email_type_id`),
  ADD KEY `legal_email_lead_id` (`legal_email_lead_id`),
  ADD KEY `legal_email_active` (`legal_email_active`,`legal_email_deleted`),
  ADD KEY `legal_email_created_on` (`legal_email_created_on`),
  ADD KEY `legal_email_api_status_id` (`legal_email_api_status_id`);

--
-- Indexes for table `lists_of_masters`
--
ALTER TABLE `lists_of_masters`
  ADD PRIMARY KEY (`master_id`);

--
-- Indexes for table `loan`
--
ALTER TABLE `loan`
  ADD PRIMARY KEY (`loan_id`),
  ADD UNIQUE KEY `lead_id_2` (`lead_id`),
  ADD UNIQUE KEY `loan_no_2` (`loan_no`),
  ADD KEY `company_id` (`company_id`,`product_id`),
  ADD KEY `lead_id` (`lead_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `loan_active` (`loan_active`,`loan_deleted`);

--
-- Indexes for table `loan_collection_followup`
--
ALTER TABLE `loan_collection_followup`
  ADD PRIMARY KEY (`lcf_id`),
  ADD KEY `lcf_lead_id` (`lcf_lead_id`),
  ADD KEY `lcf_type_id` (`lcf_type_id`),
  ADD KEY `lcf_status_id` (`lcf_status_id`),
  ADD KEY `lcf_user_id` (`lcf_user_id`),
  ADD KEY `lcf_active` (`lcf_active`,`lcf_deleted`);

--
-- Indexes for table `logo`
--
ALTER TABLE `logo`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `master_api_provider`
--
ALTER TABLE `master_api_provider`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `master_bank_account_status`
--
ALTER TABLE `master_bank_account_status`
  ADD PRIMARY KEY (`bas_id`),
  ADD UNIQUE KEY `bas_name` (`bas_name`),
  ADD KEY `bas_active` (`bas_active`,`bas_deleted`);

--
-- Indexes for table `master_bank_type`
--
ALTER TABLE `master_bank_type`
  ADD PRIMARY KEY (`m_bank_type_id`);

--
-- Indexes for table `master_blacklist_reject_reason`
--
ALTER TABLE `master_blacklist_reject_reason`
  ADD PRIMARY KEY (`m_br_id`);

--
-- Indexes for table `master_branch`
--
ALTER TABLE `master_branch`
  ADD PRIMARY KEY (`m_branch_id`),
  ADD KEY `m_branch_active` (`m_branch_active`,`m_branch_deleted`);

--
-- Indexes for table `master_bre_category`
--
ALTER TABLE `master_bre_category`
  ADD PRIMARY KEY (`m_bre_cat_id`),
  ADD KEY `m_bre_cat_active` (`m_bre_cat_active`,`m_bre_cat_deleted`);

--
-- Indexes for table `master_bre_rule`
--
ALTER TABLE `master_bre_rule`
  ADD PRIMARY KEY (`m_bre_rule_id`),
  ADD UNIQUE KEY `m_bre_rule_name` (`m_bre_rule_name`),
  ADD KEY `m_bre_rule_active` (`m_bre_rule_active`,`m_bre_rule_deleted`),
  ADD KEY `m_bre_rule_catgory_id` (`m_bre_rule_catgory_id`);

--
-- Indexes for table `master_city`
--
ALTER TABLE `master_city`
  ADD PRIMARY KEY (`m_city_id`),
  ADD KEY `m_city_active` (`m_city_active`,`m_city_deleted`),
  ADD KEY `m_city_name` (`m_city_name`),
  ADD KEY `m_city_state_id` (`m_city_state_id`),
  ADD KEY `m_city_branch_id` (`m_city_branch_id`);

--
-- Indexes for table `master_company_type`
--
ALTER TABLE `master_company_type`
  ADD PRIMARY KEY (`m_company_type_id`);

--
-- Indexes for table `master_credentials`
--
ALTER TABLE `master_credentials`
  ADD PRIMARY KEY (`id`) USING BTREE;

--
-- Indexes for table `master_data_source`
--
ALTER TABLE `master_data_source`
  ADD PRIMARY KEY (`data_source_id`);

--
-- Indexes for table `master_department`
--
ALTER TABLE `master_department`
  ADD PRIMARY KEY (`department_id`);

--
-- Indexes for table `master_designation`
--
ALTER TABLE `master_designation`
  ADD PRIMARY KEY (`m_designation_id`);

--
-- Indexes for table `master_disbursement_banks`
--
ALTER TABLE `master_disbursement_banks`
  ADD PRIMARY KEY (`disb_bank_id`),
  ADD KEY `disb_bank_created_by` (`disb_bank_created_by`);

--
-- Indexes for table `master_electrical_provider`
--
ALTER TABLE `master_electrical_provider`
  ADD PRIMARY KEY (`electrical_pro_id`);

--
-- Indexes for table `master_enduse`
--
ALTER TABLE `master_enduse`
  ADD PRIMARY KEY (`enduse_id`),
  ADD KEY `enduse_active` (`enduse_active`,`enduse_deleted`);

--
-- Indexes for table `master_export`
--
ALTER TABLE `master_export`
  ADD PRIMARY KEY (`m_export_id`),
  ADD KEY `m_export_is_live` (`m_export_is_live`);

--
-- Indexes for table `master_feedback_answers`
--
ALTER TABLE `master_feedback_answers`
  ADD PRIMARY KEY (`mfa_id`),
  ADD KEY `mfa_active` (`mfa_active`,`mfa_deleted`);

--
-- Indexes for table `master_feedback_questions`
--
ALTER TABLE `master_feedback_questions`
  ADD PRIMARY KEY (`mfq_id`),
  ADD KEY `mfq_active` (`mfq_active`,`mfq_deleted`);

--
-- Indexes for table `master_followup_status`
--
ALTER TABLE `master_followup_status`
  ADD PRIMARY KEY (`m_followup_status_id`),
  ADD KEY `m_followup_status_active` (`m_followup_status_active`,`m_followup_status_deleted`);

--
-- Indexes for table `master_followup_type`
--
ALTER TABLE `master_followup_type`
  ADD PRIMARY KEY (`m_followup_type_id`);

--
-- Indexes for table `master_industry`
--
ALTER TABLE `master_industry`
  ADD PRIMARY KEY (`m_industry_id`);

--
-- Indexes for table `master_journey_stage`
--
ALTER TABLE `master_journey_stage`
  ADD PRIMARY KEY (`m_journey_id`),
  ADD KEY `m_journey_type_id` (`m_journey_type_id`),
  ADD KEY `m_journey_active` (`m_journey_active`,`m_journey_deleted`);

--
-- Indexes for table `master_lms_menu`
--
ALTER TABLE `master_lms_menu`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `master_marital_status`
--
ALTER TABLE `master_marital_status`
  ADD PRIMARY KEY (`m_marital_status_id`);

--
-- Indexes for table `master_marketing_channel`
--
ALTER TABLE `master_marketing_channel`
  ADD PRIMARY KEY (`mmc_id`),
  ADD UNIQUE KEY `mmc_name` (`mmc_name`),
  ADD KEY `mmc_type` (`mmc_type`),
  ADD KEY `mmc_active` (`mmc_active`,`mmc_deleted`);

--
-- Indexes for table `master_mis_report`
--
ALTER TABLE `master_mis_report`
  ADD PRIMARY KEY (`m_report_id`);

--
-- Indexes for table `master_occupation`
--
ALTER TABLE `master_occupation`
  ADD PRIMARY KEY (`m_occupation_id`);

--
-- Indexes for table `master_payment_mode`
--
ALTER TABLE `master_payment_mode`
  ADD PRIMARY KEY (`mpm_id`),
  ADD KEY `mpm_active` (`mpm_active`,`mpm_deleted`);

--
-- Indexes for table `master_pincode`
--
ALTER TABLE `master_pincode`
  ADD PRIMARY KEY (`m_pincode_id`),
  ADD KEY `m_pincode_active` (`m_pincode_active`,`m_pincode_deleted`),
  ADD KEY `m_pincode_value` (`m_pincode_value`),
  ADD KEY `m_pincode_city_id` (`m_pincode_city_id`);

--
-- Indexes for table `master_providers`
--
ALTER TABLE `master_providers`
  ADD PRIMARY KEY (`id`) USING BTREE;

--
-- Indexes for table `master_qualification`
--
ALTER TABLE `master_qualification`
  ADD PRIMARY KEY (`m_qualification_id`);

--
-- Indexes for table `master_relation_type`
--
ALTER TABLE `master_relation_type`
  ADD PRIMARY KEY (`mrt_id`);

--
-- Indexes for table `master_residence_type`
--
ALTER TABLE `master_residence_type`
  ADD PRIMARY KEY (`m_residence_type_id`);

--
-- Indexes for table `master_role_type`
--
ALTER TABLE `master_role_type`
  ADD PRIMARY KEY (`role_type_id`);

--
-- Indexes for table `master_role_wise_buckets`
--
ALTER TABLE `master_role_wise_buckets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `role_type_id` (`role_type_id`);

--
-- Indexes for table `master_salary_mode`
--
ALTER TABLE `master_salary_mode`
  ADD PRIMARY KEY (`m_salary_mode_id`);

--
-- Indexes for table `master_services`
--
ALTER TABLE `master_services`
  ADD PRIMARY KEY (`id`) USING BTREE,
  ADD UNIQUE KEY `id` (`id`) USING BTREE;

--
-- Indexes for table `master_sms_template`
--
ALTER TABLE `master_sms_template`
  ADD PRIMARY KEY (`m_st_id`),
  ADD KEY `m_st_active` (`m_st_active`,`m_st_deleted`),
  ADD KEY `m_st_type_id` (`m_st_type_id`);

--
-- Indexes for table `master_state`
--
ALTER TABLE `master_state`
  ADD PRIMARY KEY (`m_state_id`),
  ADD KEY `m_state_active` (`m_state_active`,`m_state_deleted`),
  ADD KEY `m_state_name` (`m_state_name`);

--
-- Indexes for table `master_status`
--
ALTER TABLE `master_status`
  ADD PRIMARY KEY (`status_id`),
  ADD KEY `status_active` (`status_active`,`status_deleted`),
  ADD KEY `status_stage` (`status_stage`);

--
-- Indexes for table `master_templates`
--
ALTER TABLE `master_templates`
  ADD PRIMARY KEY (`temp_id`),
  ADD KEY `m_st_active` (`status`),
  ADD KEY `m_st_type_id` (`type_id`);

--
-- Indexes for table `master_visit_status`
--
ALTER TABLE `master_visit_status`
  ADD PRIMARY KEY (`m_visit_id`),
  ADD KEY `m_visti_active` (`m_visti_active`,`m_visit_deleted`);

--
-- Indexes for table `mis_access_logs`
--
ALTER TABLE `mis_access_logs`
  ADD PRIMARY KEY (`mal_id`),
  ADD KEY `mal_mis_id` (`mal_mis_id`),
  ADD KEY `mal_created_on` (`mal_created_on`),
  ADD KEY `mal_active` (`mal_active`,`mal_deleted`),
  ADD KEY `mal_user_id` (`mal_user_id`);

--
-- Indexes for table `mobileapp_login_trans`
--
ALTER TABLE `mobileapp_login_trans`
  ADD PRIMARY KEY (`mlt_id`),
  ADD KEY `mlt_active` (`mlt_active`,`mlt_deleted`),
  ADD KEY `mlt_user_id` (`mlt_user_id`),
  ADD KEY `mlt_token` (`mlt_token`);

--
-- Indexes for table `support_categories`
--
ALTER TABLE `support_categories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `priority_id` (`priority_id`),
  ADD KEY `active` (`active`);

--
-- Indexes for table `support_tickets`
--
ALTER TABLE `support_tickets`
  ADD PRIMARY KEY (`ticket_id`),
  ADD KEY `lead_id` (`lead_id`),
  ADD KEY `active` (`active`),
  ADD KEY `status_id` (`status_id`);

--
-- Indexes for table `support_ticket_logs`
--
ALTER TABLE `support_ticket_logs`
  ADD PRIMARY KEY (`log_id`);

--
-- Indexes for table `tbl_bank_details`
--
ALTER TABLE `tbl_bank_details`
  ADD PRIMARY KEY (`bank_id`),
  ADD KEY `bank_ifsc` (`bank_ifsc`);

--
-- Indexes for table `tbl_cibil`
--
ALTER TABLE `tbl_cibil`
  ADD PRIMARY KEY (`cibil_id`),
  ADD KEY `cibil_id` (`cibil_id`),
  ADD KEY `lead_id` (`lead_id`),
  ADD KEY `company_id` (`company_id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `cibil_active` (`cibil_active`,`cibil_deleted`),
  ADD KEY `cibil_pancard` (`cibil_pancard`),
  ADD KEY `created_at` (`created_at`);

--
-- Indexes for table `tbl_cibil_log`
--
ALTER TABLE `tbl_cibil_log`
  ADD PRIMARY KEY (`cibil_id`),
  ADD KEY `cibil_id` (`cibil_id`),
  ADD KEY `lead_id` (`lead_id`),
  ADD KEY `applicationId` (`applicationId`);

--
-- Indexes for table `tbl_collection_followup`
--
ALTER TABLE `tbl_collection_followup`
  ADD PRIMARY KEY (`followup_id`),
  ADD KEY `collection_followup_active` (`collection_followup_active`,`collection_followup_deleted`),
  ADD KEY `lead_id` (`lead_id`),
  ADD KEY `collection_id` (`collection_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `tbl_product`
--
ALTER TABLE `tbl_product`
  ADD PRIMARY KEY (`product_id`);

--
-- Indexes for table `tbl_rejection_master`
--
ALTER TABLE `tbl_rejection_master`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`);

--
-- Indexes for table `user_activity_log`
--
ALTER TABLE `user_activity_log`
  ADD PRIMARY KEY (`ual_id`),
  ADD KEY `ual_user_id` (`ual_user_id`),
  ADD KEY `ual_role_id` (`ual_role_id`),
  ADD KEY `ual_active` (`ual_active`,`ual_deleted`);

--
-- Indexes for table `user_export_permission`
--
ALTER TABLE `user_export_permission`
  ADD PRIMARY KEY (`export_permission_id`),
  ADD KEY `export_permission_active` (`export_permission_active`,`export_permission_deleted`),
  ADD KEY `export_permission_export_id` (`export_permission_export_id`),
  ADD KEY `export_permission_user_role_id` (`export_permission_user_role_id`),
  ADD KEY `export_permission_user_id` (`export_permission_user_id`);

--
-- Indexes for table `user_lead_allocation_log`
--
ALTER TABLE `user_lead_allocation_log`
  ADD PRIMARY KEY (`ula_id`),
  ADD KEY `ula_active` (`ula_active`,`ula_deleted`),
  ADD KEY `ula_user_id` (`ula_user_id`),
  ADD KEY `ula_user_status` (`ula_user_status`),
  ADD KEY `ula_user_case_type` (`ula_user_case_type`);

--
-- Indexes for table `user_mis_permission`
--
ALTER TABLE `user_mis_permission`
  ADD PRIMARY KEY (`mis_permission_id`),
  ADD KEY `mis_permission_mis_id` (`mis_permission_mis_id`),
  ADD KEY `mis_permission_user_role_id` (`mis_permission_user_role_id`),
  ADD KEY `mis_permission_user_id` (`mis_permission_user_id`),
  ADD KEY `mis_permission_active` (`mis_permission_active`,`mis_permission_deleted`);

--
-- Indexes for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`user_role_id`),
  ADD UNIQUE KEY `user_role_type_id` (`user_role_type_id`,`user_role_user_id`),
  ADD KEY `IDX_3707d4b4f0770174d4b04e3ef3` (`user_role_supervisor_role_id`),
  ADD KEY `IDX_522e9ea279c2d928805b16a9b9` (`user_role_deleted`),
  ADD KEY `IDX_12360d1100b2ee60f18c1a3bbe` (`user_role_active`),
  ADD KEY `IDX_1fd5de98e1665168288814c05c` (`user_role_type_id`),
  ADD KEY `IDX_8359c63fa6d6b44767988f8e3c` (`user_role_user_id`);

--
-- Indexes for table `user_role_locations`
--
ALTER TABLE `user_role_locations`
  ADD PRIMARY KEY (`user_rl_id`),
  ADD UNIQUE KEY `user_rl_role_id` (`user_rl_role_id`,`user_rl_location_type_id`,`user_rl_location_id`),
  ADD KEY `user_rl_active` (`user_rl_active`,`user_rl_deleted`),
  ADD KEY `user_rl_role_id_2` (`user_rl_role_id`),
  ADD KEY `user_rl_location_type_id` (`user_rl_location_type_id`);

--
-- Indexes for table `user_target_allocation_log`
--
ALTER TABLE `user_target_allocation_log`
  ADD PRIMARY KEY (`uta_id`),
  ADD KEY `uta_active` (`uta_active`,`uta_deleted`),
  ADD KEY `uta_user_id` (`uta_user_id`),
  ADD KEY `uta_type_id` (`uta_type_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `address_lat_long_api_logs`
--
ALTER TABLE `address_lat_long_api_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=102;

--
-- AUTO_INCREMENT for table `api_account_aggregator_logs`
--
ALTER TABLE `api_account_aggregator_logs`
  MODIFY `aa_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=64758;

--
-- AUTO_INCREMENT for table `api_banking_cart_log`
--
ALTER TABLE `api_banking_cart_log`
  MODIFY `cart_log_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30986;

--
-- AUTO_INCREMENT for table `api_bank_account_verification_logs`
--
ALTER TABLE `api_bank_account_verification_logs`
  MODIFY `bav_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12181;

--
-- AUTO_INCREMENT for table `api_callback_upi`
--
ALTER TABLE `api_callback_upi`
  MODIFY `acu_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=669;

--
-- AUTO_INCREMENT for table `api_credeau_log`
--
ALTER TABLE `api_credeau_log`
  MODIFY `acl_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28775;

--
-- AUTO_INCREMENT for table `api_disburse_logs`
--
ALTER TABLE `api_disburse_logs`
  MODIFY `disburse_log_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7739;

--
-- AUTO_INCREMENT for table `api_domain_verification_logs`
--
ALTER TABLE `api_domain_verification_logs`
  MODIFY `dv_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10480;

--
-- AUTO_INCREMENT for table `api_ekyc_logs`
--
ALTER TABLE `api_ekyc_logs`
  MODIFY `ekyc_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `api_email_logs`
--
ALTER TABLE `api_email_logs`
  MODIFY `email_log_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18817;

--
-- AUTO_INCREMENT for table `api_email_verification_logs`
--
ALTER TABLE `api_email_verification_logs`
  MODIFY `ev_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20352;

--
-- AUTO_INCREMENT for table `api_enach_logs`
--
ALTER TABLE `api_enach_logs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=644;

--
-- AUTO_INCREMENT for table `api_esign_logs`
--
ALTER TABLE `api_esign_logs`
  MODIFY `esign_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25282;

--
-- AUTO_INCREMENT for table `api_face_match_logs`
--
ALTER TABLE `api_face_match_logs`
  MODIFY `fm_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `api_poi_verification_logs`
--
ALTER TABLE `api_poi_verification_logs`
  MODIFY `poi_veri_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `api_repayment_logs`
--
ALTER TABLE `api_repayment_logs`
  MODIFY `repayment_log_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5002;

--
-- AUTO_INCREMENT for table `api_reverse_geo_code`
--
ALTER TABLE `api_reverse_geo_code`
  MODIFY `rg_log_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=64;

--
-- AUTO_INCREMENT for table `api_sms_logs`
--
ALTER TABLE `api_sms_logs`
  MODIFY `sms_log_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=123;

--
-- AUTO_INCREMENT for table `api_upi_logs`
--
ALTER TABLE `api_upi_logs`
  MODIFY `au_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=388;

--
-- AUTO_INCREMENT for table `api_video_ekyc_logs`
--
ALTER TABLE `api_video_ekyc_logs`
  MODIFY `avedl_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14082;

--
-- AUTO_INCREMENT for table `callback_logs`
--
ALTER TABLE `callback_logs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2087;

--
-- AUTO_INCREMENT for table `cif_customer`
--
ALTER TABLE `cif_customer`
  MODIFY `cif_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5560;

--
-- AUTO_INCREMENT for table `collection`
--
ALTER TABLE `collection`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5644;

--
-- AUTO_INCREMENT for table `collection_bucket_wise_permission`
--
ALTER TABLE `collection_bucket_wise_permission`
  MODIFY `cbwp_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `company_holiday`
--
ALTER TABLE `company_holiday`
  MODIFY `ch_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `company_login`
--
ALTER TABLE `company_login`
  MODIFY `company_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `credit_analysis_memo`
--
ALTER TABLE `credit_analysis_memo`
  MODIFY `cam_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10368;

--
-- AUTO_INCREMENT for table `cron_logs`
--
ALTER TABLE `cron_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10499;

--
-- AUTO_INCREMENT for table `cron_scheduler_logs`
--
ALTER TABLE `cron_scheduler_logs`
  MODIFY `cs_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33598;

--
-- AUTO_INCREMENT for table `customer_api_data`
--
ALTER TABLE `customer_api_data`
  MODIFY `api_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `customer_banking`
--
ALTER TABLE `customer_banking`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=58;

--
-- AUTO_INCREMENT for table `customer_black_list`
--
ALTER TABLE `customer_black_list`
  MODIFY `bl_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2075;

--
-- AUTO_INCREMENT for table `customer_employment`
--
ALTER TABLE `customer_employment`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=120;

--
-- AUTO_INCREMENT for table `customer_enquiry`
--
ALTER TABLE `customer_enquiry`
  MODIFY `cust_enquiry_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_otp`
--
ALTER TABLE `customer_otp`
  MODIFY `otp_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=122;

--
-- AUTO_INCREMENT for table `customer_profile`
--
ALTER TABLE `customer_profile`
  MODIFY `cp_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=109;

--
-- AUTO_INCREMENT for table `docs`
--
ALTER TABLE `docs`
  MODIFY `docs_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=130;

--
-- AUTO_INCREMENT for table `docs_download_logs`
--
ALTER TABLE `docs_download_logs`
  MODIFY `ddl_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `docs_master`
--
ALTER TABLE `docs_master`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'DOCS ID', AUTO_INCREMENT=106;

--
-- AUTO_INCREMENT for table `export_access_logs`
--
ALTER TABLE `export_access_logs`
  MODIFY `eal_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3404;

--
-- AUTO_INCREMENT for table `export_schedule_log`
--
ALTER TABLE `export_schedule_log`
  MODIFY `esl_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `feedback`
--
ALTER TABLE `feedback`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `icici_collection_log`
--
ALTER TABLE `icici_collection_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `leads`
--
ALTER TABLE `leads`
  MODIFY `lead_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=126;

--
-- AUTO_INCREMENT for table `leads_otp_trans`
--
ALTER TABLE `leads_otp_trans`
  MODIFY `lot_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=226;

--
-- AUTO_INCREMENT for table `lead_bre_rule_result`
--
ALTER TABLE `lead_bre_rule_result`
  MODIFY `lbrr_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=697947;

--
-- AUTO_INCREMENT for table `lead_customer`
--
ALTER TABLE `lead_customer`
  MODIFY `customer_seq_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=133;

--
-- AUTO_INCREMENT for table `lead_customer_references`
--
ALTER TABLE `lead_customer_references`
  MODIFY `lcr_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22869;

--
-- AUTO_INCREMENT for table `lead_disbursement_trans_log`
--
ALTER TABLE `lead_disbursement_trans_log`
  MODIFY `disb_trans_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8571;

--
-- AUTO_INCREMENT for table `lead_eligibility_rules_result`
--
ALTER TABLE `lead_eligibility_rules_result`
  MODIFY `lerr_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=91;

--
-- AUTO_INCREMENT for table `lead_followup`
--
ALTER TABLE `lead_followup`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=708;

--
-- AUTO_INCREMENT for table `lead_journey_events`
--
ALTER TABLE `lead_journey_events`
  MODIFY `lje_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=114;

--
-- AUTO_INCREMENT for table `lead_rejection_reasons`
--
ALTER TABLE `lead_rejection_reasons`
  MODIFY `lrr_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `lead_sms_logs`
--
ALTER TABLE `lead_sms_logs`
  MODIFY `lsl_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `legal_email_logs`
--
ALTER TABLE `legal_email_logs`
  MODIFY `legal_email_log_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=228;

--
-- AUTO_INCREMENT for table `lists_of_masters`
--
ALTER TABLE `lists_of_masters`
  MODIFY `master_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Master ID';

--
-- AUTO_INCREMENT for table `loan`
--
ALTER TABLE `loan`
  MODIFY `loan_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8689;

--
-- AUTO_INCREMENT for table `loan_collection_followup`
--
ALTER TABLE `loan_collection_followup`
  MODIFY `lcf_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2140;

--
-- AUTO_INCREMENT for table `logo`
--
ALTER TABLE `logo`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `master_api_provider`
--
ALTER TABLE `master_api_provider`
  MODIFY `id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `master_bank_account_status`
--
ALTER TABLE `master_bank_account_status`
  MODIFY `bas_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `master_bank_type`
--
ALTER TABLE `master_bank_type`
  MODIFY `m_bank_type_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `master_blacklist_reject_reason`
--
ALTER TABLE `master_blacklist_reject_reason`
  MODIFY `m_br_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `master_branch`
--
ALTER TABLE `master_branch`
  MODIFY `m_branch_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `master_bre_rule`
--
ALTER TABLE `master_bre_rule`
  MODIFY `m_bre_rule_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT for table `master_city`
--
ALTER TABLE `master_city`
  MODIFY `m_city_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10066;

--
-- AUTO_INCREMENT for table `master_company_type`
--
ALTER TABLE `master_company_type`
  MODIFY `m_company_type_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `master_credentials`
--
ALTER TABLE `master_credentials`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `master_data_source`
--
ALTER TABLE `master_data_source`
  MODIFY `data_source_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- AUTO_INCREMENT for table `master_department`
--
ALTER TABLE `master_department`
  MODIFY `department_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `master_designation`
--
ALTER TABLE `master_designation`
  MODIFY `m_designation_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `master_disbursement_banks`
--
ALTER TABLE `master_disbursement_banks`
  MODIFY `disb_bank_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `master_electrical_provider`
--
ALTER TABLE `master_electrical_provider`
  MODIFY `electrical_pro_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

--
-- AUTO_INCREMENT for table `master_enduse`
--
ALTER TABLE `master_enduse`
  MODIFY `enduse_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `master_export`
--
ALTER TABLE `master_export`
  MODIFY `m_export_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=60;

--
-- AUTO_INCREMENT for table `master_feedback_answers`
--
ALTER TABLE `master_feedback_answers`
  MODIFY `mfa_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `master_feedback_questions`
--
ALTER TABLE `master_feedback_questions`
  MODIFY `mfq_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `master_followup_status`
--
ALTER TABLE `master_followup_status`
  MODIFY `m_followup_status_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `master_followup_type`
--
ALTER TABLE `master_followup_type`
  MODIFY `m_followup_type_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `master_industry`
--
ALTER TABLE `master_industry`
  MODIFY `m_industry_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `master_journey_stage`
--
ALTER TABLE `master_journey_stage`
  MODIFY `m_journey_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=86;

--
-- AUTO_INCREMENT for table `master_lms_menu`
--
ALTER TABLE `master_lms_menu`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=83;

--
-- AUTO_INCREMENT for table `master_marital_status`
--
ALTER TABLE `master_marital_status`
  MODIFY `m_marital_status_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `master_marketing_channel`
--
ALTER TABLE `master_marketing_channel`
  MODIFY `mmc_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `master_mis_report`
--
ALTER TABLE `master_mis_report`
  MODIFY `m_report_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=84;

--
-- AUTO_INCREMENT for table `master_occupation`
--
ALTER TABLE `master_occupation`
  MODIFY `m_occupation_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `master_payment_mode`
--
ALTER TABLE `master_payment_mode`
  MODIFY `mpm_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `master_pincode`
--
ALTER TABLE `master_pincode`
  MODIFY `m_pincode_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21014;

--
-- AUTO_INCREMENT for table `master_providers`
--
ALTER TABLE `master_providers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `master_qualification`
--
ALTER TABLE `master_qualification`
  MODIFY `m_qualification_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `master_relation_type`
--
ALTER TABLE `master_relation_type`
  MODIFY `mrt_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `master_residence_type`
--
ALTER TABLE `master_residence_type`
  MODIFY `m_residence_type_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `master_role_type`
--
ALTER TABLE `master_role_type`
  MODIFY `role_type_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `master_role_wise_buckets`
--
ALTER TABLE `master_role_wise_buckets`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `master_salary_mode`
--
ALTER TABLE `master_salary_mode`
  MODIFY `m_salary_mode_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `master_services`
--
ALTER TABLE `master_services`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `master_sms_template`
--
ALTER TABLE `master_sms_template`
  MODIFY `m_st_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `master_state`
--
ALTER TABLE `master_state`
  MODIFY `m_state_id` mediumint(8) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT for table `master_status`
--
ALTER TABLE `master_status`
  MODIFY `status_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=50;

--
-- AUTO_INCREMENT for table `master_templates`
--
ALTER TABLE `master_templates`
  MODIFY `temp_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `mis_access_logs`
--
ALTER TABLE `mis_access_logs`
  MODIFY `mal_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17214;

--
-- AUTO_INCREMENT for table `mobileapp_login_trans`
--
ALTER TABLE `mobileapp_login_trans`
  MODIFY `mlt_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `support_categories`
--
ALTER TABLE `support_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `support_tickets`
--
ALTER TABLE `support_tickets`
  MODIFY `ticket_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `support_ticket_logs`
--
ALTER TABLE `support_ticket_logs`
  MODIFY `log_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_bank_details`
--
ALTER TABLE `tbl_bank_details`
  MODIFY `bank_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26115;

--
-- AUTO_INCREMENT for table `tbl_cibil`
--
ALTER TABLE `tbl_cibil`
  MODIFY `cibil_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35317;

--
-- AUTO_INCREMENT for table `tbl_cibil_log`
--
ALTER TABLE `tbl_cibil_log`
  MODIFY `cibil_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=44893;

--
-- AUTO_INCREMENT for table `tbl_collection_followup`
--
ALTER TABLE `tbl_collection_followup`
  MODIFY `followup_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbl_product`
--
ALTER TABLE `tbl_product`
  MODIFY `product_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `tbl_rejection_master`
--
ALTER TABLE `tbl_rejection_master`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=68;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=213;

--
-- AUTO_INCREMENT for table `user_activity_log`
--
ALTER TABLE `user_activity_log`
  MODIFY `ual_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=100738;

--
-- AUTO_INCREMENT for table `user_export_permission`
--
ALTER TABLE `user_export_permission`
  MODIFY `export_permission_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=843;

--
-- AUTO_INCREMENT for table `user_lead_allocation_log`
--
ALTER TABLE `user_lead_allocation_log`
  MODIFY `ula_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_mis_permission`
--
ALTER TABLE `user_mis_permission`
  MODIFY `mis_permission_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2448;

--
-- AUTO_INCREMENT for table `user_roles`
--
ALTER TABLE `user_roles`
  MODIFY `user_role_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=375;

--
-- AUTO_INCREMENT for table `user_role_locations`
--
ALTER TABLE `user_role_locations`
  MODIFY `user_rl_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_target_allocation_log`
--
ALTER TABLE `user_target_allocation_log`
  MODIFY `uta_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
