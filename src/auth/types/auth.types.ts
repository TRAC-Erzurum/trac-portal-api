import { Role } from '../enums/role.enum';

export interface GoogleProfile {
  id: string;
  emails: Array<{ value: string }>;
  name: {
    givenName: string;
    familyName: string;
  };
  photos: Array<{ value: string }>;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  callSign?: string;
  provider: string;
  providerId?: string | null;
  fullName?: string | null;
  picture?: string | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  provider: string;
  role: Role;
  callSign?: string;
}
