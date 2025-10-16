import { useState, useEffect, useCallback } from "react";
import {
  login,
  logout,
  getCurrentUserFromDBFirst,
  updateUserInfoPersistent,
  isLoggedIn,
} from "../services/zalo-auth-simple";
import { ZaloUser, UpdateProfileRequest } from "../types/auth";

export function useZaloAuth() {
  const [user, setUser] = useState<ZaloUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check login status on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setIsLoading(true);
        if (isLoggedIn()) {
          const currentUser = await getCurrentUserFromDBFirst();
          setUser(currentUser);
        }
      } catch (err: any) {
        setError(err.message || "Lỗi kiểm tra trạng thái đăng nhập");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const loginUser = useCallback(async (): Promise<ZaloUser> => {
    try {
      setIsLoading(true);
      setError(null);
      const userData = await login();
      setUser(userData);
      return userData;
    } catch (err: any) {
      setError(err.message || "Đăng nhập thất bại");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logoutUser = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      logout();
      setUser(null);
    } catch (err: any) {
      setError(err.message || "Đăng xuất thất bại");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates: UpdateProfileRequest): Promise<ZaloUser> => {
    try {
      setIsLoading(true);
      setError(null);
      const updatedUser = await updateUserInfoPersistent(updates);
      if (!updatedUser) {
        throw new Error("Cập nhật thông tin thất bại");
      }
      setUser(updatedUser);
      return updatedUser;
    } catch (err: any) {
      setError(err.message || "Cập nhật thông tin thất bại");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);


  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      if (isLoggedIn()) {
        const currentUser = await getCurrentUserFromDBFirst();
        setUser(currentUser);
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khi làm mới thông tin");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    isLoggedIn: !!user,
    isLoading,
    error,
    login: loginUser,
    logout: logoutUser,
    updateProfile,
    refreshUser,
  };
}
