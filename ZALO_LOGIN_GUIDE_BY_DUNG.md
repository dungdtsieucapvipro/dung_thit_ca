# Hướng Dẫn Đăng Nhập Zalo - Lấy Avatar, ID, Tên

## 📋 Tổng Quan

Hướng dẫn này sẽ giúp bạn triển khai chức năng đăng nhập Zalo trong Zalo Mini App để lấy thông tin người dùng bao gồm:

- ✅ **User ID** (luôn có sẵn)
- ✅ **Tên người dùng** (cần quyền `scope.userInfo`)
- ✅ **Avatar** (cần quyền `scope.userInfo`)
- ⚠️ **Số điện thoại** (cần doanh nghiệp được Zalo duyệt + server decode)

## 🛠️ Cài Đặt Dependencies

### 1. Dependencies Cần Thiết

```json
{
  "dependencies": {
    "zmp-sdk": "^2.41.0",
    "zmp-ui": "^1.11.6",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.x.x"
  }
}
```

### 2. Cài Đặt

```bash
npm install zmp-sdk zmp-ui react react-dom react-router-dom
```

## 📁 Cấu Trúc Files

```
src/
├── types/
│   └── auth.ts                 # Định nghĩa types cho authentication
├── services/
│   └── zalo-auth-simple.ts     # Service xử lý Zalo authentication
├── hooks/
│   └── useZaloAuthSimple.ts    # Custom hook cho authentication
├── components/
│   └── PermissionInfo.tsx      # Component thông báo cần cấp quyền
├── pages/
│   ├── login/
│   │   └── index.tsx           # Trang đăng nhập
│   └── profile/
│       └── index.tsx           # Trang profile
└── router.tsx                  # Cấu hình routing
```

## 🔧 Triển Khai Chi Tiết

### 1. Định Nghĩa Types (`src/types/auth.ts`)

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

### 2. Zalo Authentication Service (`src/services/zalo-auth-simple.ts`)

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

// Lấy thông tin cơ bản của user (tên, avatar)
export async function getUserBasicInfo(): Promise<Partial<ZaloUser>> {
  try {
    console.log("🔐 Requesting userInfo permission...");

    // Xin quyền userInfo trước
    await authorize({
      scopes: ["scope.userInfo"],
    });

    console.log("✅ UserInfo permission granted, getting user info...");

    const { userInfo } = await getUserInfo({
      autoRequestPermission: false, // Đã xin quyền rồi
      avatarType: "normal",
    });

    const basicInfo = {
      id: userInfo.id,
      name: userInfo.name || "",
      avatar: userInfo.avatar || "",
    };

    console.log("👤 Basic user info:", basicInfo);
    return basicInfo;
  } catch (error: any) {
    console.error("Error getting user basic info:", error);

    // Nếu user từ chối cấp quyền (-1401), vẫn trả về ID
    if (error.code === -1401) {
      console.log("⚠️ User denied userInfo permission, using fallback");
      const userId = await getZaloUserId();
      const fallbackInfo = {
        id: userId,
        name: "",
        avatar: "",
      };
      console.log("⚠️ Using fallback user info:", fallbackInfo);
      return fallbackInfo;
    }

    throw error;
  }
}

