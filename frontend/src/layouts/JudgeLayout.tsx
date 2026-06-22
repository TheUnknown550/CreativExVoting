import { Layout, Space, Typography, Button, Tag } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { Outlet } from 'react-router-dom';

import { BrandMark } from '../components/BrandMark';
import { useAuth } from '../contexts/AuthContext';

const { Header, Content } = Layout;

export function JudgeLayout() {
  const { user, logout } = useAuth();

  return (
    <Layout className="page-shell judge-shell">
      <Header className="ce-topbar ce-topbar--judge">
        <div className="ce-topbar__inner">
          <div className="ce-brandline">
            <Typography.Title level={2} className="ce-brandline__title">
              CE Awards 2026
            </Typography.Title>
            <Typography.Text className="ce-brandline__subtitle">
              พื้นที่ทำงานกรรมการ
            </Typography.Text>
          </div>

          <Space size="middle" wrap>
            <Tag className="ce-role-tag">{user?.role}</Tag>
            <Typography.Text className="ce-topbar__user">{user?.display_name}</Typography.Text>
            <Button className="ce-ghost-button" icon={<LogoutOutlined />} onClick={logout}>
              ออกจากระบบ
            </Button>
            <BrandMark tone="light" className="ce-topbar__mark" />
          </Space>
        </div>
      </Header>

      <Content className="ce-page-content">
        <Outlet />
      </Content>
    </Layout>
  );
}
