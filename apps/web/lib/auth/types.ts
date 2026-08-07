export type AuthUser = {
  id: number;
  email: string;
  username: string;
  fullName: string | null;
  role: string;
  image: string | null;
  emailVerified: boolean;
  createdAt?: string;
  updatedAt?: string | null;
};

export type AuthError = {
  message: string;
  code?: string;
  status?: number;
};

export type AuthResult<T> = { data: T; error: null } | { data: null; error: AuthError };

export type LoginResult = {
  type: 'bearer';
  value: string;
  expiresAt: string | null;
  user: AuthUser;
};
