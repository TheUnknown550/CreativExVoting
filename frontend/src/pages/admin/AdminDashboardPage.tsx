import {
  BarChartOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Space, Statistic, Typography } from 'antd';
import { useEffect, useEffectEvent, useState } from 'react';
import { Link } from 'react-router-dom';

import { getDashboard } from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { DashboardStats } from '../../types/domain';

const quickLinks = [
  { to: '/admin/projects', icon: <FolderOpenOutlined />, label: 'Manage Projects' },
  { to: '/admin/categories', icon: <FileTextOutlined />, label: 'Manage Categories' },
  { to: '/admin/criteria', icon: <BarChartOutlined />, label: 'Manage Criteria' },
  { to: '/admin/judges', icon: <TeamOutlined />, label: 'Manage Judges' },
];

export function AdminDashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboard = useEffectEvent(async () => {
    if (!token) {
      return;
    }
    try {
      setStats(await getDashboard(token));
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Unable to load dashboard.');
    }
  });

  useEffect(() => {
    void loadDashboard();
  }, [token]);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <section className="page-hero">
        <Typography.Title className="page-title" level={1}>
          Admin Dashboard
        </Typography.Title>
        <Typography.Paragraph className="page-subtitle">
          Keep the judging program moving by managing award categories, projects, scoring rubrics,
          judge assignments, and exportable results from one place.
        </Typography.Paragraph>
        {errorMessage ? <Typography.Text type="danger">{errorMessage}</Typography.Text> : null}
      </section>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className="admin-kpi">
            <Statistic title="Active Projects" value={stats?.total_projects ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="admin-kpi">
            <Statistic title="Judges" value={stats?.total_judges ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="admin-kpi">
            <Statistic title="Categories" value={stats?.total_categories ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="admin-kpi">
            <Statistic
              title="Completion"
              value={stats?.completion_percentage ?? 0}
              precision={1}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card className="soft-card" title="Quick Actions">
            <Row gutter={[16, 16]}>
              {quickLinks.map((link) => (
                <Col xs={24} md={12} key={link.to}>
                  <Link to={link.to} style={{ textDecoration: 'none' }}>
                    <Card hoverable bordered={false} className="soft-card">
                      <Space>
                        {link.icon}
                        <Typography.Text strong>{link.label}</Typography.Text>
                      </Space>
                    </Card>
                  </Link>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card className="soft-card" title="Submission Snapshot">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Statistic title="Votes Submitted" value={stats?.total_votes_submitted ?? 0} />
              <Statistic title="Possible Vote Count" value={stats?.possible_vote_count ?? 0} />
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
