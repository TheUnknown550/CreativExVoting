import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spin } from 'antd';

import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types/domain';

interface ProtectedRouteProps {
  allowedRoles: Role[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="full-height-spin">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/judge'} replace />;
  }

  return <Outlet />;
}
