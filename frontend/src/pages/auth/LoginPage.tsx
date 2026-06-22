import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { BrandMark } from '../../components/BrandMark';
import { LanguageToggle } from '../../components/LanguageToggle';
import { demoAdminAccount, demoJudgeAccounts, demoJudgePassword } from '../../constants/demoAccounts';
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
      setErrorMessage(error instanceof ApiError ? error.message : t('login.genericError'));
    } finally {
      setSubmitting(false);
    }
  }

  function applyDemoCredentials(username: string, password: string) {
    form.setFieldsValue({ username, password });
    setErrorMessage(null);
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
        <div className="ce-login__shape ce-login__shape--one" />
        <div className="ce-login__shape ce-login__shape--two" />
        <div className="ce-login__shape ce-login__shape--three" />
        <BrandMark tone="light" className="ce-login__stage-mark" />

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
              <Input prefix={<UserOutlined />} placeholder={t('login.usernamePlaceholder')} size="large" />
            </Form.Item>

            <Form.Item name="password" label={t('login.password')} rules={[{ required: true }]}>
              <Input.Password prefix={<LockOutlined />} placeholder={t('login.passwordPlaceholder')} size="large" />
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
              {t('login.submit')}
            </Button>
          </Form>

          <div className="ce-demo-panel">
            <Typography.Text className="ce-demo-panel__label">{t('login.demoAccess')}</Typography.Text>
            <Typography.Paragraph className="ce-demo-panel__copy">
              {t('login.demoAdminLabel')}: <Typography.Text code>{demoAdminAccount.username}</Typography.Text> /{' '}
              <Typography.Text code>{demoAdminAccount.password}</Typography.Text>
            </Typography.Paragraph>
            <Typography.Paragraph className="ce-demo-panel__copy">
              {t('login.demoJudgesAllUse')} <Typography.Text code>{demoJudgePassword}</Typography.Text>
            </Typography.Paragraph>

            <Space wrap size={[8, 8]} style={{ marginBottom: 12 }}>
              <Button
                size="small"
                className="ce-demo-panel__button"
                onClick={() => applyDemoCredentials(demoAdminAccount.username, demoAdminAccount.password)}
              >
                {t('login.useAdminDemo')}
              </Button>
              <Button
                size="small"
                className="ce-demo-panel__button"
                onClick={() => applyDemoCredentials(demoJudgeAccounts[0].username, demoJudgePassword)}
              >
                {t('login.useFirstJudge')}
              </Button>
            </Space>

            <div className="demo-credential-grid">
              {demoJudgeAccounts.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  className="demo-credential-pill"
                  onClick={() => applyDemoCredentials(account.username, demoJudgePassword)}
                >
                  <strong>{account.label}</strong>
                  <span>{account.username}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
