# Hướng dẫn đăng nhập Zalo nâng cấp với TanStack Query

## Chi tiết implementation

### 1. Type Definitions (`src/types/auth.ts`)

```typescript
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
```

### 2. Query Client Configuration (`src/lib/queryClient.ts`)

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // Không retry cho các lỗi authentication
        if (error?.code === -1401 || error?.code === -201) {
          return false;
        }
        // Retry tối đa 3 lần cho các lỗi khác
        return failureCount < 3;
      },
      refetchOnWindowFocus: false, // Không refetch khi focus window
      refetchOnReconnect: true, // Refetch khi reconnect
    },
    mutations: {
      retry: false, // Không retry mutations
    },
  },
});

// Query keys constants
export const QUERY_KEYS = {
  CURRENT_USER: ["user", "current"] as const,
  USER_PROFILE: (userId: string) => ["user", "profile", userId] as const,
  AUTH_STATUS: ["auth", "status"] as const,
} as const;
```

### 3. TanStack Query Hooks (`src/hooks/useZaloAuthQuery.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "../lib/queryClient";
import {
  login,
  logout,
  getCurrentUser,
  updateUserInfo,
  isLoggedIn,
} from "../services/zalo-auth-simple";
import { ZaloUser, UpdateProfileRequest } from "../types/auth";

/**
 * Hook để đăng nhập với Zalo
 */
export function useZaloLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<ZaloUser> => {
      console.log("🚀 Starting Zalo login with TanStack Query...");
      const user = await login();
      console.log("✅ Login successful:", user);
      return user;
    },
    onSuccess: (user) => {
      // Cache user data
      queryClient.setQueryData(QUERY_KEYS.CURRENT_USER, user);
      console.log("💾 User data cached:", user);
    },
    onError: (error) => {
      console.error("❌ Login failed:", error);
    },
  });
}

/**
 * Hook để lấy thông tin user hiện tại
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: QUERY_KEYS.CURRENT_USER,
    queryFn: async (): Promise<ZaloUser | null> => {
      console.log("🔍 Fetching current user...");

      if (!isLoggedIn()) {
        console.log("⚠️ User not logged in");
        return null;
      }

      const user = getCurrentUser();
      console.log("✅ Current user fetched:", user);
      return user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false, // Không retry nếu user chưa đăng nhập
    enabled: true, // Luôn enabled để check login status
  });
}

/**
 * Hook để kiểm tra trạng thái đăng nhập
 */
export function useAuth() {
  const { data: user, isLoading, error, refetch } = useCurrentUser();

  return {
    user,
    isLoggedIn: !!user,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook để đăng xuất
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      console.log("🚪 Logging out...");
      logout();
      console.log("✅ Logout successful");
    },
    onSuccess: () => {
      // Clear user data từ cache
      queryClient.setQueryData(QUERY_KEYS.CURRENT_USER, null);
      // Invalidate tất cả queries liên quan đến user
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CURRENT_USER });
      console.log("🗑️ User data cleared from cache");
    },
    onError: (error) => {
      console.error("❌ Logout failed:", error);
    },
  });
}

/**
 * Hook để cập nhật profile user
 */
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateProfileRequest): Promise<ZaloUser> => {
      console.log("📝 Updating user profile:", updates);

      const updatedUser = updateUserInfo(updates);
      if (!updatedUser) {
        throw new Error("Failed to update user profile");
      }

      console.log("✅ Profile updated:", updatedUser);
      return updatedUser;
    },
    onSuccess: (updatedUser) => {
      // Update cache với user data mới
      queryClient.setQueryData(QUERY_KEYS.CURRENT_USER, updatedUser);
      console.log("💾 Updated user data cached:", updatedUser);
    },
    onError: (error) => {
      console.error("❌ Failed to update user profile:", error);
    },
  });
}

/**
 * Hook để request số điện thoại
 */
export function useRequestPhoneNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<string | undefined> => {
      console.log("📞 Requesting phone number...");

      // Import function từ service
      const { getUserPhoneNumber } = await import(
        "../services/zalo-auth-simple"
      );
      const phone = await getUserPhoneNumber();

      console.log("✅ Phone number received:", phone);
      return phone;
    },
    onSuccess: (phone) => {
      if (phone) {
        // Update user data với số điện thoại mới
        const currentUser = queryClient.getQueryData<ZaloUser>(
          QUERY_KEYS.CURRENT_USER
        );
        if (currentUser) {
          const updatedUser = { ...currentUser, phone };
          queryClient.setQueryData(QUERY_KEYS.CURRENT_USER, updatedUser);
          console.log("💾 Phone number updated in cache");
        }
      }
    },
    onError: (error) => {
      console.error("❌ Failed to request phone number:", error);
    },
  });
}

