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
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { startTransition, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import * as judgeApi from '../../api/judge';
import { ApiError } from '../../api/client';
import { BrandMark } from '../../components/BrandMark';
import { JudgeStepper } from '../../components/JudgeStepper';
import { ProjectPreview } from '../../components/ProjectPreview';
import { ProjectVoteDrawer } from '../../components/ProjectVoteDrawer';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localize } from '../../locales/localize';
import type { Category, JudgeProjectCard, JudgeProjectDetail, JudgeSummaryRow, Vote } from '../../types/domain';

type WorkspaceTab = 'projects' | 'summary';

export function JudgeWorkspacePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { groupId, categoryId } = useParams<{ groupId: string; categoryId: string }>();
  const { token, user } = useAuth();
  const { t, language } = useLanguage();

  const currentTab: WorkspaceTab = location.pathname.endsWith('/summary') ? 'summary' : 'projects';
  const projectsBasePath = `/judge/groups/${groupId}/categories/${categoryId}`;
  const [category, setCategory] = useState<Category | null>(null);
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
    if (!token || !groupId || !categoryId) {
      return;
    }
    const activeToken: string = token;
    const activeGroupId: string = groupId;
    const activeCategoryId: string = categoryId;

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    async function loadWorkspaceData() {
      try {
        const [nextCategories, nextProjects, nextSummary] = await Promise.all([
          judgeApi.getJudgeCategories(activeToken, activeGroupId),
          judgeApi.getJudgeProjects(activeToken, activeCategoryId),
          judgeApi.getJudgeSummary(activeToken, activeCategoryId),
        ]);

        if (cancelled) {
          return;
        }

        const currentCategory = nextCategories.find((item) => item.id === activeCategoryId) ?? null;
        if (!currentCategory) {
          navigate('/judge', { replace: true });
          return;
        }

        setCategory(currentCategory);
        setProjects(nextProjects);
        setSummaryRows(nextSummary);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof ApiError ? error.message : t('judgeWorkspace.loadDataError'));
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
  }, [token, groupId, categoryId, navigate]);

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
      setErrorMessage(error instanceof ApiError ? error.message : t('judgeWorkspace.openProjectError'));
    } finally {
      setDrawerLoading(false);
    }
  }

  async function refreshWorkspace(projectId?: string) {
    if (!token || !categoryId) {
      return;
    }

    const [nextProjects, nextSummary] = await Promise.all([
      judgeApi.getJudgeProjects(token, categoryId),
      judgeApi.getJudgeSummary(token, categoryId),
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
        title: t('judgeWorkspace.submitSuccessTitle'),
        content: t('judgeWorkspace.submitSuccessContent'),
      });
      messageApi.success(t('judgeWorkspace.submitSuccessToast'));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('judgeWorkspace.submitError'));
    } finally {
      setDrawerSubmitting(false);
    }
  }

  const projectsScored = summaryRows.filter((item) => item.has_voted).length;

  const tabSwitcher = (
    <Segmented<WorkspaceTab>
      value={currentTab}
      options={[
        { label: t('judgeWorkspace.voteProjectsTab'), value: 'projects' },
        { label: t('judgeWorkspace.summaryTab'), value: 'summary' },
      ]}
      onChange={(value) => {
        startTransition(() => {
          navigate(value === 'summary' ? `${projectsBasePath}/summary` : `${projectsBasePath}/projects`);
        });
      }}
    />
  );

  return (
    <>
      {contextHolder}
      <JudgeStepper current={currentTab === 'summary' ? 4 : 3} groupId={groupId} categoryId={categoryId} />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <section className="judge-toolbar">
          <Button onClick={() => navigate(`/judge/groups/${groupId}`)}>
            {t('judgeWorkspace.backToCategories')}
          </Button>

          <div className="judge-toolbar__meta">
            <Typography.Text className="judge-toolbar__judge">{user?.display_name}</Typography.Text>
            <div className="summary-ribbon">
              <TrophyOutlined />
              {projectsScored} / {summaryRows.length} {t('judgeWorkspace.projectsScored')}
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
                  {category ? localize(language, category.name, category.name_th) : t('judgeWorkspace.brandFallbackTitle')}
                </Typography.Title>
                <Typography.Paragraph className="judge-brand-panel__copy">
                  {(category && localize(language, category.description, category.description_th)) ||
                    t('judgeWorkspace.brandFallbackCopy')}
                </Typography.Paragraph>
              </aside>

              <section className="judge-nominees">
                <div className="judge-nominees__heading">
                  <Typography.Title level={2} className="judge-nominees__title">
                    {projects.length} {t('judgeWorkspace.nominatedWorks')}
                  </Typography.Title>
                  {tabSwitcher}
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
                          <Typography.Text className="nominee-row__label">
                            {t('judgeWorkspace.projectTitleLabel')}
                          </Typography.Text>
                          <Typography.Title level={4} className="nominee-row__title">
                            {project.title}
                          </Typography.Title>
                        </div>

                        <div className="nominee-row__section">
                          <Typography.Text className="nominee-row__label">
                            {t('judgeWorkspace.teamDesignerLabel')}
                          </Typography.Text>
                          <Typography.Paragraph className="nominee-row__text">
                            {project.designer_name ||
                              project.team_name ||
                              (category ? localize(language, category.name, category.name_th) : '')}
                          </Typography.Paragraph>
                        </div>

                        <div className="nominee-row__section nominee-row__section--summary">
                          <Typography.Text className="nominee-row__label">
                            {t('judgeWorkspace.overviewLabel')}
                          </Typography.Text>
                          <Typography.Paragraph className="nominee-row__text">
                            {project.short_description || t('judgeWorkspace.noShortDescription')}
                          </Typography.Paragraph>
                        </div>
                      </div>

                      <div className="nominee-row__actions">
                        {project.has_voted ? (
                          <Tag color="green" icon={<CheckCircleFilled />}>
                            {t('judgeWorkspace.voted')}
                          </Tag>
                        ) : (
                          <Tag>{t('judgeWorkspace.pending')}</Tag>
                        )}
                        <Typography.Text className="nominee-row__score">
                          {project.current_score != null
                            ? `${t('judgeWorkspace.scorePrefix')} ${project.current_score}`
                            : t('judgeWorkspace.notScoredYet')}
                        </Typography.Text>
                        <Button type="primary" icon={<EyeOutlined />} onClick={() => void openProject(project.id)}>
                          {t('judgeWorkspace.moreDetails')}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <Card className="soft-card">
              <Empty description={t('judgeWorkspace.noProjects')} />
            </Card>
          )
        ) : (
          <section className="judge-summary">
            <div className="judge-summary__heading">
              <Typography.Title level={2} className="judge-summary__title">
                {t('judgeWorkspace.yourSummary')}
              </Typography.Title>
              {tabSwitcher}
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
                    {t('judgeWorkspace.detail')}
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
