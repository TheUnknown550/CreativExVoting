import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

const LoginPage = lazy(async () => import('../pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const JudgeLayout = lazy(async () => import('../layouts/JudgeLayout').then((module) => ({ default: module.JudgeLayout })));
const AdminLayout = lazy(async () => import('../layouts/AdminLayout').then((module) => ({ default: module.AdminLayout })));
const JudgeGroupSelectPage = lazy(async () =>
  import('../pages/judge/JudgeGroupSelectPage').then((module) => ({ default: module.JudgeGroupSelectPage })),
);
const JudgeCategorySelectPage = lazy(async () =>
  import('../pages/judge/JudgeCategorySelectPage').then((module) => ({ default: module.JudgeCategorySelectPage })),
);
const JudgeWorkspacePage = lazy(async () =>
  import('../pages/judge/JudgeWorkspacePage').then((module) => ({ default: module.JudgeWorkspacePage })),
);
const JudgeProjectDetailPage = lazy(async () =>
  import('../pages/judge/JudgeProjectDetailPage').then((module) => ({ default: module.JudgeProjectDetailPage })),
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
const AdminRankingsPage = lazy(async () =>
  import('../pages/admin/AdminRankingsPage').then((module) => ({ default: module.AdminRankingsPage })),
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

  return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/judge'} replace />;
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
              <Route path="/judge" element={<JudgeGroupSelectPage />} />
              <Route path="/judge/groups/:groupId" element={<JudgeCategorySelectPage />} />
              <Route
                path="/judge/groups/:groupId/categories/:categoryId/projects"
                element={<JudgeWorkspacePage />}
              />
              <Route
                path="/judge/groups/:groupId/categories/:categoryId/summary"
                element={<JudgeWorkspacePage />}
              />
              <Route
                path="/judge/groups/:groupId/categories/:categoryId/projects/:projectId"
                element={<JudgeProjectDetailPage />}
              />
              {/* Legacy paths from the pre-group flow */}
              <Route path="/judge/projects" element={<Navigate to="/judge" replace />} />
              <Route path="/judge/summary" element={<Navigate to="/judge" replace />} />
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
              <Route path="/admin/rankings" element={<AdminRankingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
