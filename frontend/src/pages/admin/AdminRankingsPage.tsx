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
import { startTransition, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type {
  Category,
  ProjectVoteDetail,
  ResultsResponse,
  User,
} from '../../types/domain';

export function AdminRankingsPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [judges, setJudges] = useState<User[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [judgeFilter, setJudgeFilter] = useState<string>();
  const [rankingResults, setRankingResults] = useState<ResultsResponse>({ rankings: [], judge_votes: [] });
  const [judgeVoteResults, setJudgeVoteResults] = useState<ResultsResponse>({ rankings: [], judge_votes: [] });
  const [detail, setDetail] = useState<ProjectVoteDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [judgeVotesLoading, setJudgeVotesLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!token) {
      return;
    }
    const activeToken: string = token;

    let cancelled = false;

    async function loadFilters() {
      try {
        const [nextCategories, nextJudges] = await Promise.all([
          adminApi.getAdminCategories(activeToken),
          adminApi.getAdminJudges(activeToken),
        ]);

        if (cancelled) {
          return;
        }

        setCategories(nextCategories);
        setJudges(nextJudges.filter((user) => user.role === 'judge'));

        const categoryFromUrl = searchParams.get('category');
        const validCategoryId =
          categoryFromUrl && nextCategories.some((category) => category.id === categoryFromUrl)
            ? categoryFromUrl
            : nextCategories[0]?.id;

        setSelectedCategoryId(validCategoryId);

        if (validCategoryId && validCategoryId !== categoryFromUrl) {
          setSearchParams({ category: validCategoryId }, { replace: true });
        }
      } catch (error) {
        if (!cancelled) {
          messageApi.error(error instanceof ApiError ? error.message : 'Unable to load ranking filters.');
        }
      }
    }

    void loadFilters();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, token]);

  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    if (categoryFromUrl && categoryFromUrl !== selectedCategoryId) {
      setSelectedCategoryId(categoryFromUrl);
    }
  }, [searchParams, selectedCategoryId]);

  useEffect(() => {
    if (!token || !selectedCategoryId) {
      return;
    }
    const activeToken: string = token;
    const activeCategoryId: string = selectedCategoryId;

    let cancelled = false;
    setRankingLoading(true);

    async function loadRankings() {
      try {
        const response = await adminApi.getAdminResults(activeToken, activeCategoryId);
        if (!cancelled) {
          setRankingResults(response);
        }
      } catch (error) {
        if (!cancelled) {
          messageApi.error(error instanceof ApiError ? error.message : 'Unable to load category rankings.');
        }
      } finally {
        if (!cancelled) {
          setRankingLoading(false);
        }
      }
    }

    void loadRankings();
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId, token]);

  useEffect(() => {
    if (!token || !selectedCategoryId) {
      return;
    }
    const activeToken: string = token;
    const activeCategoryId: string = selectedCategoryId;

    let cancelled = false;
    setJudgeVotesLoading(true);

    async function loadJudgeVotes() {
      try {
        const response = await adminApi.getAdminResults(activeToken, activeCategoryId, judgeFilter);
        if (!cancelled) {
          setJudgeVoteResults(response);
        }
      } catch (error) {
        if (!cancelled) {
          messageApi.error(error instanceof ApiError ? error.message : 'Unable to load judge submissions.');
        }
      } finally {
        if (!cancelled) {
          setJudgeVotesLoading(false);
        }
      }
    }

    void loadJudgeVotes();
    return () => {
      cancelled = true;
    };
  }, [judgeFilter, selectedCategoryId, token]);

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

  async function handleExport(categoryId?: string, judgeId?: string) {
    if (!token) {
      return;
    }
    setExporting(true);
    try {
      const blob = await adminApi.exportResultsCsv(token, categoryId, judgeId);
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

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <section className="page-hero">
          <Typography.Title className="page-title" level={1}>
            Rankings
          </Typography.Title>
          <Typography.Paragraph className="page-subtitle">
            Inspect one category at a time, see its full leaderboard, and review the judge-by-judge
            scoring activity for that same category.
          </Typography.Paragraph>
        </section>

        <Tabs
          items={[
            {
              key: 'rankings',
              label: 'Category Ranking',
              children: (
                <Card className="soft-card">
                  <div className="results-section-heading">
                    <div>
                      <Typography.Title level={3} className="results-section-heading__title">
                        Category Ranking
                      </Typography.Title>
                      <Typography.Paragraph className="results-section-heading__copy">
                        Choose a category to view its full leaderboard. The summary page buttons route
                        directly here and preselect the clicked category.
                      </Typography.Paragraph>
                    </div>
                  </div>

                  <div className="table-toolbar">
                    <div className="table-toolbar__filters">
                      <Select
                        placeholder="Select category"
                        value={selectedCategoryId}
                        onChange={(value) => {
                          startTransition(() => {
                            setSelectedCategoryId(value);
                            setSearchParams({ category: value });
                          });
                        }}
                        options={categories.map((category) => ({ value: category.id, label: category.name }))}
                        style={{ width: 320 }}
                      />
                    </div>

                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      loading={exporting}
                      onClick={() => void handleExport(selectedCategoryId)}
                    >
                      Export Category CSV
                    </Button>
                  </div>

                  <Typography.Title level={4} className="results-selected-category">
                    {selectedCategory?.name ? `${selectedCategory.name} Rankings` : 'Select a category'}
                  </Typography.Title>

                  <Table
                    rowKey="project_id"
                    loading={rankingLoading}
                    dataSource={rankingResults.rankings}
                    pagination={false}
                    locale={{ emptyText: 'No ranking data available for this category yet.' }}
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
                </Card>
              ),
            },
            {
              key: 'judgeVotes',
              label: 'Per Judge Scores',
              children: (
                <Card className="soft-card">
                  <div className="table-toolbar">
                    <div className="table-toolbar__filters">
                      <Select
                        placeholder="Select category"
                        value={selectedCategoryId}
                        onChange={(value) => {
                          startTransition(() => {
                            setSelectedCategoryId(value);
                            setSearchParams({ category: value });
                          });
                        }}
                        options={categories.map((category) => ({ value: category.id, label: category.name }))}
                        style={{ width: 260 }}
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

                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      loading={exporting}
                      onClick={() => void handleExport(selectedCategoryId, judgeFilter)}
                    >
                      Export Filtered CSV
                    </Button>
                  </div>

                  <Table
                    rowKey="vote_id"
                    loading={judgeVotesLoading}
                    dataSource={judgeVoteResults.judge_votes}
                    pagination={false}
                    locale={{ emptyText: 'No judge submissions match the current filter.' }}
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
                </Card>
              ),
            },
          ]}
        />
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