/**
 * Hook để refresh user data
 */
export function useRefreshUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<ZaloUser | null> => {
      console.log("🔄 Refreshing user data...");

      const user = getCurrentUser();
      console.log("✅ User data refreshed:", user);
      return user;
    },
    onSuccess: (user) => {
      if (user) {
        queryClient.setQueryData(QUERY_KEYS.CURRENT_USER, user);
      } else {
        queryClient.setQueryData(QUERY_KEYS.CURRENT_USER, null);
      }
      console.log("💾 Refreshed user data cached");
    },
    onError: (error) => {
      console.error("❌ Failed to refresh user data:", error);
    },
  });
}

/**
 * Hook để check authentication status
 */
export function useAuthStatus() {
  return useQuery({
    queryKey: QUERY_KEYS.AUTH_STATUS,
    queryFn: () => isLoggedIn(),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### 4. Simple Zalo Authentication Service (`src/services/zalo-auth-simple.ts`)

```typescript
import {
  getUserInfo,
  getPhoneNumber,
  login as zmpLogin,
  authorize,
  getSetting,
  getUserID,
} from "zmp-sdk/apis";

import { ZaloUser } from "../types/auth";

const STORAGE_KEYS = {
  USER_DATA: "zalo_user_data",
  LOGIN_STATUS: "zalo_login_status",
};

// Lưu thông tin user vào localStorage
export function saveUserToStorage(user: ZaloUser): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.LOGIN_STATUS, "true");
    console.log("💾 User saved to localStorage:", user);
  } catch (error) {
    console.error("Failed to save user to storage:", error);
  }
}

// Lấy thông tin user từ localStorage
export function getUserFromStorage(): ZaloUser | null {
  try {
    const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    const user = userData ? JSON.parse(userData) : null;
    console.log("📖 User loaded from localStorage:", user);
    return user;
  } catch (error) {
    console.error("Failed to get user from storage:", error);
    return null;
  }
}

// Kiểm tra trạng thái đăng nhập
export function isLoggedIn(): boolean {
  try {
    const status = localStorage.getItem(STORAGE_KEYS.LOGIN_STATUS) === "true";
    console.log("🔍 Login status checked:", status);
    return status;
  } catch {
    return false;
  }
}

// Xóa thông tin user khỏi localStorage
export function clearUserFromStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    localStorage.removeItem(STORAGE_KEYS.LOGIN_STATUS);
    console.log("🗑️ User data cleared from localStorage");
  } catch (error) {
    console.error("Failed to clear user from storage:", error);
  }
}

// Lấy User ID từ Zalo SDK
export async function getZaloUserId(): Promise<string> {
  try {
    const raw = (await getUserID()) as
      | string
      | { id?: string }
      | { userID?: string };
    const uid =
      typeof raw === "string"
        ? raw
        : (raw as any).id || (raw as any).userID || "";

    if (!uid) {
      throw new Error("Failed to get Zalo User ID");
    }

    console.log("🆔 Zalo User ID:", uid);
    return uid;
  } catch (error) {
    console.error("Error getting Zalo User ID:", error);
    throw error;
  }
}

// Kiểm tra và xin quyền
export async function checkAndRequestPermissions(
  scopes: string[]
): Promise<boolean> {
  try {
    const { authSetting } = await getSetting();

    // Kiểm tra xem đã có quyền chưa
    const hasAllPermissions = scopes.every((scope) => !!authSetting?.[scope]);

    if (!hasAllPermissions) {
      console.log("🔐 Requesting permissions:", scopes);
      // Xin quyền
      await authorize({ scopes });
      console.log("✅ Permissions granted");
      return true;
    }

    console.log("✅ Permissions already granted");
    return true;
  } catch (error) {
    console.error("Error checking/requesting permissions:", error);
    return false;
  }
}

// Lấy thông tin cơ bản của user
export async function getUserBasicInfo(): Promise<Partial<ZaloUser>> {
  try {
    // Kiểm tra và xin quyền userInfo
    await checkAndRequestPermissions(["scope.userInfo"]);

    const { userInfo } = await getUserInfo({
      autoRequestPermission: true,
      avatarType: "normal",
    });

    const basicInfo = {
      id: userInfo.id,
      name: userInfo.name,
      avatar: userInfo.avatar,
    };

    console.log("👤 Basic user info:", basicInfo);
    return basicInfo;
  } catch (error: any) {
    console.error("Error getting user basic info:", error);

    // Nếu user từ chối cấp quyền (-1401), vẫn trả về ID
    if (error.code === -1401) {
      const userId = await getZaloUserId();
      const fallbackInfo = {
        id: userId,
        name: undefined,
        avatar: undefined,
      };
      console.log("⚠️ Using fallback user info:", fallbackInfo);
      return fallbackInfo;
    }

    throw error;
  }
}

// Lấy số điện thoại
export async function getUserPhoneNumber(): Promise<string | undefined> {
  try {
    // Xin quyền số điện thoại
    await checkAndRequestPermissions(["scope.userPhonenumber"]);

    const phoneData = await getPhoneNumber();
    const phone = (phoneData as any)?.number || (phoneData as any)?.phoneNumber;

    const result = phone ? phone.trim() : undefined;
    console.log("📞 Phone number:", result);
    return result;
  } catch (error: any) {
    console.error("Error getting phone number:", error);

    // Nếu user từ chối cấp quyền, trả về undefined
    if (error.code === -1401 || error.code === -201) {
      console.log("⚠️ Phone number permission denied");
      return undefined;
    }

    throw error;
  }
}

// Đăng nhập chính
export async function login(): Promise<ZaloUser> {
  try {
    console.log("🚀 Starting Zalo login process...");

    // 1. Lấy User ID
    const userId = await getZaloUserId();
    console.log("✅ Got User ID:", userId);

    // 2. Lấy thông tin cơ bản
    const basicInfo = await getUserBasicInfo();
    console.log("✅ Got basic info:", basicInfo);

    // 3. Thử lấy số điện thoại (không bắt buộc)
    let phone: string | undefined;
    try {
      phone = await getUserPhoneNumber();
      console.log("✅ Got phone number:", phone);
    } catch (error) {
      console.log("⚠️ Could not get phone number:", error);
    }

    // 4. Tạo user object
    const user: ZaloUser = {
      id: userId,
      name: basicInfo.name,
      avatar: basicInfo.avatar,
      phone: phone,
      lastLogin: new Date().toISOString(),
    };

    // 5. Lưu vào localStorage
    saveUserToStorage(user);
    console.log("✅ User saved to storage:", user);

    return user;
  } catch (error) {
    console.error("❌ Login failed:", error);
    throw error;
  }
}

// Đăng xuất
export function logout(): void {
  try {
    clearUserFromStorage();
    console.log("✅ User logged out successfully");
  } catch (error) {
    console.error("❌ Logout failed:", error);
  }
}

// Lấy thông tin user hiện tại
export function getCurrentUser(): ZaloUser | null {
  return getUserFromStorage();
}

// Cập nhật thông tin user
export function updateUserInfo(updates: Partial<ZaloUser>): ZaloUser | null {
  try {
    const currentUser = getUserFromStorage();
    if (!currentUser) {
      console.warn("No user found to update");
      return null;
    }

    const updatedUser: ZaloUser = {
      ...currentUser,
      ...updates,
      lastLogin: new Date().toISOString(),
    };

    saveUserToStorage(updatedUser);
    console.log("✅ User info updated:", updatedUser);

    return updatedUser;
  } catch (error) {
    console.error("❌ Failed to update user info:", error);
    return null;
  }
}
```

## Cách sử dụng trong Components

### 1. App Setup với TanStack Query (`src/main.tsx`)

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./lib/queryClient";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* DevTools chỉ hiển thị trong development */}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  </React.StrictMode>
);
```

### 2. Login Page với TanStack Query (`src/pages/LoginPage.tsx`)

```typescript
import React from "react";
import { Button, Page, useSnackbar } from "zmp-ui";
import { useZaloLogin } from "../hooks/useZaloAuthQuery";

const LoginPage: React.FC = () => {
  const loginMutation = useZaloLogin();
  const { openSnackbar } = useSnackbar();

  const handleLogin = async () => {
    try {
      const user = await loginMutation.mutateAsync();

      openSnackbar({
        text: `Đăng nhập thành công! Chào mừng ${user.name || "bạn"}!`,
        type: "success",
      });
    } catch (error: any) {
      console.error("Login error:", error);

      let errorMessage = "Đăng nhập thất bại";
      if (error.code === -1401) {
        errorMessage = "Bạn đã từ chối cấp quyền truy cập";
      } else if (error.code === -201) {
        errorMessage = "Bạn đã từ chối đăng nhập";
      } else if (error.message) {
        errorMessage = error.message;
      }

      openSnackbar({
        text: errorMessage,
        type: "error",
      });
    }
  };

  return (
    <Page>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Đăng nhập Zalo
            </h1>
            <p className="text-gray-600">
              Sử dụng tài khoản Zalo để đăng nhập vào ứng dụng
            </p>
          </div>

          <div className="space-y-4">
            <Button
              fullWidth
              onClick={handleLogin}
              loading={loginMutation.isPending}
              disabled={loginMutation.isPending}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
            >
              {loginMutation.isPending
                ? "Đang đăng nhập..."
                : "Đăng nhập với Zalo"}
            </Button>

            {loginMutation.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">
                  {loginMutation.error.message || "Có lỗi xảy ra"}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Bằng cách đăng nhập, bạn đồng ý với{" "}
              <a href="#" className="text-blue-500 underline">
                Điều khoản sử dụng
              </a>{" "}
              và{" "}
              <a href="#" className="text-blue-500 underline">
                Chính sách bảo mật
              </a>
            </p>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default LoginPage;
```

### 3. Profile Page với TanStack Query (`src/pages/ProfilePage.tsx`)

```typescript
import React, { useState, useEffect } from "react";
import { Button, Page, Input, useSnackbar, Avatar } from "zmp-ui";
import {
  useAuth,
  useLogout,
  useUpdateUserProfile,
  useRequestPhoneNumber,
  useRefreshUser,
} from "../hooks/useZaloAuthQuery";

const ProfilePage: React.FC = () => {
  const { user, isLoggedIn, isLoading, error, refetch } = useAuth();
  const logoutMutation = useLogout();
  const updateProfileMutation = useUpdateUserProfile();
  const requestPhoneMutation = useRequestPhoneNumber();
  const refreshUserMutation = useRefreshUser();
  const { openSnackbar } = useSnackbar();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");

  // Update form values when user data changes
  useEffect(() => {
    if (user) {
      setEditName(user.name || "");
      setEditPhone(user.phone || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!editName.trim()) {
      openSnackbar({
        text: "Vui lòng nhập tên của bạn",
        type: "warning",
      });
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        name: editName.trim(),
        phone: editPhone.trim(),
      });

      setIsEditing(false);
      openSnackbar({
        text: "Cập nhật thông tin thành công!",
        type: "success",
      });
    } catch (error: any) {
      openSnackbar({
        text: error.message || "Cập nhật thông tin thất bại!",
        type: "error",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      openSnackbar({
        text: "Đã đăng xuất thành công!",
        type: "success",
      });
    } catch (error: any) {
      openSnackbar({
        text: error.message || "Đăng xuất thất bại!",
        type: "error",
      });
    }
  };

  const handleRequestPhone = async () => {
    try {
      const phone = await requestPhoneMutation.mutateAsync();
      if (phone) {
        setEditPhone(phone);
        openSnackbar({
          text: `Đã lấy số điện thoại: ${phone}`,
          type: "success",
        });
      } else {
        openSnackbar({
          text: "Không thể lấy số điện thoại",
          type: "warning",
        });
      }
    } catch (error: any) {
      openSnackbar({
        text: error.message || "Lỗi khi lấy số điện thoại",
        type: "error",
      });
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshUserMutation.mutateAsync();
      openSnackbar({
        text: "Đã làm mới thông tin",
        type: "success",
      });
    } catch (error: any) {
      openSnackbar({
        text: error.message || "Lỗi khi làm mới thông tin",
        type: "error",
      });
    }
  };

  if (isLoading) {
    return (
      <Page>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải...</p>
          </div>
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-600 mb-4">Lỗi: {error.message}</p>
            <Button onClick={() => refetch()}>Thử lại</Button>
          </div>
        </div>
      </Page>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <Page>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Chưa đăng nhập</p>
            <Button onClick={() => (window.location.href = "/login")}>
              Đăng nhập
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-900">
              Thông tin cá nhân
            </h1>
            <div className="flex gap-2">
              <Button
                small
                onClick={handleRefresh}
                loading={refreshUserMutation.isPending}
                className="bg-gray-500 hover:bg-gray-600"
              >
                🔄
              </Button>
              <Button
                small
                onClick={handleLogout}
                loading={logoutMutation.isPending}
                className="bg-red-500 hover:bg-red-600"
              >
                Đăng xuất
              </Button>
            </div>
          </div>

          {/* Avatar và thông tin cơ bản */}
          <div className="flex flex-col items-center mb-6">
            <Avatar
              story="default"
              size={80}
              src={user.avatar}
              className="mb-4"
            />
            <h2 className="text-lg font-semibold text-gray-900">
              {user.name || "Người dùng"}
            </h2>
            <p className="text-sm text-gray-500">ID: {user.id}</p>
            {user.lastLogin && (
              <p className="text-xs text-gray-400 mt-1">
                Đăng nhập: {new Date(user.lastLogin).toLocaleString("vi-VN")}
              </p>
            )}
          </div>

          {/* Form chỉnh sửa */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên *
              </label>
              {isEditing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nhập tên của bạn"
                />
              ) : (
                <p className="text-gray-900 py-2 px-3 bg-gray-50 rounded-lg">
                  {user.name || "Chưa có"}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số điện thoại
              </label>
              {isEditing ? (
                <div className="flex gap-2">
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Nhập số điện thoại"
                    type="tel"
                    className="flex-1"
                  />
                  <Button
                    small
                    onClick={handleRequestPhone}
                    loading={requestPhoneMutation.isPending}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    📞
                  </Button>
                </div>
              ) : (
                <p className="text-gray-900 py-2 px-3 bg-gray-50 rounded-lg">
                  {user.phone || "Chưa có"}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-6">
            {isEditing ? (
              <>
                <Button
                  fullWidth
                  onClick={handleSave}
                  loading={updateProfileMutation.isPending}
                  className="bg-green-500 hover:bg-green-600"
                >
                  Lưu
                </Button>
                <Button
                  fullWidth
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(user.name || "");
                    setEditPhone(user.phone || "");
                  }}
                  className="bg-gray-500 hover:bg-gray-600"
                >
                  Hủy
                </Button>
              </>
            ) : (
              <Button
                fullWidth
                onClick={() => setIsEditing(true)}
                className="bg-blue-500 hover:bg-blue-600"
              >
                Chỉnh sửa
              </Button>
            )}
          </div>
        </div>

        {/* Debug info */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Debug Info</h3>
          <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-auto">
            {JSON.stringify(
              {
                user,
                isLoggedIn,
                isLoading,
                error: error?.message,
                mutations: {
                  logout: logoutMutation.isPending,
                  updateProfile: updateProfileMutation.isPending,
                  requestPhone: requestPhoneMutation.isPending,
                  refreshUser: refreshUserMutation.isPending,
                },
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </Page>
  );
};

export default ProfilePage;
```

### 4. App Router với TanStack Query (`src/App.tsx`)

```typescript
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useAuth } from "./hooks/useZaloAuthQuery";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";

const App: React.FC = () => {
  const { isLoggedIn, isLoading, error } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang khởi tạo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Lỗi: {error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={isLoggedIn ? <Navigate to="/profile" /> : <LoginPage />}
        />
        <Route
          path="/profile"
          element={isLoggedIn ? <ProfilePage /> : <Navigate to="/login" />}
        />
        <Route
          path="/"
          element={<Navigate to={isLoggedIn ? "/profile" : "/login"} />}
        />
      </Routes>
    </Router>
  );
};

export default App;
```

## Xử lý quyền và lỗi nâng cấp

### 1. Error Boundary Component

```typescript
// src/components/ErrorBoundary.tsx
import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-red-600 mb-4">
                Đã xảy ra lỗi
              </h2>
              <p className="text-gray-600 mb-4">
                {this.state.error?.message || "Có lỗi không xác định"}
              </p>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Thử lại
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

### 2. Advanced Error Handling

```typescript
// src/utils/errorHandler.ts
export interface ZaloError extends Error {
  code?: number;
  message: string;
}

export function handleZaloError(error: any): ZaloError {
  const zaloError: ZaloError = {
    name: "ZaloError",
    message: "Có lỗi xảy ra",
    code: error.code,
  };

  switch (error.code) {
    case -1401:
      zaloError.message = "Bạn đã từ chối cấp quyền truy cập";
      break;
    case -201:
      zaloError.message = "Bạn đã từ chối đăng nhập";
      break;
    case -1409:
      zaloError.message = "Quá nhiều yêu cầu, vui lòng thử lại sau";
      break;
    case -1:
      zaloError.message = "Lỗi kết nối mạng";
      break;
    default:
      zaloError.message = error.message || "Có lỗi không xác định";
  }

  return zaloError;
}

export function isRetryableError(error: any): boolean {
  const retryableCodes = [-1409, -1]; // Rate limit, network error
  return retryableCodes.includes(error.code);
}
```

## Triển khai và Test

### 1. Setup Development

```bash
# Tạo project mới
npx create-react-app zalo-login-advanced --template typescript
cd zalo-login-advanced

# Install dependencies
npm install @tanstack/react-query @tanstack/react-query-devtools zmp-sdk zmp-ui react-router-dom

# Start development server
npm start
```

### 2. Environment Setup

```typescript
// src/lib/env.ts
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  IS_DEVELOPMENT: process.env.NODE_ENV === "development",
  IS_PRODUCTION: process.env.NODE_ENV === "production",
} as const;
```

### 3. Debug và Test Tools

```typescript
// src/utils/debug.ts
export function debugAuthState() {
  console.log("🔍 Auth Debug Info:", {
    localStorage: {
      userData: localStorage.getItem("zalo_user_data"),
      loginStatus: localStorage.getItem("zalo_login_status"),
    },
    timestamp: new Date().toISOString(),
  });
}

export function debugQueryCache(queryClient: any) {
  console.log("🔍 Query Cache:", queryClient.getQueryCache().getAll());
}

// Usage trong component
useEffect(() => {
  if (process.env.NODE_ENV === "development") {
    debugAuthState();
  }
}, []);
```

## Ưu điểm của phiên bản nâng cấp

### ✅ **Performance Improvements**

- **Automatic Caching**: TanStack Query tự động cache data
- **Background Refetching**: Tự động refresh data khi cần
- **Optimistic Updates**: UI update ngay lập tức
- **Smart Retry**: Retry logic thông minh cho các lỗi có thể retry

### ✅ **Better UX**

- **Loading States**: Loading states tự động cho tất cả operations
- **Error Handling**: Error handling toàn diện với fallback UI
- **Offline Support**: Hoạt động offline với cached data
- **Real-time Updates**: Data sync real-time giữa các components

### ✅ **Developer Experience**

- **DevTools**: React Query DevTools để debug
- **TypeScript Support**: Full TypeScript support
- **Separation of Concerns**: Logic tách biệt rõ ràng
- **Reusable Hooks**: Hooks có thể tái sử dụng

### ✅ **Scalability**

- **Query Invalidation**: Smart cache invalidation
- **Background Sync**: Background data synchronization
- **Memory Management**: Automatic garbage collection
- **Concurrent Features**: Support React 18 concurrent features

## Migration từ Simple Guide

### 1. Thay thế hooks

```typescript
// Từ Simple Guide
const { user, login, logout, updateUser } = useAuthSimple();

// Sang Advanced Guide
const { user, isLoggedIn, isLoading } = useAuth();
const loginMutation = useZaloLogin();
const logoutMutation = useLogout();
const updateProfileMutation = useUpdateUserProfile();
```

### 2. Update components

```typescript
// Thay vì
const handleLogin = async () => {
  const success = await login();
  // handle success
};

// Sử dụng
const handleLogin = async () => {
  try {
    await loginMutation.mutateAsync();
    // handle success
  } catch (error) {
    // handle error
  }
};
```

## Kết luận

Phiên bản nâng cấp này cung cấp:

- ✅ **Professional-grade** authentication system
- ✅ **Better performance** với TanStack Query
- ✅ **Enhanced UX** với loading states và error handling
- ✅ **Developer-friendly** với DevTools và TypeScript
- ✅ **Scalable architecture** cho production apps
- ✅ **Easy migration** từ Simple Guide

Đây là foundation hoàn hảo cho các Mini App production cần tính năng đăng nhập Zalo với performance và UX tốt nhất.
