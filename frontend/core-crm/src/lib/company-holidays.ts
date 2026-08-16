import { apiFetch } from '@/lib/api';

export type CompanyHoliday = {
  id: number;
  holidayDate: string;
  name: string;
};

export function listCompanyHolidays() {
  return apiFetch<CompanyHoliday[]>('/api/v1/company-holidays');
}

export function createCompanyHoliday(dto: {
  holidayDate: string;
  name: string;
}) {
  return apiFetch<CompanyHoliday>('/api/v1/company-holidays', {
    method: 'POST',
    body: dto,
  });
}

export function removeCompanyHoliday(id: number) {
  return apiFetch<void>(`/api/v1/company-holidays/${id}`, {
    method: 'DELETE',
  });
}
