// Shared frontend types — populated as the API surface grows.

export type Uuid = string;

export type IsoDateTime = string;

export type ApiError = {
  message: string;
  status: number;
  details?: unknown;
};

export type UserRole =
  | 'CANDIDATE'
  | 'RECRUITER'
  | 'ERM'
  | 'HR_COMPLIANCE'
  | 'TECHNICAL_EVALUATOR'
  | 'ADMIN';

export interface User {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  roles: UserRole[];
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  fullName: string;
  roles: UserRole[];
}
