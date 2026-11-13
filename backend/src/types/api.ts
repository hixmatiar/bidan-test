export type Role = 'BIDAN' | 'ADMIN';

export interface AuthUser {
  user_id: string;
  username: string;
  role: Role;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiSuccess<T> {
  status: 'success';
  data: T;
  message: string;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  status: 'error';
  error_code: string;
  message: string;
  errors: ApiErrorDetail[];
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
