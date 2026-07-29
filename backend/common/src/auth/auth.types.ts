export interface AccessTokenPayload {
  sub: number;
  email: string;
  roles: string[];
}

export type AuthenticatedUser = AccessTokenPayload;
