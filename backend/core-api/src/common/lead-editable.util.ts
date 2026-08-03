import type { Lead } from '@finance-crm/database';
import { ForbiddenException } from '@nestjs/common';

/**
 * Legacy `SupportController` blocked ops-driven overrides of a lead's
 * personal/employment/bank/CAM/document/transaction data unless the lead
 * was in one of these stages — not yet disbursed, and not already
 * rejected/cancelled/closed. Mirrors the legacy `$allow_status_id`
 * allow-list (`master_statuses.json`'s `legacyId`s 2,3,4,5,6,7,8,10,11,12,
 * 13,25,30,35,37), translated to this schema's `MasterStatus.name`.
 */
const SUPPORT_EDITABLE_STATUS_NAMES = new Set([
  'LEAD-INPROCESS',
  'LEAD-HOLD',
  'APPLICATION-NEW',
  'APPLICATION-INPROCESS',
  'APPLICATION-HOLD',
  'DUPLICATE',
  'SYSTEM-REJECT',
  'APPLICATION-RECOMMENDED',
  'APPLICATION-SEND-BACK',
  'SANCTION',
  'DISBURSE-PENDING',
  'DISBURSAL-NEW',
  'DISBURSAL-INPROCESS',
  'DISBURSAL-HOLD',
  'DISBURSAL-SEND-BACK',
]);

export function assertLeadEditableBySupport(lead: Lead): void {
  const statusName = lead.leadStatus?.name;
  if (!statusName || !SUPPORT_EDITABLE_STATUS_NAMES.has(statusName)) {
    throw new ForbiddenException(
      `Lead ${lead.id} is in status '${statusName ?? 'UNKNOWN'}' — support overrides are only allowed while the lead is active and not yet disbursed`,
    );
  }
}
