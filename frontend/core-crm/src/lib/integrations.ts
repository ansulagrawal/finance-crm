import { apiFetch } from '@/lib/api';

export type ApiCallStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR';

export type CrifBureauLog = {
  id: number;
  mobile: string;
  response: string | null;
  cibilScore: string | null;
  reportId: string | null;
  status: ApiCallStatus;
  errors: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

export function fetchCrifReport(dto: {
  leadId: number;
  firstName: string;
  lastName: string;
  mobile: string;
  pan: string;
}) {
  return apiFetch<CrifBureauLog>('/api/v1/integrations/crif-bureau/report', {
    method: 'POST',
    body: dto,
  });
}

export type BankVerificationLog = {
  id: number;
  status: ApiCallStatus;
  errors: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

export function verifyBankAccount(dto: {
  leadId: number;
  beneficiaryAccount: string;
  beneficiaryName: string;
  beneficiaryIfsc: string;
  beneficiaryMobile?: string;
  beneficiaryEmail?: string;
}) {
  return apiFetch<BankVerificationLog>(
    '/api/v1/integrations/bank-verification',
    {
      method: 'POST',
      body: dto,
    },
  );
}

export type UanVerificationLog = {
  id: number;
  uanFound: boolean;
  uanNumbers: string | null;
  employerName: string | null;
  status: ApiCallStatus;
  errors: string | null;
};

export function verifyUan(dto: {
  leadId: number;
  mobileNumber: string;
  panNumber: string;
}) {
  return apiFetch<UanVerificationLog>('/api/v1/integrations/uan-verification', {
    method: 'POST',
    body: dto,
  });
}

export type RazorpayPaymentLinkLog = {
  id: number;
  orderId: string | null;
  amount: string | null;
  statusId: number | null;
  errors: string | null;
  response: string | null;
};

export function createRazorpayPaymentLink(dto: {
  leadId: number;
  minPartialAmount: number;
}) {
  return apiFetch<RazorpayPaymentLinkLog>(
    '/api/v1/integrations/razorpay/payment-links',
    { method: 'POST', body: dto },
  );
}

/** Razorpay's Payment Links API response includes a `short_url` field —
 * the log only stores the raw response JSON, so this parses it out for
 * display rather than adding a dedicated column on the backend. */
export function extractRazorpayShortUrl(
  log: RazorpayPaymentLinkLog,
): string | null {
  if (!log.response) return null;
  try {
    const parsed = JSON.parse(log.response) as { short_url?: string };
    return parsed.short_url ?? null;
  } catch {
    return null;
  }
}

export type AccountAggregatorLog = {
  id: number;
  consentHandleId: string | null;
  consentId: string | null;
  sessionId: string | null;
  responsePayload: string | null;
  status: ApiCallStatus;
  statusMessage: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

export type AaTransaction = {
  date: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  narration?: string;
  balance?: number;
};

export type AaMonthlySummary = {
  yearMonth: string;
  credits: number;
  debits: number;
  netChange: number;
  closingBalance: number | null;
  transactionCount: number;
};

export type AaFiData = {
  transactions: AaTransaction[];
  monthlySummary: AaMonthlySummary[];
};

export function requestAaConsent(dto: {
  leadId: number;
  mobileNumber: string;
}) {
  return apiFetch<AccountAggregatorLog>(
    '/api/v1/integrations/account-aggregator/consent-request',
    { method: 'POST', body: dto },
  );
}

export function getAaConsentStatus(leadId: number) {
  return apiFetch<AccountAggregatorLog>(
    `/api/v1/integrations/account-aggregator/leads/${leadId}/consent-status`,
  );
}

export function requestAaFi(
  leadId: number,
  dto: { fromDate: string; toDate: string },
) {
  return apiFetch<AccountAggregatorLog>(
    `/api/v1/integrations/account-aggregator/leads/${leadId}/fi-request`,
    { method: 'POST', body: dto },
  );
}

export function getAaFiStatus(leadId: number) {
  return apiFetch<AccountAggregatorLog>(
    `/api/v1/integrations/account-aggregator/leads/${leadId}/fi-status`,
  );
}

export function getAaFiData(leadId: number) {
  return apiFetch<AaFiData>(
    `/api/v1/integrations/account-aggregator/leads/${leadId}/fi-data`,
  );
}

export function getAaAnalyticsReport(leadId: number) {
  return apiFetch<AccountAggregatorLog>(
    `/api/v1/integrations/account-aggregator/leads/${leadId}/analytics-report`,
  );
}

export type EkycLog = {
  id: number;
  methodId: number;
  aadhaarNo: string | null;
  status: ApiCallStatus;
  errors: string | null;
  returnUrl: string | null;
  returnRequestId: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

export function createDigilockerUrl(leadId: number) {
  return apiFetch<EkycLog>(
    `/api/v1/integrations/ekyc/digilocker/create-url?leadId=${leadId}`,
    { method: 'POST' },
  );
}

export function getDigilockerDetails(leadId: number) {
  return apiFetch<EkycLog>(
    `/api/v1/integrations/ekyc/digilocker/details?leadId=${leadId}`,
    { method: 'POST' },
  );
}

export function getDigilockerEaadhaar(leadId: number) {
  return apiFetch<EkycLog>(
    `/api/v1/integrations/ekyc/digilocker/e-aadhaar?leadId=${leadId}`,
    { method: 'POST' },
  );
}

export type EsignLog = {
  id: number;
  methodId: number;
  aadhaarNo: string | null;
  status: ApiCallStatus;
  errors: string | null;
  returnUrl: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

export function initiateEsign(dto: {
  leadId: number;
  documentBase64: string;
  signerName: string;
  signerMobile: string;
  signerEmail: string;
  signerGender?: string;
  aadhaarLastFourDigits: string;
  signerYearOfBirth?: string;
}) {
  return apiFetch<EsignLog>('/api/v1/integrations/esign/initiate', {
    method: 'POST',
    body: dto,
  });
}

export function downloadEsignDocument(leadId: number) {
  return apiFetch<EsignLog>(
    `/api/v1/integrations/esign/download?leadId=${leadId}`,
    { method: 'POST' },
  );
}

export type VideoKycLog = {
  id: number;
  requestId: string | null;
  status: ApiCallStatus;
  errors: string | null;
  returnUrl: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

export function createVideoKycSession(dto: {
  leadId: number;
  customerFullName: string;
  loanAmount: number;
  repaymentDate: string;
  repaymentAmount: number;
}) {
  return apiFetch<VideoKycLog>('/api/v1/integrations/video-kyc/sessions', {
    method: 'POST',
    body: dto,
  });
}

export type FaceMatchLog = {
  id: number;
  matchPercentage: string | null;
  status: ApiCallStatus;
  errors: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

export function verifyFaceMatch(dto: {
  leadId: number;
  firstImageUrl: string;
  secondImageUrl: string;
}) {
  return apiFetch<FaceMatchLog>('/api/v1/integrations/face-match', {
    method: 'POST',
    body: dto,
  });
}

export type PoiVerificationLog = {
  id: number;
  methodId: number;
  proofNo: string | null;
  fatherName: string | null;
  status: ApiCallStatus;
  errors: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

export function verifyPan(dto: { leadId: number; pan: string }) {
  return apiFetch<PoiVerificationLog>(
    '/api/v1/integrations/poi-verification/pan',
    { method: 'POST', body: dto },
  );
}

export function ocrPan(dto: { leadId: number; documentUrl: string }) {
  return apiFetch<PoiVerificationLog>(
    '/api/v1/integrations/poi-verification/pan-ocr',
    { method: 'POST', body: dto },
  );
}

export function ocrAadhaar(dto: { leadId: number; documentUrl: string }) {
  return apiFetch<PoiVerificationLog>(
    '/api/v1/integrations/poi-verification/aadhaar-ocr',
    { method: 'POST', body: dto },
  );
}

export type SmsSendLog = {
  id: number;
  mobile: string;
  apiStatus: ApiCallStatus;
  errors: string | null;
};

/** Generic transactional SMS send (`POST /sms/send`) — takes a
 * caller-composed message/DLT templateId. The collection-followup card can
 * pre-fill both from `collection.ts`'s `listFollowupTemplates`/
 * `renderFollowupTemplateContent` catalog picker, but still sends through
 * this same generic endpoint. */
export function sendGenericSms(dto: {
  leadId: number;
  mobile: string;
  message: string;
  templateId: string;
  typeId: number;
}) {
  return apiFetch<SmsSendLog>('/api/v1/integrations/sms/send', {
    method: 'POST',
    body: dto,
  });
}

export type EmailSendLog = {
  id: number;
  emailAddress: string;
  apiStatus: ApiCallStatus;
  errors: string | null;
};

/** Generic transactional email send (`POST /email/send`) — same
 * "caller composes their own content" shape as `sendGenericSms`. */
export function sendGenericEmail(dto: {
  leadId: number;
  email: string;
  cc?: string;
  subject: string;
  html: string;
  typeId: number;
}) {
  return apiFetch<EmailSendLog>('/api/v1/integrations/email/send', {
    method: 'POST',
    body: dto,
  });
}

export type AddressLatLongLog = {
  id: number;
  latitude: string | null;
  longitude: string | null;
  status: ApiCallStatus;
  errors: string | null;
};

/** Geocodes a free-text address to lat/long via Digitap (`POST
 * /address-lat-long`). Ports legacy's `ADDRESS_TO_LAT_LONG_DIGITAP` call —
 * the first of two steps `VerificationController::
 * calculateAadhaartoLiveLocationDistance()` runs server-side in one shot;
 * this port splits it into two endpoints, so the caller composes the
 * address text itself (from `LeadCustomer`'s stored current/Aadhaar
 * address fields) rather than the backend deriving it internally. */
export function calculateAddressLatLong(dto: {
  leadId: number;
  address: string;
  addressType: 1 | 2;
}) {
  return apiFetch<AddressLatLongLog>('/api/v1/integrations/address-lat-long', {
    method: 'POST',
    body: dto,
  });
}

export type AddressDistanceLog = {
  id: number;
  distanceKm: string | null;
  status: ApiCallStatus;
  errors: string | null;
};

/** Second step of the residence-distance check — combines the Aadhaar
 * address lat/long (from `calculateAddressLatLong`) with the customer's
 * live-location fix (captured automatically via the mobile app's
 * reverse-geocode callback, not staff-triggered — see `docs/BLOCKED.md`) via
 * Google Distance Matrix, and stores the result on
 * `LeadCustomer.residenceDistanceKm`. */
export function calculateAddressDistance(dto: { leadId: number }) {
  return apiFetch<AddressDistanceLog>('/api/v1/integrations/address-distance', {
    method: 'POST',
    body: dto,
  });
}

export type BankAnalysisLog = {
  id: number;
  novelReturnDocId: string | null;
  response: string | null;
  status: ApiCallStatus;
  errors: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

/** CartBI ("Novel Pattern" internally) bank-statement upload. CartBI
 * processes asynchronously and calls back via its own webhook; the parsed
 * result is fetched separately once ready via `getBankAnalysisResult`. */
export function uploadBankAnalysis(dto: {
  leadId: number;
  documentId: number;
}) {
  return apiFetch<BankAnalysisLog>(
    '/api/v1/integrations/bank-analysis/upload',
    {
      method: 'POST',
      body: dto,
    },
  );
}

export type BankAnalysisResult = {
  respondedAt: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  accountName: string | null;
  accountType: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  fraudScore: number | null;
  totalNetCredits: number | null;
  averageBalance: number | null;
  averageBalanceLastThreeMonth: number | null;
  averageBalanceLastSixMonth: number | null;
  minBalanceLastThreeMonth: number | null;
  minBalanceLastSixMonth: number | null;
};

/** Fetches the parsed CartBI result once the async callback has completed
 * (`GET /bank-analysis/leads/:leadId/result`) — 404s until then, which
 * callers should treat as "not ready yet", not an error. */
export function getBankAnalysisResult(leadId: number) {
  return apiFetch<BankAnalysisResult>(
    `/api/v1/integrations/bank-analysis/leads/${leadId}/result`,
  );
}

export type EnachLog = {
  id: number;
  loanNumber: string;
  transactionId: string;
  mandateId: string | null;
  response: string | null;
  statusCode: string | null;
  status: ApiCallStatus;
  errors: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

export function initiateEnachTransaction(dto: {
  loanNumber: string;
  mandateRegistrationNo: string;
  requestedAmount: number;
  requestedEndDate: string;
}) {
  return apiFetch<EnachLog>('/api/v1/integrations/enach/transactions', {
    method: 'POST',
    body: dto,
  });
}

export type DomainVerificationLog = {
  id: number;
  email: string | null;
  domain: string | null;
  registrationDate: string | null;
  response: string | null;
  status: ApiCallStatus;
  errors: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

export function verifyDomain(dto: { leadId: number; email: string }) {
  return apiFetch<DomainVerificationLog>(
    '/api/v1/integrations/domain-verification',
    { method: 'POST', body: dto },
  );
}

export type EmailVerificationLog = {
  id: number;
  methodId: number;
  email: string | null;
  isValid: boolean | null;
  status: ApiCallStatus;
  errors: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

/** `isPersonalEmail` true (default) = personal email (legacy methodId 1),
 * false = office/alternate email (legacy methodId 2). */
export function verifyEmail(dto: {
  leadId: number;
  email: string;
  isPersonalEmail?: boolean;
}) {
  return apiFetch<EmailVerificationLog>(
    '/api/v1/integrations/email-verification',
    { method: 'POST', body: dto },
  );
}

export type UpiCollectionLog = {
  id: number;
  transactionId: string | null;
  response: string | null;
  status: ApiCallStatus;
  errors: string | null;
  requestedAmount: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

export function requestUpiCollectionQr(dto: {
  leadId: number;
  amount: number;
}) {
  return apiFetch<UpiCollectionLog>('/api/v1/integrations/upi/qr-requests', {
    method: 'POST',
    body: dto,
  });
}

/** `response` is the raw decrypted JSON string (e.g. `{"qrString":"upi://pay?..."}`)
 * — same "log stores raw JSON, extract the field for display" pattern as
 * `extractRazorpayShortUrl`. */
export function extractUpiQrString(log: UpiCollectionLog): string | null {
  if (!log.response) return null;
  try {
    const parsed = JSON.parse(log.response) as { qrString?: string };
    return parsed.qrString ?? null;
  } catch {
    return null;
  }
}
