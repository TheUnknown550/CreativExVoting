import {
  AppstoreOutlined,
  BarChartOutlined,
  FolderOpenOutlined,
  LogoutOutlined,
  TagsOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

const { Sider, Header, Content } = Layout;

const items: MenuProps['items'] = [
  { key: '/admin/dashboard', icon: <AppstoreOutlined />, label: 'Dashboard' },
  { key: '/admin/projects', icon: <FolderOpenOutlined />, label: 'Projects' },
  { key: '/admin/categories', icon: <TagsOutlined />, label: 'Categories' },
  { key: '/admin/criteria', icon: <BarChartOutlined />, label: 'Criteria' },
  { key: '/admin/judges', icon: <TeamOutlined />, label: 'Judges' },
  { key: '/admin/results', icon: <BarChartOutlined />, label: 'Results' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        width={260}
        style={{
          background: 'linear-gradient(180deg, #233129 0%, #1a221d 100%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ padding: 24, color: '#f8f5ef' }}>
          <Typography.Text
            style={{
              color: '#f8f5ef',
              display: 'block',
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: '1.25rem',
            }}
          >
            Creative Excellence
          </Typography.Text>
          <Typography.Text style={{ color: 'rgba(248, 245, 239, 0.75)' }}>
            Admin control room
          </Typography.Text>
        </div>

        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderInlineEnd: 'none' }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: 'rgba(250, 246, 238, 0.88)',
            borderBottom: '1px solid rgba(94, 104, 98, 0.12)',
            paddingInline: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <Typography.Text strong style={{ display: 'block' }}>
              {user?.display_name}
            </Typography.Text>
            <Typography.Text type="secondary">Platform administrator</Typography.Text>
          </div>

          <Space>
            <Button icon={<LogoutOutlined />} onClick={logout}>
              Logout
            </Button>
          </Space>
        </Header>

        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
