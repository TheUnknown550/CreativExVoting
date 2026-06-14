import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

interface LoginFormValues {
  username: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/judge/projects'} replace />;
  }

  async function handleFinish(values: LoginFormValues) {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const currentUser = await login(values.username, values.password);
      const nextPath =
        currentUser.role === 'admin'
          ? '/admin/dashboard'
          : ((location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/judge/projects');

      navigate(nextPath, { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Unable to sign in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <section className="soft-card login-story">
          <Typography.Text className="login-story__kicker">Award Judging Platform</Typography.Text>
          <Typography.Title className="page-title" style={{ marginTop: 12, marginBottom: 12 }}>
            Creative Excellence Awards Voting System
          </Typography.Title>
          <Typography.Paragraph className="page-subtitle" style={{ marginTop: 0 }}>
            Judges can review assigned categories, score projects against live criteria, revisit votes,
            and view their own ranking summary. Admins can manage the full event workflow and export
            every judging result.
          </Typography.Paragraph>

          <div className="login-story__stats">
            <div className="stat-card">
              <strong>Role-aware</strong>
              <Typography.Text type="secondary">JWT-secured judge and admin experiences.</Typography.Text>
            </div>
            <div className="stat-card">
              <strong>Flexible criteria</strong>
              <Typography.Text type="secondary">Scores and rubrics stay database-driven.</Typography.Text>
            </div>
            <div className="stat-card">
              <strong>Traceable voting</strong>
              <Typography.Text type="secondary">Editable submissions with export-ready reporting.</Typography.Text>
            </div>
          </div>
        </section>

        <Card className="soft-card" styles={{ body: { padding: 28 } }}>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            Sign In
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            Use your event username and password to access the judging workspace.
          </Typography.Paragraph>

          {errorMessage ? (
            <Alert type="error" message={errorMessage} showIcon style={{ marginBottom: 18 }} />
          ) : null}

          <Form<LoginFormValues> layout="vertical" onFinish={handleFinish} requiredMark={false}>
            <Form.Item name="username" label="Username" rules={[{ required: true }]}>
              <Input prefix={<UserOutlined />} placeholder="Enter your username" size="large" />
            </Form.Item>

            <Form.Item name="password" label="Password" rules={[{ required: true }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Enter your password" size="large" />
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
              Login
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
