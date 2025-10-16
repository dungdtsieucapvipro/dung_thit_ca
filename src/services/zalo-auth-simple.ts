import {
  getUserInfo,
  getPhoneNumber,
  login as zmpLogin,
  authorize,
  getSetting,
  getUserID,
} from "zmp-sdk/apis";

import { ZaloUser } from "../types/auth";
import { supabase } from "../utils/supabase";

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

// Lấy số điện thoại (chỉ dành cho doanh nghiệp được Zalo duyệt)
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

    // 3. KHÔNG tự động lấy số điện thoại (tránh ghi đè số trong DB bằng mock)
    let phone: string | undefined;

    // 4. Tạo user object
    const user: ZaloUser = {
      id: userId,
      name: basicInfo.name,
      avatar: basicInfo.avatar,
      phone: phone,
      lastLogin: new Date().toISOString(),
    };

    // 5. Đồng bộ xuống Supabase (nguồn dữ liệu chuẩn)
    try {
      const { data, error } = await supabase.rpc("upsert_user_by_zalo", {
        p_id: user.id,
        p_name: user.name ?? null,
        p_avatar: user.avatar ?? null,
        // Không gửi phone ở bước login để không ghi đè DB khi đang dùng mock
        p_phone: null,
        p_last_login: user.lastLogin ?? new Date().toISOString(),
      });
      if (error) throw error;
      // cập nhật lại theo DB nếu cần
      if (data) {
        user = {
          id: data.id,
          name: data.name ?? user.name,
          avatar: data.avatar ?? user.avatar,
          phone: data.phone ?? user.phone,
          lastLogin: data.last_login ?? user.lastLogin,
        };
      }
      console.log("✅ User synced to Supabase:", data);
    } catch (dbErr) {
      console.warn("⚠️ Supabase sync failed:", dbErr);
    }

    // 6. Lưu cache local để load nhanh
    saveUserToStorage(user);
    console.log("✅ User cached to localStorage:", user);

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

// Ưu tiên đọc DB rồi cập nhật cache (fallback cache nếu lỗi mạng)
export async function getCurrentUserFromDBFirst(): Promise<ZaloUser | null> {
  try {
    const cached = getUserFromStorage();
    // Lấy id trực tiếp từ Zalo SDK để chống lệch cache
    const id = await getZaloUserId();
    if (!id) return cached ?? null;
    const { data, error } = await supabase.rpc("get_user_by_zalo", { p_id: id });
    if (error) throw error;
    if (!data) return cached ?? null;
    const user: ZaloUser = {
      id: data.id,
      name: data.name ?? "",
      avatar: data.avatar ?? "",
      phone: data.phone ?? "",
      lastLogin: data.last_login ?? new Date().toISOString(),
    };
    saveUserToStorage(user);
    return user;
  } catch (e) {
    console.warn("⚠️ getCurrentUserFromDBFirst fallback cache:", e);
    return getUserFromStorage();
  }
}

// Cập nhật thông tin user
export async function updateUserInfoPersistent(
  updates: Partial<ZaloUser>
): Promise<ZaloUser | null> {
  try {
    const currentUser = getUserFromStorage();
    if (!currentUser) {
      console.warn("No user found to update");
      return null;
    }
    // 1) Cập nhật DB trước
    const { data, error } = await supabase.rpc("update_user_profile", {
      p_id: currentUser.id,
      p_name: updates.name ?? null,
      p_phone: updates.phone ?? null,
    });
    if (error) throw error;

    const updatedUser: ZaloUser = {
      ...currentUser,
      name: data?.name ?? currentUser.name,
      phone: data?.phone ?? currentUser.phone,
      lastLogin: new Date().toISOString(),
    };

    // 2) Cập nhật cache
    saveUserToStorage(updatedUser);
    console.log("✅ User info updated (DB + cache):", updatedUser);
    return updatedUser;
  } catch (error) {
    console.error("❌ Failed to update user info persistent:", error);
    return null;
  }
}
