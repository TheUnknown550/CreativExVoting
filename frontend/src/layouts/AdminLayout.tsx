import {
  AppstoreOutlined,
  BarChartOutlined,
  FolderOpenOutlined,
  LogoutOutlined,
  OrderedListOutlined,
  TagsOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { BrandMark } from '../components/BrandMark';
import { LanguageToggle } from '../components/LanguageToggle';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const { Sider, Header, Content } = Layout;

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const items: MenuProps['items'] = [
    { key: '/admin/dashboard', icon: <AppstoreOutlined />, label: t('adminLayout.nav.dashboard') },
    { key: '/admin/projects', icon: <FolderOpenOutlined />, label: t('adminLayout.nav.projects') },
    { key: '/admin/categories', icon: <TagsOutlined />, label: t('adminLayout.nav.categories') },
    { key: '/admin/criteria', icon: <BarChartOutlined />, label: t('adminLayout.nav.criteria') },
    { key: '/admin/judges', icon: <TeamOutlined />, label: t('adminLayout.nav.judges') },
    { key: '/admin/results', icon: <BarChartOutlined />, label: t('adminLayout.nav.results') },
    { key: '/admin/rankings', icon: <OrderedListOutlined />, label: t('adminLayout.nav.rankings') },
  ];

  return (
    <Layout className="admin-shell">
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        width={260}
        className="admin-sider"
      >
        <div className="admin-sider__brand">
          <BrandMark tone="light" className="admin-sider__mark" />
          <Typography.Text className="admin-sider__title">CE Awards 2026</Typography.Text>
          <Typography.Text className="admin-sider__subtitle">{t('adminLayout.controlRoom')}</Typography.Text>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={({ key }) => navigate(key)}
          className="admin-menu"
        />
      </Sider>

      <Layout className="admin-main">
        <Header className="ce-topbar ce-topbar--admin">
          <div className="ce-topbar__inner">
            <div className="ce-brandline">
              <Typography.Title level={2} className="ce-brandline__title">
                CE Awards 2026
              </Typography.Title>
              <Typography.Text className="ce-brandline__subtitle">
                {t('adminLayout.subtitle')}
              </Typography.Text>
            </div>

            <Space>
              <LanguageToggle />
              <Typography.Text className="ce-topbar__user">{user?.display_name}</Typography.Text>
              <Button className="ce-ghost-button" icon={<LogoutOutlined />} onClick={logout}>
                {t('common.logout')}
              </Button>
            </Space>
          </div>
        </Header>

        <Content className="ce-page-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