// Lấy số điện thoại (chỉ dành cho doanh nghiệp được Zalo duyệt)
export async function getUserPhoneNumber(): Promise<string | undefined> {
  try {
    console.log("🔐 Requesting phone number permission...");

    // Xin quyền số điện thoại
    await authorize({
      scopes: ["scope.userPhonenumber"],
    });

    console.log("✅ Phone permission granted, getting phone token...");

    const { token } = await getPhoneNumber();
    console.log("📞 Phone token received:", token);

    // Lưu ý: Để lấy số điện thoại thực, cần:
    // 1. Doanh nghiệp phải được Zalo duyệt
    // 2. Gửi token này lên server của bạn
    // 3. Server gọi Zalo Open API để decode token
    // 4. Trả về số điện thoại thực

    console.log("⚠️ Phone token needs server-side processing");
    console.log("📝 For demo, using mock phone number");

    // Giả lập số điện thoại cho demo
    const mockPhone = "0912345678";
    console.log("📞 Mock phone number:", mockPhone);
    return mockPhone;
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

### 3. Custom Hook (`src/hooks/useZaloAuthSimple.ts`)

```typescript
import { useState, useEffect, useCallback } from "react";
import {
  login,
  logout,
  getCurrentUser,
  updateUserInfo,
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
          const currentUser = getCurrentUser();
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

  const updateProfile = useCallback(
    async (updates: UpdateProfileRequest): Promise<ZaloUser> => {
      try {
        setIsLoading(true);
        setError(null);
        const updatedUser = updateUserInfo(updates);
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
    },
    []
  );

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      if (isLoggedIn()) {
        const currentUser = getCurrentUser();
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
```

### 4. Component PermissionInfo (`src/components/PermissionInfo.tsx`)

```typescript
import React from "react";
import { Button } from "zmp-ui";

interface PermissionInfoProps {
  onRequestPermission: () => void;
  isLoading?: boolean;
}

export const PermissionInfo: React.FC<PermissionInfoProps> = ({
  onRequestPermission,
  isLoading = false,
}) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-medium text-blue-800 mb-2">
        🔐 Cần cấp quyền truy cập
      </h3>
      <p className="text-xs text-blue-600 mb-3">
        Để hiển thị tên và avatar, ứng dụng cần được cấp quyền truy cập. Nhấn
        nút bên dưới để cấp quyền.
      </p>
      <Button
        small
        onClick={onRequestPermission}
        loading={isLoading}
        className="bg-blue-500 hover:bg-blue-600"
      >
        Cấp quyền truy cập
      </Button>
    </div>
  );
};
```

### 5. Trang Đăng Nhập (`src/pages/login/index.tsx`)

```typescript
import React from "react";
import { Button, Page, useSnackbar } from "zmp-ui";
import { useZaloAuth } from "../../hooks/useZaloAuthSimple";
import { useNavigate } from "react-router-dom";

const LoginPage: React.FC = () => {
  const { login, isLoading, error } = useZaloAuth();
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const user = await login();

      openSnackbar({
        text: `Đăng nhập thành công! Chào mừng ${user.name || "bạn"}!`,
        type: "success",
      });

      // Chuyển hướng đến trang profile sau khi đăng nhập thành công
      navigate("/profile");
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
              loading={isLoading}
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? "Đang đăng nhập..." : "Đăng nhập với Zalo"}
            </Button>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">
                  {error || "Có lỗi xảy ra"}
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

### 6. Trang Profile (`src/pages/profile/index.tsx`)

```typescript
import React, { useState, useEffect } from "react";
import { Button, Page, Input, useSnackbar, Avatar } from "zmp-ui";
import { useZaloAuth } from "../../hooks/useZaloAuthSimple";
import { useNavigate } from "react-router-dom";
import { PermissionInfo } from "../../components/PermissionInfo";

const ProfilePage: React.FC = () => {
  const {
    user,
    isLoggedIn,
    isLoading,
    error,
    login,
    logout,
    updateProfile,
    refreshUser,
  } = useZaloAuth();
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

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
      await updateProfile({
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
      await logout();
      openSnackbar({
        text: "Đã đăng xuất thành công!",
        type: "success",
      });
      navigate("/login");
    } catch (error: any) {
      openSnackbar({
        text: error.message || "Đăng xuất thất bại!",
        type: "error",
      });
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshUser();
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

  const handleRequestPermission = async () => {
    try {
      // Thử đăng nhập lại để xin quyền
      await login();
      openSnackbar({
        text: "Đã cấp quyền thành công!",
        type: "success",
      });
    } catch (error: any) {
      openSnackbar({
        text: error.message || "Lỗi khi cấp quyền",
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
            <p className="text-red-600 mb-4">Lỗi: {error}</p>
            <Button onClick={() => window.location.reload()}>Thử lại</Button>
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
            <Button onClick={() => navigate("/login")}>Đăng nhập</Button>
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
                loading={isLoading}
                className="bg-gray-500 hover:bg-gray-600"
              >
                🔄
              </Button>
              <Button
                small
                onClick={handleLogout}
                loading={isLoading}
                className="bg-red-500 hover:bg-red-600"
              >
                Đăng xuất
              </Button>
            </div>
          </div>

          {/* Thông báo cần cấp quyền */}
          {(!user.name || !user.avatar) && (
            <PermissionInfo
              onRequestPermission={handleRequestPermission}
              isLoading={isLoading}
            />
          )}

          {/* Avatar và thông tin cơ bản */}
          <div className="flex flex-col items-center mb-6">
            <Avatar
              story="default"
              size={80}
              src={user.avatar || undefined}
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
                <div className="space-y-2">
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Nhập số điện thoại"
                    type="tel"
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500">
                    💡 Số điện thoại có thể chỉnh sửa thủ công. Để lấy tự động
                    cần doanh nghiệp được Zalo duyệt.
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-gray-900 py-2 px-3 bg-gray-50 rounded-lg">
                    {user.phone || "Chưa có"}
                  </p>
                  {!user.phone && (
                    <p className="text-xs text-gray-500">
                      💡 Có thể chỉnh sửa thủ công hoặc cần doanh nghiệp được
                      Zalo duyệt
                    </p>
                  )}
                </div>
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
                  loading={isLoading}
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
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded space-y-1">
            <div>
              <strong>User ID:</strong> {user?.id}
            </div>
            <div>
              <strong>Name:</strong>{" "}
              {user?.name || "❌ Chưa có (cần quyền scope.userInfo)"}
            </div>
            <div>
              <strong>Avatar:</strong>{" "}
              {user?.avatar || "❌ Chưa có (cần quyền scope.userInfo)"}
            </div>
            <div>
              <strong>Phone:</strong>{" "}
              {user?.phone || "❌ Chưa có (cần doanh nghiệp được Zalo duyệt)"}
            </div>
            <div>
              <strong>Last Login:</strong> {user?.lastLogin}
            </div>
            <div>
              <strong>Is Logged In:</strong> {isLoggedIn ? "✅" : "❌"}
            </div>
            <div>
              <strong>Loading:</strong> {isLoading ? "⏳" : "✅"}
            </div>
            {error && (
              <div>
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <p>
              <strong>Lưu ý:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Để lấy tên và avatar: cần quyền <code>scope.userInfo</code> ✅
              </li>
              <li>
                Để lấy số điện thoại: cần doanh nghiệp được Zalo duyệt + server
                decode token
              </li>
              <li>Hiện tại có thể chỉnh sửa số điện thoại thủ công</li>
            </ul>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default ProfilePage;
```

### 7. Cấu Hình Router (`src/router.tsx`)

```typescript
import Layout from "@/components/layout";
import LoginPage from "@/pages/login";
import ProfilePage from "@/pages/profile";
// ... other imports

const router = createBrowserRouter(
  [
    {
      path: "/login",
      element: <LoginPage />,
    },
    {
      path: "/",
      element: <Layout />,
      children: [
        // ... other routes
        {
          path: "/profile",
          element: <ProfilePage />,
          handle: {
            logo: true,
          },
        },
      ],
    },
  ],
  { basename: getBasePath() }
);

export default router;
```

## 🚀 Cách Sử Dụng

### 1. Đăng Nhập

- Truy cập `/login`
- Nhấn "Đăng nhập với Zalo"
- Cấp quyền `scope.userInfo` để lấy tên và avatar
- Tự động chuyển hướng đến `/profile`

### 2. Quản Lý Profile

- Xem thông tin user (ID, tên, avatar)
- Chỉnh sửa tên và số điện thoại
- Đăng xuất

### 3. Xử Lý Lỗi

- **Error -1401**: User từ chối cấp quyền
- **Error -201**: User từ chối đăng nhập
- Hiển thị thông báo lỗi thân thiện

## ⚠️ Lưu Ý Quan Trọng

### 1. Quyền Truy Cập

- **User ID**: Luôn có sẵn, không cần quyền
- **Tên & Avatar**: Cần quyền `scope.userInfo`
- **Số điện thoại**: Cần quyền `scope.userPhonenumber` + doanh nghiệp được Zalo duyệt

### 2. Số Điện Thoại

- `getPhoneNumber()` chỉ trả về `token`
- Cần server để decode token thành số điện thoại thực
- Hiện tại dùng mock data cho demo

### 3. Lưu Trữ

- Thông tin user được lưu trong `localStorage`
- Tự động kiểm tra trạng thái đăng nhập khi khởi động app

## 🔧 Troubleshooting

### 1. Không lấy được tên/avatar

- Kiểm tra user đã cấp quyền `scope.userInfo` chưa
- Xem console logs để debug

### 2. Không lấy được số điện thoại

- Cần doanh nghiệp được Zalo duyệt
- Hoặc chỉnh sửa thủ công

### 3. Lỗi đăng nhập

- Kiểm tra Zalo SDK version
- Xem error code trong console

## 📱 Kết Quả

Sau khi triển khai, bạn sẽ có:

- ✅ Trang đăng nhập Zalo đẹp mắt
- ✅ Lấy được User ID, tên, avatar
- ✅ Trang profile với khả năng chỉnh sửa
- ✅ Xử lý lỗi và loading states
- ✅ Lưu trữ thông tin user
- ✅ Đăng xuất và refresh dữ liệu

Chúc bạn triển khai thành công! 🎉
