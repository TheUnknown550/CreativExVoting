import {
  CheckCircleFilled,
  EyeOutlined,
  FileDoneOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { startTransition, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import * as judgeApi from '../../api/judge';
import { ApiError } from '../../api/client';
import { ProjectVoteDrawer } from '../../components/ProjectVoteDrawer';
import { useAuth } from '../../contexts/AuthContext';
import type { Category, JudgeProjectCard, JudgeProjectDetail, JudgeSummaryRow, Vote } from '../../types/domain';

type WorkspaceTab = 'projects' | 'summary';

export function JudgeWorkspacePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const currentTab: WorkspaceTab = location.pathname.endsWith('/summary') ? 'summary' : 'projects';
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [projects, setProjects] = useState<JudgeProjectCard[]>([]);
  const [summaryRows, setSummaryRows] = useState<JudgeSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerSubmitting, setDrawerSubmitting] = useState(false);
  const [activeProjectDetail, setActiveProjectDetail] = useState<JudgeProjectDetail | null>(null);
  const [activeVote, setActiveVote] = useState<Vote | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!token) {
      return;
    }
    const activeToken: string = token;

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    async function loadInitialData() {
      try {
        const nextCategories = await judgeApi.getJudgeCategories(activeToken);
        if (cancelled) {
          return;
        }

        setCategories(nextCategories);
        const nextCategoryId = nextCategories[0]?.id;
        setSelectedCategoryId((current) => current ?? nextCategoryId);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof ApiError ? error.message : 'Unable to load categories.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedCategoryId) {
      return;
    }
    const activeToken: string = token;

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    async function loadWorkspaceData() {
      try {
        const [nextProjects, nextSummary] = await Promise.all([
          judgeApi.getJudgeProjects(activeToken, selectedCategoryId),
          judgeApi.getJudgeSummary(activeToken, selectedCategoryId),
        ]);

        if (!cancelled) {
          setProjects(nextProjects);
          setSummaryRows(nextSummary);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof ApiError ? error.message : 'Unable to load judging data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWorkspaceData();
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId, token]);

  async function openProject(projectId: string) {
    if (!token) {
      return;
    }

    setDrawerOpen(true);
    setDrawerLoading(true);
    setErrorMessage(null);

    try {
      const [detail, vote] = await Promise.all([
        judgeApi.getJudgeProjectDetail(token, projectId),
        judgeApi.getMyVote(token, projectId),
      ]);
      setActiveProjectDetail(detail);
      setActiveVote(vote);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Unable to open project details.');
    } finally {
      setDrawerLoading(false);
    }
  }

  async function refreshWorkspace(projectId?: string) {
    if (!token || !selectedCategoryId) {
      return;
    }

    const [nextProjects, nextSummary] = await Promise.all([
      judgeApi.getJudgeProjects(token, selectedCategoryId),
      judgeApi.getJudgeSummary(token, selectedCategoryId),
    ]);
    setProjects(nextProjects);
    setSummaryRows(nextSummary);

    if (projectId) {
      const [detail, vote] = await Promise.all([
        judgeApi.getJudgeProjectDetail(token, projectId),
        judgeApi.getMyVote(token, projectId),
      ]);
      setActiveProjectDetail(detail);
      setActiveVote(vote);
    }
  }

  async function handleSubmitVote(
    projectId: string,
    scores: Array<{ criterion_id: string; score: number }>,
  ) {
    if (!token || !activeProjectDetail) {
      return;
    }

    setDrawerSubmitting(true);
    try {
      const apiCall = activeVote ? judgeApi.updateVote : judgeApi.submitVote;
      await apiCall(token, projectId, { scores });
      await refreshWorkspace(projectId);
      Modal.success({
        title: 'Voting submitted successfully',
        content: 'Your scores have been saved. You can reopen this project later to edit them.',
      });
      messageApi.success('Vote saved successfully.');
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to submit vote.');
    } finally {
      setDrawerSubmitting(false);
    }
  }

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <section className="page-hero">
          <div className="page-hero__eyeline">
            <div>
              <Typography.Title className="page-title" level={1}>
                Judge Voting Workspace
              </Typography.Title>
              <Typography.Paragraph className="page-subtitle">
                Welcome back, {user?.display_name}. Review the projects assigned to your categories,
                score them against live criteria, and revisit your rankings anytime.
              </Typography.Paragraph>
            </div>

            <div className="summary-ribbon">
              <TrophyOutlined />
              {summaryRows.filter((item) => item.has_voted).length} / {summaryRows.length} projects scored
            </div>
          </div>

          <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
            <Col xs={24} md={12} lg={8}>
              <Select
                value={selectedCategoryId}
                onChange={(value) => {
                  startTransition(() => setSelectedCategoryId(value));
                }}
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                placeholder="Select category"
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Segmented<WorkspaceTab>
                value={currentTab}
                options={[
                  { label: 'Vote Projects', value: 'projects' },
                  { label: 'My Vote Summary', value: 'summary' },
                ]}
                onChange={(value) => {
                  startTransition(() => {
                    navigate(value === 'summary' ? '/judge/summary' : '/judge/projects');
                  });
                }}
              />
            </Col>
          </Row>
        </section>

        {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}

        {loading ? (
          <div className="full-height-spin" style={{ minHeight: 280 }}>
            <Spin size="large" />
          </div>
        ) : currentTab === 'projects' ? (
          projects.length > 0 ? (
            <div className="project-grid">
              {projects.map((project) => (
                <article
                  className={`project-card ${project.has_voted ? 'project-card--voted' : ''}`}
                  key={project.id}
                >
                  {project.image_url ? (
                    <img src={project.image_url} alt={project.title} className="project-card__media" />
                  ) : (
                    <div className="project-card__placeholder">Project preview</div>
                  )}

                  <div style={{ padding: 18 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                      <div>
                        <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 6 }}>
                          {project.title}
                        </Typography.Title>
                        <Typography.Text type="secondary">
                          {project.designer_name || project.team_name || selectedCategory?.name}
                        </Typography.Text>
                      </div>

                      {project.has_voted ? (
                        <Tag color="green" icon={<CheckCircleFilled />}>
                          Voted
                        </Tag>
                      ) : (
                        <Tag>Pending</Tag>
                      )}
                    </Space>

                    <Typography.Paragraph
                      style={{ minHeight: 66, marginTop: 14 }}
                      type="secondary"
                    >
                      {project.short_description || 'No short description was provided.'}
                    </Typography.Paragraph>

                    <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                      <Typography.Text strong>
                        {project.current_score != null ? `Your score: ${project.current_score}` : 'Not scored yet'}
                      </Typography.Text>
                      <Button type="primary" icon={<EyeOutlined />} onClick={() => void openProject(project.id)}>
                        Detail &amp; Vote
                      </Button>
                    </Space>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Card className="soft-card">
              <Empty description="No projects are available in this category yet." />
            </Card>
          )
        ) : (
          <Card className="soft-card">
            <Table<JudgeSummaryRow>
              rowKey="project_id"
              pagination={false}
              dataSource={summaryRows}
              columns={[
                { title: 'Ranking', dataIndex: 'ranking', width: 100 },
                { title: 'Project Name', dataIndex: 'project_name' },
                {
                  title: 'Total Score',
                  dataIndex: 'total_score',
                  width: 140,
                },
                {
                  title: 'Vote Status',
                  dataIndex: 'has_voted',
                  width: 140,
                  render: (value: boolean) =>
                    value ? <Tag color="green">Submitted</Tag> : <Tag>Pending</Tag>,
                },
                {
                  title: 'Detail',
                  width: 140,
                  render: (_, record) => (
                    <Button icon={<FileDoneOutlined />} onClick={() => void openProject(record.project_id)}>
                      Detail
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        )}
      </Space>

      <ProjectVoteDrawer
        open={drawerOpen}
        loading={drawerLoading}
        detail={activeProjectDetail}
        vote={activeVote}
        submitting={drawerSubmitting}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmitVote}
      />
    </>
  );
}
