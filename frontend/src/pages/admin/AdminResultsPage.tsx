import {
  DownloadOutlined,
  EyeOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Descriptions,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type {
  Category,
  ProjectVoteDetail,
  ResultsResponse,
  User,
} from '../../types/domain';

export function AdminResultsPage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [judges, setJudges] = useState<User[]>([]);
  const [results, setResults] = useState<ResultsResponse>({ rankings: [], judge_votes: [] });
  const [categoryFilter, setCategoryFilter] = useState<string>();
  const [judgeFilter, setJudgeFilter] = useState<string>();
  const [detail, setDetail] = useState<ProjectVoteDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  async function loadFilters() {
    if (!token) {
      return;
    }
    try {
      const [nextCategories, nextJudges] = await Promise.all([
        adminApi.getAdminCategories(token),
        adminApi.getAdminJudges(token),
      ]);
      setCategories(nextCategories);
      setJudges(nextJudges.filter((user) => user.role === 'judge'));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to load filters.');
    }
  }

  async function loadResults() {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      setResults(await adminApi.getAdminResults(token, categoryFilter, judgeFilter));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to load results.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFilters();
  }, [token]);

  useEffect(() => {
    void loadResults();
  }, [token, categoryFilter, judgeFilter]);

  async function openDetail(projectId: string) {
    if (!token) {
      return;
    }
    try {
      setDetail(await adminApi.getProjectVoteDetail(token, projectId));
      setDetailOpen(true);
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to load vote detail.');
    }
  }

  async function handleExport() {
    if (!token) {
      return;
    }
    setExporting(true);
    try {
      const blob = await adminApi.exportResultsCsv(token, categoryFilter, judgeFilter);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'voting-results.csv';
      anchor.click();
      URL.revokeObjectURL(url);
      messageApi.success('CSV export started.');
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to export CSV.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <section className="page-hero">
          <Typography.Title className="page-title" level={1}>
            Results &amp; Exports
          </Typography.Title>
          <Typography.Paragraph className="page-subtitle">
            Review overall rankings, inspect individual judge submissions, and export detailed CSV data
            for downstream reporting.
          </Typography.Paragraph>
        </section>

        <Card className="soft-card">
          <div className="table-toolbar">
            <div className="table-toolbar__filters">
              <Select
                allowClear
                placeholder="Filter by category"
                value={categoryFilter}
                onChange={(value) => setCategoryFilter(value)}
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                style={{ width: 220 }}
              />
              <Select
                allowClear
                placeholder="Filter by judge"
                value={judgeFilter}
                onChange={(value) => setJudgeFilter(value)}
                options={judges.map((judge) => ({ value: judge.id, label: judge.display_name }))}
                style={{ width: 220 }}
              />
            </div>
            <Button type="primary" icon={<DownloadOutlined />} loading={exporting} onClick={() => void handleExport()}>
              Export CSV
            </Button>
          </div>

          <Tabs
            items={[
              {
                key: 'rankings',
                label: 'Overall Ranking',
                children: (
                  <Table
                    rowKey="project_id"
                    loading={loading}
                    dataSource={results.rankings}
                    pagination={false}
                    columns={[
                      { title: 'Rank', dataIndex: 'ranking', width: 80 },
                      {
                        title: 'Project',
                        dataIndex: 'project_name',
                        render: (value: string) => (
                          <Space>
                            <TrophyOutlined style={{ color: '#b78b4b' }} />
                            <span>{value}</span>
                          </Space>
                        ),
                      },
                      { title: 'Category', dataIndex: 'category' },
                      { title: 'Total Score', dataIndex: 'total_score', width: 130 },
                      {
                        title: 'Average Score',
                        dataIndex: 'average_score',
                        width: 140,
                        render: (value: number) => value.toFixed(2),
                      },
                      { title: 'Submitted Votes', dataIndex: 'submitted_votes', width: 140 },
                      {
                        title: 'Completion',
                        dataIndex: 'completion_percent',
                        width: 140,
                        render: (value: number) => `${value.toFixed(1)}%`,
                      },
                      {
                        title: 'Detail',
                        width: 130,
                        render: (_, record) => (
                          <Button icon={<EyeOutlined />} onClick={() => void openDetail(record.project_id)}>
                            Detail
                          </Button>
                        ),
                      },
                    ]}
                  />
                ),
              },
              {
                key: 'judgeVotes',
                label: 'Per Judge Scores',
                children: (
                  <Table
                    rowKey="vote_id"
                    loading={loading}
                    dataSource={results.judge_votes}
                    pagination={false}
                    columns={[
                      { title: 'Judge', dataIndex: 'judge_name' },
                      { title: 'Project', dataIndex: 'project_name' },
                      { title: 'Category', dataIndex: 'category' },
                      { title: 'Total Score', dataIndex: 'total_score', width: 130 },
                      {
                        title: 'Submitted',
                        dataIndex: 'submitted_at',
                        width: 180,
                        render: (value?: string | null) =>
                          value ? dayjs(value).format('DD MMM YYYY HH:mm') : <Tag>Draft</Tag>,
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Card>
      </Space>

      <Modal
        open={detailOpen}
        title={detail?.project.title ?? 'Vote Detail'}
        footer={null}
        onCancel={() => setDetailOpen(false)}
        width={920}
      >
        {detail ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Category">{detail.project.category_name}</Descriptions.Item>
              <Descriptions.Item label="Combined Score">{detail.combined_score}</Descriptions.Item>
              <Descriptions.Item label="Designer / Team">
                {detail.project.designer_name || detail.project.team_name || 'Not provided'}
              </Descriptions.Item>
            </Descriptions>

            <Table
              rowKey="vote_id"
              pagination={false}
              dataSource={detail.judge_votes}
              expandable={{
                expandedRowRender: (record) => (
                  <Table
                    rowKey="criterion_id"
                    pagination={false}
                    size="small"
                    dataSource={record.scores}
                    columns={[
                      { title: 'Criterion', dataIndex: 'criterion_name' },
                      { title: 'Score', dataIndex: 'score', width: 120 },
                      { title: 'Max Score', dataIndex: 'max_score', width: 120 },
                    ]}
                  />
                ),
              }}
              columns={[
                { title: 'Judge', dataIndex: 'judge_name' },
                { title: 'Total Score', dataIndex: 'total_score', width: 140 },
                {
                  title: 'Submitted At',
                  dataIndex: 'submitted_at',
                  width: 200,
                  render: (value?: string | null) =>
                    value ? dayjs(value).format('DD MMM YYYY HH:mm') : <Tag>Draft</Tag>,
                },
              ]}
            />
          </Space>
        ) : null}
      </Modal>
    </>
  );
}
