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
    requestPhone, 
    refreshUser 
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

  const handleRequestPhone = async () => {
    try {
      const phone = await requestPhone();
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
            <Button onClick={() => navigate("/login")}>
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
          {(!user.name || !user.avatar || !user.phone) && (
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
                    loading={isLoading}
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
            <div><strong>User ID:</strong> {user?.id}</div>
            <div><strong>Name:</strong> {user?.name || "❌ Chưa có (cần quyền scope.userInfo)"}</div>
            <div><strong>Avatar:</strong> {user?.avatar || "❌ Chưa có (cần quyền scope.userInfo)"}</div>
            <div><strong>Phone:</strong> {user?.phone || "❌ Chưa có (cần quyền scope.userPhonenumber + server decode)"}</div>
            <div><strong>Last Login:</strong> {user?.lastLogin}</div>
            <div><strong>Is Logged In:</strong> {isLoggedIn ? "✅" : "❌"}</div>
            <div><strong>Loading:</strong> {isLoading ? "⏳" : "✅"}</div>
            {error && <div><strong>Error:</strong> {error}</div>}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <p><strong>Lưu ý:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Để lấy tên và avatar: cần quyền <code>scope.userInfo</code></li>
              <li>Để lấy số điện thoại: cần quyền <code>scope.userPhonenumber</code> + server decode token</li>
              <li>Hiện tại đang dùng mock data cho demo</li>
            </ul>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default ProfilePage;
