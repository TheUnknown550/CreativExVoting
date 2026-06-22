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
import { useLanguage } from '../../contexts/LanguageContext';
import type { DashboardStats } from '../../types/domain';

export function AdminDashboardPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const quickLinks = [
    { to: '/admin/projects', icon: <FolderOpenOutlined />, label: t('adminDashboard.manageProjects') },
    { to: '/admin/categories', icon: <FileTextOutlined />, label: t('adminDashboard.manageCategories') },
    { to: '/admin/criteria', icon: <BarChartOutlined />, label: t('adminDashboard.manageCriteria') },
    { to: '/admin/judges', icon: <TeamOutlined />, label: t('adminDashboard.manageJudges') },
  ];

  const loadDashboard = useEffectEvent(async () => {
    if (!token) {
      return;
    }
    try {
      setStats(await getDashboard(token));
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('adminDashboard.loadError'));
    }
  });

  useEffect(() => {
    void loadDashboard();
  }, [token]);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <section className="page-hero">
        <Typography.Title className="page-title" level={1}>
          {t('adminDashboard.title')}
        </Typography.Title>
        <Typography.Paragraph className="page-subtitle">{t('adminDashboard.subtitle')}</Typography.Paragraph>
        {errorMessage ? <Typography.Text type="danger">{errorMessage}</Typography.Text> : null}
      </section>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className="admin-kpi">
            <Statistic title={t('adminDashboard.activeProjects')} value={stats?.total_projects ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="admin-kpi">
            <Statistic title={t('adminDashboard.judges')} value={stats?.total_judges ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="admin-kpi">
            <Statistic title={t('adminDashboard.categories')} value={stats?.total_categories ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="admin-kpi">
            <Statistic
              title={t('adminDashboard.completion')}
              value={stats?.completion_percentage ?? 0}
              precision={1}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card className="soft-card" title={t('adminDashboard.quickActions')}>
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
          <Card className="soft-card" title={t('adminDashboard.submissionSnapshot')}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Statistic title={t('adminDashboard.votesSubmitted')} value={stats?.total_votes_submitted ?? 0} />
              <Statistic
                title={t('adminDashboard.possibleVoteCount')}
                value={stats?.possible_vote_count ?? 0}
              />
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
