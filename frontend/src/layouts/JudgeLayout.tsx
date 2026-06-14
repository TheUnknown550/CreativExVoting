import { Layout, Space, Typography, Button, Tag } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { Outlet } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

const { Header, Content } = Layout;

export function JudgeLayout() {
  const { user, logout } = useAuth();

  return (
    <Layout className="page-shell">
      <Header
        style={{
          background: 'rgba(250, 246, 238, 0.88)',
          borderBottom: '1px solid rgba(94, 104, 98, 0.12)',
          paddingInline: 24,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backdropFilter: 'blur(14px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '100%',
            gap: 16,
          }}
        >
          <div>
            <Typography.Text
              style={{
                display: 'block',
                fontFamily: '"Fraunces", Georgia, serif',
                fontSize: '1.2rem',
                fontWeight: 700,
              }}
            >
              Creative Excellence Awards
            </Typography.Text>
            <Typography.Text type="secondary">Judge Voting Workspace</Typography.Text>
          </div>

          <Space size="middle">
            <Tag color="green">{user?.role}</Tag>
            <Typography.Text strong>{user?.display_name}</Typography.Text>
            <Button icon={<LogoutOutlined />} onClick={logout}>
              Logout
            </Button>
          </Space>
        </div>
      </Header>

      <Content style={{ padding: 24 }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
