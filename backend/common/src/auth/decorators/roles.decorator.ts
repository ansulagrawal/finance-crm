import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roleCodes: string[]) =>
  SetMetadata(ROLES_KEY, roleCodes);
