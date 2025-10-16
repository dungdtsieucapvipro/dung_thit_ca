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
              {isLoading
                ? "Đang đăng nhập..."
                : "Đăng nhập với Zalo"}
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
