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
  Empty,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { startTransition, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import * as judgeApi from '../../api/judge';
import { ApiError } from '../../api/client';
import { BrandMark } from '../../components/BrandMark';
import { ProjectPreview } from '../../components/ProjectPreview';
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
          setErrorMessage(error instanceof ApiError ? error.message : 'ไม่สามารถโหลดหมวดหมู่ได้');
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
          setErrorMessage(error instanceof ApiError ? error.message : 'ไม่สามารถโหลดข้อมูลการตัดสินได้');
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
      setErrorMessage(error instanceof ApiError ? error.message : 'ไม่สามารถเปิดรายละเอียดผลงานได้');
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
        title: 'ส่งคะแนนสำเร็จแล้ว',
        content: 'คะแนนของคุณถูกบันทึกแล้ว คุณสามารถเปิดผลงานนี้อีกครั้งเพื่อแก้ไขได้ในภายหลัง',
      });
      messageApi.success('บันทึกคะแนนสำเร็จแล้ว');
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'ไม่สามารถส่งคะแนนได้');
    } finally {
      setDrawerSubmitting(false);
    }
  }

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const projectsScored = summaryRows.filter((item) => item.has_voted).length;

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <section className="judge-toolbar">
          <Select
            value={selectedCategoryId}
            onChange={(value) => {
              startTransition(() => setSelectedCategoryId(value));
            }}
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
            placeholder="เลือกหมวดหมู่"
            className="judge-category-select"
          />

          <div className="judge-toolbar__meta">
            <Typography.Text className="judge-toolbar__judge">{user?.display_name}</Typography.Text>
            <div className="summary-ribbon">
              <TrophyOutlined />
              ให้คะแนนแล้ว {projectsScored} / {summaryRows.length} ผลงาน
            </div>
          </div>
        </section>

        {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}

        {loading ? (
          <div className="full-height-spin" style={{ minHeight: 280 }}>
            <Spin size="large" />
          </div>
        ) : currentTab === 'projects' ? (
          projects.length > 0 ? (
            <div className="judge-workspace">
              <aside className="judge-brand-panel">
                <BrandMark className="judge-brand-panel__mark" />
                <Typography.Title level={3} className="judge-brand-panel__title">
                  {selectedCategory?.name ?? 'CE Awards'}
                </Typography.Title>
                <Typography.Paragraph className="judge-brand-panel__copy">
                  {selectedCategory?.description ||
                    'ตรวจสอบผลงานที่เข้าชิงแต่ละชิ้น เปิดดูรายละเอียดแบบเต็ม และส่งคะแนนตามเกณฑ์ที่กำหนดก่อนปิดรอบการลงคะแนน'}
                </Typography.Paragraph>
              </aside>

              <section className="judge-nominees">
                <div className="judge-nominees__heading">
                  <Typography.Title level={2} className="judge-nominees__title">
                    ผลงานที่เข้าชิงทั้งหมด {projects.length} ผลงาน
                  </Typography.Title>
                  <Segmented<WorkspaceTab>
                    value={currentTab}
                    options={[
                      { label: 'ให้คะแนนผลงาน', value: 'projects' },
                      { label: 'สรุปคะแนนของฉัน', value: 'summary' },
                    ]}
                    onChange={(value) => {
                      startTransition(() => {
                        navigate(value === 'summary' ? '/judge/summary' : '/judge/projects');
                      });
                    }}
                  />
                </div>

                <div className="judge-nominee-list">
                  {projects.map((project, index) => (
                    <article className="nominee-row" key={project.id}>
                      <div className={`nominee-row__index ${project.has_voted ? 'nominee-row__index--voted' : ''}`}>
                        {index + 1}
                      </div>

                      <ProjectPreview
                        src={project.image_url}
                        alt={project.title}
                        className="nominee-row__media"
                        placeholderClassName="project-card__placeholder nominee-row__media"
                      />

                      <div className="nominee-row__content">
                        <div className="nominee-row__section">
                          <Typography.Text className="nominee-row__label">ชื่อผลงาน</Typography.Text>
                          <Typography.Title level={4} className="nominee-row__title">
                            {project.title}
                          </Typography.Title>
                        </div>

                        <div className="nominee-row__section">
                          <Typography.Text className="nominee-row__label">ทีม / ผู้ออกแบบ</Typography.Text>
                          <Typography.Paragraph className="nominee-row__text">
                            {project.designer_name || project.team_name || selectedCategory?.name}
                          </Typography.Paragraph>
                        </div>

                        <div className="nominee-row__section nominee-row__section--summary">
                          <Typography.Text className="nominee-row__label">ภาพรวมผลงาน</Typography.Text>
                          <Typography.Paragraph className="nominee-row__text">
                            {project.short_description || 'ไม่มีคำอธิบายสั้น'}
                          </Typography.Paragraph>
                        </div>
                      </div>

                      <div className="nominee-row__actions">
                        {project.has_voted ? (
                          <Tag color="green" icon={<CheckCircleFilled />}>
                            ให้คะแนนแล้ว
                          </Tag>
                        ) : (
                          <Tag>ยังไม่ให้คะแนน</Tag>
                        )}
                        <Typography.Text className="nominee-row__score">
                          {project.current_score != null ? `คะแนน ${project.current_score}` : 'ยังไม่ได้ให้คะแนน'}
                        </Typography.Text>
                        <Button type="primary" icon={<EyeOutlined />} onClick={() => void openProject(project.id)}>
                          ดูรายละเอียด
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <Card className="soft-card">
              <Empty description="ยังไม่มีผลงานในหมวดหมู่นี้" />
            </Card>
          )
        ) : (
          <section className="judge-summary">
            <div className="judge-summary__heading">
              <Typography.Title level={2} className="judge-summary__title">
                สรุปคะแนนของคุณ
              </Typography.Title>
              <Segmented<WorkspaceTab>
                value={currentTab}
                options={[
                  { label: 'ให้คะแนนผลงาน', value: 'projects' },
                  { label: 'สรุปคะแนนของฉัน', value: 'summary' },
                ]}
                onChange={(value) => {
                  startTransition(() => {
                    navigate(value === 'summary' ? '/judge/summary' : '/judge/projects');
                  });
                }}
              />
            </div>

            <div className="judge-summary-list">
              {summaryRows.map((record) => (
                <article className="rank-row" key={record.project_id}>
                  <div className={`rank-row__index ${record.has_voted ? 'rank-row__index--active' : ''}`}>
                    {record.ranking}
                  </div>
                  <Typography.Text className="rank-row__name">{record.project_name}</Typography.Text>
                  <div className="rank-row__score-pill">{record.total_score}</div>
                  <Button icon={<FileDoneOutlined />} onClick={() => void openProject(record.project_id)}>
                    รายละเอียด
                  </Button>
                </article>
              ))}
            </div>
          </section>
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
