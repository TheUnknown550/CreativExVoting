import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { BrandMark } from '../../components/BrandMark';
import { LanguageToggle } from '../../components/LanguageToggle';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface LoginFormValues {
  username: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const { t } = useLanguage();
  const [form] = Form.useForm<LoginFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/judge'} replace />;
  }

  async function handleFinish(values: LoginFormValues) {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const currentUser = await login(values.username, values.password);
      const nextPath =
        currentUser.role === 'admin'
          ? '/admin/dashboard'
          : ((location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/judge');

      navigate(nextPath, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('login.genericError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell ce-login">
      <section className="ce-login__intro">
        <div className="ce-login__bar">
          <Typography.Title level={1} className="ce-login__bar-title">
            {t('login.bannerTitle')}
          </Typography.Title>
          <Space size="middle" align="center">
            <LanguageToggle tone="light" />
            <BrandMark className="ce-login__bar-mark" />
          </Space>
        </div>

        <div className="ce-login__hero">
          <Typography.Title level={2} className="ce-login__headline">
            {t('login.headline')}
          </Typography.Title>
          <Typography.Paragraph className="ce-login__copy">{t('login.intro')}</Typography.Paragraph>

          <div className="ce-login__stats">
            <div className="ce-login__stat">
              <strong>15</strong>
              <span>{t('login.statAwards')}</span>
            </div>
            <div className="ce-login__stat">
              <strong>150</strong>
              <span>{t('login.statNominatedWorks')}</span>
            </div>
            <div className="ce-login__stat">
              <strong>{t('login.statVotingWindow')}</strong>
              <span>{t('login.statVotingWindowLabel')}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="ce-login__stage">
        <Card className="ce-login-card" styles={{ body: { padding: 30 } }}>
          <Typography.Title level={2} className="ce-login-card__title">
            {t('login.title')}
          </Typography.Title>

          {errorMessage ? (
            <Alert type="error" message={errorMessage} showIcon style={{ marginBottom: 18 }} />
          ) : null}

          <Form<LoginFormValues>
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            requiredMark={false}
          >
            <Form.Item name="username" label={t('login.username')} rules={[{ required: true }]}>
              <Input placeholder={t('login.usernamePlaceholder')} size="large" />
            </Form.Item>

            <Form.Item name="password" label={t('login.password')} rules={[{ required: true }]}>
              <Input.Password placeholder={t('login.passwordPlaceholder')} size="large" />
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
              {t('login.submit')}
            </Button>
          </Form>
        </Card>
      </section>
    </div>
  );
}
