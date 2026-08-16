import { apiFetch, apiFetchBlob } from '@/lib/api';

export type DocumentType = {
  id: number;
  name: string;
  isRequired: boolean;
};

export type CustomerBanking = {
  id: number;
  createdAt: string;
  bankName: string;
  ifscCode: string;
  accountNumber: string;
  beneficiaryName: string;
  branch: string | null;
  accountStatusId: number | null;
};

export type BankAccountStatus = {
  id: number;
  name: string | null;
};

export type LeadDocument = {
  id: number;
  createdAt: string;
  filePath: string;
  documentType: DocumentType | null;
  uploadedBy: { id: number; name: string } | null;
};

export function listDocumentTypes() {
  return apiFetch<DocumentType[]>('/api/v1/document-types');
}

export function listBanking(leadId: number) {
  return apiFetch<CustomerBanking[]>(`/api/v1/leads/${leadId}/banking`);
}

export function createBanking(
  leadId: number,
  dto: {
    bankName: string;
    ifscCode: string;
    accountNumber: string;
    confirmAccountNumber: string;
    beneficiaryName: string;
    branch?: string;
  },
) {
  return apiFetch<CustomerBanking>(`/api/v1/leads/${leadId}/banking`, {
    method: 'POST',
    body: dto,
  });
}

export function listBankAccountStatuses() {
  return apiFetch<BankAccountStatus[]>('/api/v1/bank-account-statuses');
}

export function setBankAccountStatus(
  leadId: number,
  bankingId: number,
  accountStatusId: number,
) {
  return apiFetch<CustomerBanking>(
    `/api/v1/leads/${leadId}/banking/${bankingId}/status`,
    { method: 'PATCH', body: { accountStatusId } },
  );
}

export function listDocuments(leadId: number) {
  return apiFetch<LeadDocument[]>(`/api/v1/leads/${leadId}/documents`);
}

export function uploadDocument(
  leadId: number,
  dto: { filePath: string; documentTypeId?: number },
) {
  return apiFetch<LeadDocument>(`/api/v1/leads/${leadId}/documents`, {
    method: 'POST',
    body: dto,
  });
}

export function recordDocumentDownload(leadId: number, documentId: number) {
  return apiFetch<LeadDocument>(
    `/api/v1/leads/${leadId}/documents/${documentId}/download`,
    { method: 'POST' },
  );
}

export function removeDocument(leadId: number, documentId: number) {
  return apiFetch<void>(`/api/v1/leads/${leadId}/documents/${documentId}`, {
    method: 'DELETE',
  });
}

/** Downloads every KYC document uploaded for a lead as a single zip
 * (`GET /leads/:leadId/documents/kyc-zip`) and saves it via a synthetic
 * anchor click, since the browser has no other trigger for a blob download. */
export async function downloadKycZip(leadId: number): Promise<void> {
  const blob = await apiFetchBlob(`/api/v1/leads/${leadId}/documents/kyc-zip`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lead-${leadId}-kyc-docs.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
