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
  { to: '/admin/projects', icon: <FolderOpenOutlined />, label: 'จัดการผลงาน' },
  { to: '/admin/categories', icon: <FileTextOutlined />, label: 'จัดการหมวดหมู่' },
  { to: '/admin/criteria', icon: <BarChartOutlined />, label: 'จัดการเกณฑ์การให้คะแนน' },
  { to: '/admin/judges', icon: <TeamOutlined />, label: 'จัดการกรรมการ' },
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
      setErrorMessage(error instanceof ApiError ? error.message : 'ไม่สามารถโหลดแดชบอร์ดได้');
    }
  });

  useEffect(() => {
    void loadDashboard();
  }, [token]);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <section className="page-hero">
        <Typography.Title className="page-title" level={1}>
          แดชบอร์ดผู้ดูแลระบบ
        </Typography.Title>
        <Typography.Paragraph className="page-subtitle">
          ดูแลกระบวนการตัดสินให้ดำเนินต่อไปได้อย่างราบรื่น โดยจัดการหมวดหมู่รางวัล ผลงาน
          เกณฑ์การให้คะแนน การมอบหมายกรรมการ และผลคะแนนที่ส่งออกได้ จากที่เดียว
        </Typography.Paragraph>
        {errorMessage ? <Typography.Text type="danger">{errorMessage}</Typography.Text> : null}
      </section>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className="admin-kpi">
            <Statistic title="ผลงานที่เปิดใช้งาน" value={stats?.total_projects ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="admin-kpi">
            <Statistic title="กรรมการ" value={stats?.total_judges ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="admin-kpi">
            <Statistic title="หมวดหมู่" value={stats?.total_categories ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="admin-kpi">
            <Statistic
              title="ความสำเร็จ"
              value={stats?.completion_percentage ?? 0}
              precision={1}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card className="soft-card" title="ทางลัด">
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
          <Card className="soft-card" title="ภาพรวมการส่งคะแนน">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Statistic title="คะแนนที่ส่งแล้ว" value={stats?.total_votes_submitted ?? 0} />
              <Statistic title="จำนวนคะแนนที่เป็นไปได้ทั้งหมด" value={stats?.possible_vote_count ?? 0} />
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
