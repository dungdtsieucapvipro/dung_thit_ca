export interface ZaloUser {
  id: string;
  name?: string;
  avatar?: string;
  phone?: string;
  email?: string;
  lastLogin?: string;
}

export interface AuthState {
  user: ZaloUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginResponse {
  success: boolean;
  user?: ZaloUser;
  error?: string;
}

export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  email?: string;
}
