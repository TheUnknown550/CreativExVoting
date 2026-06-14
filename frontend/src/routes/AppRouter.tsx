import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

const LoginPage = lazy(async () => import('../pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const JudgeLayout = lazy(async () => import('../layouts/JudgeLayout').then((module) => ({ default: module.JudgeLayout })));
const AdminLayout = lazy(async () => import('../layouts/AdminLayout').then((module) => ({ default: module.AdminLayout })));
const JudgeWorkspacePage = lazy(async () =>
  import('../pages/judge/JudgeWorkspacePage').then((module) => ({ default: module.JudgeWorkspacePage })),
);
const AdminDashboardPage = lazy(async () =>
  import('../pages/admin/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })),
);
const AdminProjectsPage = lazy(async () =>
  import('../pages/admin/AdminProjectsPage').then((module) => ({ default: module.AdminProjectsPage })),
);
const AdminCategoriesPage = lazy(async () =>
  import('../pages/admin/AdminCategoriesPage').then((module) => ({ default: module.AdminCategoriesPage })),
);
const AdminCriteriaPage = lazy(async () =>
  import('../pages/admin/AdminCriteriaPage').then((module) => ({ default: module.AdminCriteriaPage })),
);
const AdminJudgesPage = lazy(async () =>
  import('../pages/admin/AdminJudgesPage').then((module) => ({ default: module.AdminJudgesPage })),
);
const AdminResultsPage = lazy(async () =>
  import('../pages/admin/AdminResultsPage').then((module) => ({ default: module.AdminResultsPage })),
);

function RouteFallback() {
  return (
    <div className="full-height-spin">
      <Spin size="large" />
    </div>
  );
}

function LandingRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="full-height-spin">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/judge/projects'} replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute allowedRoles={['judge']} />}>
            <Route element={<JudgeLayout />}>
              <Route path="/judge/projects" element={<JudgeWorkspacePage />} />
              <Route path="/judge/summary" element={<JudgeWorkspacePage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/projects" element={<AdminProjectsPage />} />
              <Route path="/admin/categories" element={<AdminCategoriesPage />} />
              <Route path="/admin/criteria" element={<AdminCriteriaPage />} />
              <Route path="/admin/judges" element={<AdminJudgesPage />} />
              <Route path="/admin/results" element={<AdminResultsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
