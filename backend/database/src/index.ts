// Barrel export of every entity, grouped by domain folder as they're ported
// from old/database/src/entities against the legacy schema (docs/SCHEMA-MAP.md).

export * from './entities/geography/state.entity';
export * from './entities/geography/city.entity';
export * from './entities/geography/branch.entity';
export * from './entities/geography/pincode.entity';
export * from './entities/geography/data-source.entity';

export * from './entities/company/company.entity';
export * from './entities/company/product.entity';
export * from './entities/company/company-holiday.entity';

export * from './entities/geography/blacklisted-pincode.entity';

export * from './entities/users/role-type.entity';
export * from './entities/users/user.entity';
export * from './entities/users/user-role.entity';
export * from './entities/users/user-role-location.entity';
export * from './entities/users/user-activity-log.entity';
export * from './entities/users/user-target-allocation.entity';
export * from './entities/users/user-lead-allocation-log.entity';

export * from './entities/auth/password-reset-request.entity';
export * from './entities/auth/refresh-token.entity';

export * from './entities/menu-permissions/menu-item.entity';
export * from './entities/menu-permissions/user-export-permission.entity';
export * from './entities/menu-permissions/user-mis-permission.entity';

export * from './entities/master-status.entity';

export * from './entities/leads/marital-status.entity';
export * from './entities/leads/occupation.entity';
export * from './entities/leads/qualification.entity';
export * from './entities/leads/religion.entity';
export * from './entities/leads/cif-customer.entity';
export * from './entities/leads/customer-profile.entity';
export * from './entities/leads/rejection-reason.entity';
export * from './entities/leads/lead.entity';
export * from './entities/leads/lead-customer.entity';
export * from './entities/leads/lead-employment.entity';
export * from './entities/leads/lead-followup.entity';
export * from './entities/leads/lead-customer-reference.entity';

export * from './entities/bre/bre-category.entity';
export * from './entities/bre/bre-rule.entity';
export * from './entities/bre/bre-rule-result.entity';

export * from './entities/cam/credit-analysis-memo.entity';

export * from './entities/disbursal/disbursal-authorised-user.entity';
export * from './entities/disbursal/disbursement-bank.entity';
export * from './entities/disbursal/disbursement-transaction-log.entity';
export * from './entities/disbursal/loan.entity';

export * from './entities/collection/payment-mode.entity';
export * from './entities/collection/followup-status.entity';
export * from './entities/collection/followup-type.entity';
export * from './entities/collection/blacklist-reason.entity';
export * from './entities/collection/collection-bucket.entity';
export * from './entities/collection/collection.entity';
export * from './entities/collection/customer-blacklist.entity';
export * from './entities/collection/loan-collection-followup.entity';
export * from './entities/collection/loan-collection-visit.entity';
export * from './entities/collection/legal-email-log.entity';
export * from './entities/collection/email-template.entity';
export * from './entities/collection/user-collection-bucket-permission.entity';

export * from './entities/verification/bank-type.entity';
export * from './entities/verification/bank-account-status.entity';
export * from './entities/verification/document-type.entity';
export * from './entities/verification/document.entity';
export * from './entities/verification/document-download-log.entity';
export * from './entities/verification/customer-banking.entity';

export * from './entities/field-verification/field-verification-visit.entity';

export * from './entities/feedback/feedback-question.entity';
export * from './entities/feedback/feedback-answer.entity';
export * from './entities/feedback/customer-feedback.entity';
export * from './entities/feedback/customer-feedback-response.entity';

export * from './entities/reporting/export-catalog.entity';
export * from './entities/reporting/mis-report-catalog.entity';
export * from './entities/reporting/export-access-log.entity';
export * from './entities/reporting/mis-access-log.entity';

export * from './entities/audit/lead-audit.entity';

export * from './entities/integrations/api-call-status';
export * from './entities/integrations/api-provider';
export * from './entities/integrations/ekyc-log.entity';
export * from './entities/integrations/account-aggregator-log.entity';
export * from './entities/integrations/bank-verification-log.entity';
export * from './entities/integrations/bank-analysis-log.entity';
export * from './entities/integrations/upi-callback-log.entity';
export * from './entities/integrations/disbursement-api-log.entity';
export * from './entities/integrations/domain-verification-log.entity';
export * from './entities/integrations/email-log.entity';
export * from './entities/integrations/email-verification-log.entity';
export * from './entities/integrations/enach-log.entity';
export * from './entities/integrations/esign-log.entity';
export * from './entities/integrations/face-match-log.entity';
export * from './entities/integrations/middleware-api-log.entity';
export * from './entities/integrations/poi-verification-log.entity';
export * from './entities/integrations/repayment-log.entity';
export * from './entities/integrations/reverse-geocode-log.entity';
export * from './entities/integrations/sms-log.entity';
export * from './entities/integrations/upi-collection-log.entity';
export * from './entities/integrations/video-kyc-log.entity';
export * from './entities/integrations/crif-bureau-log.entity';
export * from './entities/integrations/vendor-api-cache.entity';
export * from './entities/integrations/sms-template.entity';
export * from './entities/integrations/address-lat-long-log.entity';
export * from './entities/integrations/address-distance-log.entity';
export * from './entities/integrations/call-management-log.entity';
export * from './entities/integrations/video-kyc-callback-log.entity';
export * from './entities/integrations/email-validation-log.entity';
export * from './entities/integrations/uan-verification-log.entity';

export * from './entities/settings/crm-setting.entity';
