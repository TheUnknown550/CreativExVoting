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
import { useLanguage } from '../../contexts/LanguageContext';
import type {
  Category,
  ProjectVoteDetail,
  ResultsResponse,
  User,
} from '../../types/domain';

export function AdminRankingsPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
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
          messageApi.error(error instanceof ApiError ? error.message : t('adminRankings.loadFiltersError'));
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
          messageApi.error(error instanceof ApiError ? error.message : t('adminRankings.loadRankingsError'));
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
          messageApi.error(error instanceof ApiError ? error.message : t('adminRankings.loadJudgeVotesError'));
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
      messageApi.error(error instanceof ApiError ? error.message : t('adminRankings.loadDetailError'));
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
      messageApi.success(t('adminRankings.exportSuccess'));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminRankings.exportError'));
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
            {t('adminRankings.title')}
          </Typography.Title>
          <Typography.Paragraph className="page-subtitle">{t('adminRankings.subtitle')}</Typography.Paragraph>
        </section>

        <Tabs
          items={[
            {
              key: 'rankings',
              label: t('adminRankings.categoryRankingTab'),
              children: (
                <Card className="soft-card">
                  <div className="results-section-heading">
                    <div>
                      <Typography.Title level={3} className="results-section-heading__title">
                        {t('adminRankings.categoryRanking')}
                      </Typography.Title>
                      <Typography.Paragraph className="results-section-heading__copy">
                        {t('adminRankings.categoryRankingCopy')}
                      </Typography.Paragraph>
                    </div>
                  </div>

                  <div className="table-toolbar">
                    <div className="table-toolbar__filters">
                      <Select
                        placeholder={t('adminRankings.selectCategory')}
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
                      {t('adminRankings.exportCategoryCsv')}
                    </Button>
                  </div>

                  <Typography.Title level={4} className="results-selected-category">
                    {selectedCategory?.name
                      ? `${t('adminRankings.rankingsSuffix')} ${selectedCategory.name}`
                      : t('adminRankings.selectACategory')}
                  </Typography.Title>

                  <Table
                    rowKey="project_id"
                    loading={rankingLoading}
                    dataSource={rankingResults.rankings}
                    pagination={false}
                    locale={{ emptyText: t('adminRankings.noRankingData') }}
                    columns={[
                      { title: t('adminRankings.rank'), dataIndex: 'ranking', width: 80 },
                      {
                        title: t('adminRankings.project'),
                        dataIndex: 'project_name',
                        render: (value: string) => (
                          <Space>
                            <TrophyOutlined style={{ color: '#b78b4b' }} />
                            <span>{value}</span>
                          </Space>
                        ),
                      },
                      { title: t('adminRankings.totalScore'), dataIndex: 'total_score', width: 130 },
                      {
                        title: t('adminRankings.averageScore'),
                        dataIndex: 'average_score',
                        width: 140,
                        render: (value: number) => value.toFixed(2),
                      },
                      { title: t('adminRankings.submittedVotes'), dataIndex: 'submitted_votes', width: 140 },
                      {
                        title: t('adminRankings.completion'),
                        dataIndex: 'completion_percent',
                        width: 140,
                        render: (value: number) => `${value.toFixed(1)}%`,
                      },
                      {
                        title: t('adminRankings.detail'),
                        width: 130,
                        render: (_, record) => (
                          <Button icon={<EyeOutlined />} onClick={() => void openDetail(record.project_id)}>
                            {t('adminRankings.detail')}
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
              label: t('adminRankings.perJudgeScoresTab'),
              children: (
                <Card className="soft-card">
                  <div className="table-toolbar">
                    <div className="table-toolbar__filters">
                      <Select
                        placeholder={t('adminRankings.selectCategory')}
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
                        placeholder={t('adminRankings.filterByJudge')}
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
                      {t('adminRankings.exportFilteredCsv')}
                    </Button>
                  </div>

                  <Table
                    rowKey="vote_id"
                    loading={judgeVotesLoading}
                    dataSource={judgeVoteResults.judge_votes}
                    pagination={false}
                    locale={{ emptyText: t('adminRankings.noJudgeSubmissions') }}
                    columns={[
                      { title: t('adminRankings.judge'), dataIndex: 'judge_name' },
                      { title: t('adminRankings.project'), dataIndex: 'project_name' },
                      { title: t('adminRankings.category'), dataIndex: 'category' },
                      { title: t('adminRankings.totalScore'), dataIndex: 'total_score', width: 130 },
                      {
                        title: t('adminRankings.submitted'),
                        dataIndex: 'submitted_at',
                        width: 180,
                        render: (value?: string | null) =>
                          value ? dayjs(value).format('DD MMM YYYY HH:mm') : <Tag>{t('adminRankings.draft')}</Tag>,
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
        title={detail?.project.title ?? t('adminRankings.voteDetail')}
        footer={null}
        onCancel={() => setDetailOpen(false)}
        width={920}
      >
        {detail ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={1}>
              <Descriptions.Item label={t('adminRankings.category')}>
                {detail.project.category_name}
              </Descriptions.Item>
              <Descriptions.Item label={t('adminRankings.combinedScore')}>
                {detail.combined_score}
              </Descriptions.Item>
              <Descriptions.Item label={t('adminRankings.designerTeam')}>
                {detail.project.designer_name || detail.project.team_name || t('common.notProvided')}
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
                      { title: t('adminRankings.criterion'), dataIndex: 'criterion_name' },
                      { title: t('adminRankings.score'), dataIndex: 'score', width: 120 },
                      { title: t('adminRankings.maxScore'), dataIndex: 'max_score', width: 120 },
                    ]}
                  />
                ),
              }}
              columns={[
                { title: t('adminRankings.judge'), dataIndex: 'judge_name' },
                { title: t('adminRankings.totalScore'), dataIndex: 'total_score', width: 140 },
                {
                  title: t('adminRankings.submittedAt'),
                  dataIndex: 'submitted_at',
                  width: 200,
                  render: (value?: string | null) =>
                    value ? dayjs(value).format('DD MMM YYYY HH:mm') : <Tag>{t('adminRankings.draft')}</Tag>,
                },
              ]}
            />
          </Space>
        ) : null}
      </Modal>
    </>
  );
}
