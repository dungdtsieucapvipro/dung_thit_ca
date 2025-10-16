import React from "react";
import { Button, Page } from "zmp-ui";

interface PermissionInfoProps {
  onRequestPermission: () => void;
  isLoading?: boolean;
}

export const PermissionInfo: React.FC<PermissionInfoProps> = ({ 
  onRequestPermission, 
  isLoading = false 
}) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-medium text-blue-800 mb-2">
        🔐 Cần cấp quyền truy cập
      </h3>
      <p className="text-xs text-blue-600 mb-3">
        Để hiển thị tên và avatar, ứng dụng cần được cấp quyền truy cập. 
        Nhấn nút bên dưới để cấp quyền.
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
