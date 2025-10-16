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
    console.log("🔐 Requesting userInfo permission...");
    
    // Xin quyền userInfo trước
    await authorize({ 
      scopes: ["scope.userInfo"] 
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

// Lấy số điện thoại
export async function getUserPhoneNumber(): Promise<string | undefined> {
  try {
    console.log("🔐 Requesting phone number permission...");
    
    // Xin quyền số điện thoại
    await authorize({ 
      scopes: ["scope.userPhonenumber"] 
    });
    
    console.log("✅ Phone permission granted, getting phone token...");

    const { token } = await getPhoneNumber();
    console.log("📞 Phone token received:", token);

    // Lưu ý: Token này cần được gửi lên server để decode thành số điện thoại thực
    // Hiện tại chúng ta sẽ giả lập số điện thoại để demo
    // Trong thực tế, bạn cần:
    // 1. Gửi token này lên server của bạn
    // 2. Server gọi Zalo Open API để decode token
    // 3. Trả về số điện thoại thực
    
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
