import { apiFetch } from '@/lib/api';

export type VisitAddressType = 'RESIDENCE' | 'OFFICE';
export type VisitFieldStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'CANCELLED'
  | 'HOLD'
  | 'COMPLETED';
export type CollectionVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type PaymentMode = { id: number; name: string };
export type FollowupType = { id: number; name: string; icon: string | null };
export type FollowupStatus = { id: number; name: string };
export type BlacklistReason = { id: number; name: string };

/** Legacy's local convention on `CollectionController::
 * get_followup_template_lists()` (`2=>SMS, 4=>EMAIL`) — not
 * `master_followup_type` row ids. WhatsApp (3) always returns an empty
 * list, never finished in legacy. */
export type FollowupTemplateType = 2 | 4;

export type SmsFollowupTemplate = {
  id: number;
  templateId: string;
  description: string | null;
  content: string;
};

export type EmailFollowupTemplate = {
  id: number;
  title: string;
  description: string | null;
  content: string;
};

export type CollectionFollowup = {
  id: number;
  createdAt: string;
  type: FollowupType;
  status: FollowupStatus | null;
  user: { id: number; name: string } | null;
  remarks: string | null;
  nextFollowupAt: string | null;
};

export type CollectionVisit = {
  id: number;
  createdAt: string;
  requestedBy: { id: number; name: string } | null;
  allocatedTo: { id: number; name: string } | null;
  addressType: VisitAddressType;
  fieldStatus: VisitFieldStatus;
  remarks: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
};

export type Payment = {
  id: number;
  createdAt: string;
  paymentMode: PaymentMode | null;
  repaymentType: { id: number; name: string } | null;
  collectionExecutive: { id: number; name: string } | null;
  closedBy: { id: number; name: string } | null;
  receivedAmount: string;
  discount: string | null;
  refund: string | null;
  referenceNo: string | null;
  receivedDate: string | null;
  verificationStatus: CollectionVerificationStatus;
  remarks: string | null;
  closureRemarks: string | null;
  closedAt: string | null;
};

export type BlacklistEntry = {
  id: number;
  createdAt: string;
  reason: BlacklistReason | null;
  createdBy: { id: number; name: string } | null;
  remarks: string | null;
};

// Lookups
export function listPaymentModes() {
  return apiFetch<PaymentMode[]>('/api/v1/payment-modes');
}

export function listFollowupTypes() {
  return apiFetch<FollowupType[]>('/api/v1/followup-types');
}

export function listFollowupStatuses() {
  return apiFetch<FollowupStatus[]>('/api/v1/followup-statuses');
}

export function listBlacklistReasons() {
  return apiFetch<BlacklistReason[]>('/api/v1/blacklist-reasons');
}

// Followups
export function listCollectionFollowups(leadId: number) {
  return apiFetch<CollectionFollowup[]>(
    `/api/v1/leads/${leadId}/collection-followups`,
  );
}

export function createCollectionFollowup(
  leadId: number,
  dto: {
    typeId: number;
    statusId?: number;
    remarks?: string;
    nextFollowupAt?: string;
  },
) {
  return apiFetch<CollectionFollowup>(
    `/api/v1/leads/${leadId}/collection-followups`,
    { method: 'POST', body: dto },
  );
}

export function listFollowupTemplates(typeId: FollowupTemplateType) {
  return apiFetch<Array<SmsFollowupTemplate | EmailFollowupTemplate>>(
    `/api/v1/followup-templates?typeId=${typeId}`,
  );
}

export function renderFollowupTemplateContent(
  leadId: number,
  templateId: number,
  typeId: FollowupTemplateType,
) {
  return apiFetch<{ subject: string | null; content: string }>(
    `/api/v1/leads/${leadId}/collection-followups/templates/${templateId}?typeId=${typeId}`,
  );
}

// Visits
export function listCollectionVisits(leadId: number) {
  return apiFetch<CollectionVisit[]>(
    `/api/v1/leads/${leadId}/collection-visits`,
  );
}

export function createCollectionVisit(
  leadId: number,
  dto: {
    addressType: VisitAddressType;
    remarks?: string;
    scheduledAt?: string;
  },
) {
  return apiFetch<CollectionVisit>(
    `/api/v1/leads/${leadId}/collection-visits`,
    { method: 'POST', body: dto },
  );
}

export function assignCollectionVisit(
  leadId: number,
  visitId: number,
  allocatedToUserId: number,
) {
  return apiFetch<CollectionVisit>(
    `/api/v1/leads/${leadId}/collection-visits/${visitId}/assign`,
    { method: 'PATCH', body: { allocatedToUserId } },
  );
}

export function updateCollectionVisitStatus(
  leadId: number,
  visitId: number,
  dto: { fieldStatus: VisitFieldStatus; remarks?: string },
) {
  return apiFetch<CollectionVisit>(
    `/api/v1/leads/${leadId}/collection-visits/${visitId}/status`,
    { method: 'PATCH', body: dto },
  );
}

// Payments
export function listPayments(leadId: number) {
  return apiFetch<Payment[]>(`/api/v1/leads/${leadId}/payments`);
}

export function createPayment(
  leadId: number,
  dto: {
    receivedAmount: number;
    loanNumber: string;
    repaymentTypeId: number;
    referenceNo: string;
    paymentModeId?: number;
    discount?: number;
    refund?: number;
    receivedDate?: string;
    remarks?: string;
  },
) {
  return apiFetch<Payment>(`/api/v1/leads/${leadId}/payments`, {
    method: 'POST',
    body: dto,
  });
}

export function verifyPayment(
  leadId: number,
  paymentId: number,
  dto: {
    verificationStatus: CollectionVerificationStatus;
    closureRemarks?: string;
  },
) {
  return apiFetch<Payment>(
    `/api/v1/leads/${leadId}/payments/${paymentId}/verify`,
    { method: 'PATCH', body: dto },
  );
}

// Blacklist
export function listBlacklistEntries(leadId: number) {
  return apiFetch<BlacklistEntry[]>(`/api/v1/leads/${leadId}/blacklist`);
}

export function blacklistLead(
  leadId: number,
  dto: { reasonId?: number; remarks?: string },
) {
  return apiFetch<BlacklistEntry>(`/api/v1/leads/${leadId}/blacklist`, {
    method: 'POST',
    body: dto,
  });
}
