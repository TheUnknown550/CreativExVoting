import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { BrandMark } from '../../components/BrandMark';
import { demoAdminAccount, demoJudgeAccounts, demoJudgePassword } from '../../constants/demoAccounts';
import { useAuth } from '../../contexts/AuthContext';

interface LoginFormValues {
  username: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
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
      setErrorMessage(
        error instanceof ApiError ? error.message : 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง',
      );
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
            CE Awards 2026
          </Typography.Title>
          <BrandMark className="ce-login__bar-mark" />
        </div>

        <div className="ce-login__hero">
          <Typography.Title level={2} className="ce-login__headline">
            CREATIVE EXCELLENCE AWARDS 2026
          </Typography.Title>
          <Typography.Paragraph className="ce-login__copy">
            เข้าสู่ระบบลงคะแนนอย่างเป็นทางการของ CE Awards สำหรับคณะกรรมการตัดสิน
            ตรวจสอบหมวดหมู่ที่ได้รับมอบหมาย ให้คะแนนผลงานตามเกณฑ์ที่กำหนด
            และส่งออกผลรางวัลสุดท้ายได้จากแพลตฟอร์มเดียว
          </Typography.Paragraph>

          <div className="ce-login__stats">
            <div className="ce-login__stat">
              <strong>15</strong>
              <span>รางวัล</span>
            </div>
            <div className="ce-login__stat">
              <strong>150</strong>
              <span>ผลงานที่เข้าชิง</span>
            </div>
            <div className="ce-login__stat">
              <strong>7 วัน</strong>
              <span>ระยะเวลาลงคะแนน</span>
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
            เข้าสู่ระบบ
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
            <Form.Item name="username" label="ชื่อผู้ใช้" rules={[{ required: true }]}>
              <Input prefix={<UserOutlined />} placeholder="กรอกชื่อผู้ใช้ของคุณ" size="large" />
            </Form.Item>

            <Form.Item name="password" label="รหัสผ่าน" rules={[{ required: true }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="กรอกรหัสผ่านของคุณ" size="large" />
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
              เข้าสู่ระบบ
            </Button>
          </Form>

          <div className="ce-demo-panel">
            <Typography.Text className="ce-demo-panel__label">บัญชีทดลองใช้งาน</Typography.Text>
            <Typography.Paragraph className="ce-demo-panel__copy">
              ผู้ดูแลระบบ: <Typography.Text code>{demoAdminAccount.username}</Typography.Text> /{' '}
              <Typography.Text code>{demoAdminAccount.password}</Typography.Text>
            </Typography.Paragraph>
            <Typography.Paragraph className="ce-demo-panel__copy">
              กรรมการทุกคนใช้รหัสผ่าน <Typography.Text code>{demoJudgePassword}</Typography.Text>
            </Typography.Paragraph>

            <Space wrap size={[8, 8]} style={{ marginBottom: 12 }}>
              <Button
                size="small"
                className="ce-demo-panel__button"
                onClick={() => applyDemoCredentials(demoAdminAccount.username, demoAdminAccount.password)}
              >
                ใช้บัญชีผู้ดูแลระบบทดลอง
              </Button>
              <Button
                size="small"
                className="ce-demo-panel__button"
                onClick={() => applyDemoCredentials(demoJudgeAccounts[0].username, demoJudgePassword)}
              >
                ใช้บัญชีกรรมการคนแรก
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
