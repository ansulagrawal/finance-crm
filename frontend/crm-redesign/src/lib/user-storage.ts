import { decryptJson, encryptJson } from '@/lib/crypto';

export type SafeUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

const USER_KEY = 'finance-crm_user';

export async function storeUser(user: SafeUser): Promise<void> {
  localStorage.setItem(USER_KEY, await encryptJson(user));
}

export async function loadStoredUser(): Promise<SafeUser | null> {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  return decryptJson<SafeUser>(raw);
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_KEY);
}
