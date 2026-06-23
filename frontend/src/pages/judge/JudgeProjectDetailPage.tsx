import { ArrowRightOutlined, LinkOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Form,
  InputNumber,
  Modal,
  Spin,
  Table,
  Typography,
  message,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import * as judgeApi from '../../api/judge';
import { ApiError } from '../../api/client';
import { JudgeStepper } from '../../components/JudgeStepper';
import { ProjectPreview } from '../../components/ProjectPreview';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type {
  JudgeProjectCard,
  JudgeProjectDetail,
  ScoringCriterion,
  Vote,
} from '../../types/domain';

export function JudgeProjectDetailPage() {
  const navigate = useNavigate();
  const { groupId, categoryId, projectId } = useParams<{
    groupId: string;
    categoryId: string;
    projectId: string;
  }>();
  const { token } = useAuth();
  const { t } = useLanguage();
  const [form] = Form.useForm<{ scores: Record<string, number> }>();

  const [detail, setDetail] = useState<JudgeProjectDetail | null>(null);
  const [vote, setVote] = useState<Vote | null>(null);
  const [siblings, setSiblings] = useState<JudgeProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const basePath = `/judge/groups/${groupId}/categories/${categoryId}`;

  useEffect(() => {
    if (!token || !categoryId || !projectId) {
      return;
    }
    const activeToken: string = token;
    const activeCategoryId: string = categoryId;
    const activeProjectId: string = projectId;

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    async function loadData() {
      try {
        const [nextDetail, nextVote, nextSiblings] = await Promise.all([
          judgeApi.getJudgeProjectDetail(activeToken, activeProjectId),
          judgeApi.getMyVote(activeToken, activeProjectId),
          judgeApi.getJudgeProjects(activeToken, activeCategoryId),
        ]);

        if (cancelled) {
          return;
        }

        setDetail(nextDetail);
        setVote(nextVote);
        setSiblings(nextSiblings);

        const existingScores = Object.fromEntries(
          (nextVote?.scores ?? []).map((score) => [score.criterion_id, score.score]),
        );
        form.setFieldsValue({
          scores: Object.fromEntries(
            nextDetail.criteria.map((criterion) => [criterion.id, existingScores[criterion.id]]),
          ),
        });
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof ApiError ? error.message : t('judgeWorkspace.openProjectError'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [token, categoryId, projectId, form]);

  const currentIndex = siblings.findIndex((item) => item.id === projectId);
  const nextProject = currentIndex >= 0 ? siblings[currentIndex + 1] : undefined;
  const totalMax = useMemo(
    () => detail?.criteria.reduce((sum, criterion) => sum + criterion.max_score, 0) ?? 0,
    [detail],
  );

  function goNext() {
    if (nextProject) {
      navigate(`${basePath}/projects/${nextProject.id}`);
    } else {
      navigate(`${basePath}/summary`);
    }
  }

  async function handleFinish(values: { scores: Record<string, number> }) {
    if (!token || !detail || !projectId) {
      return;
    }

    setSubmitting(true);
    try {
      const scores = detail.criteria.map((criterion) => ({
        criterion_id: criterion.id,
        score: Number(values.scores[criterion.id]),
      }));
      const apiCall = vote ? judgeApi.updateVote : judgeApi.submitVote;
      const saved = await apiCall(token, projectId, { scores });
      setVote(saved);
      Modal.success({
        title: t('judgeWorkspace.submitSuccessTitle'),
        content: t('judgeWorkspace.submitSuccessContent'),
      });
      messageApi.success(t('judgeWorkspace.submitSuccessToast'));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('judgeWorkspace.submitError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <JudgeStepper current={3} groupId={groupId} categoryId={categoryId} />
        <div className="full-height-spin" style={{ minHeight: 320 }}>
          <Spin size="large" />
        </div>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <JudgeStepper current={3} groupId={groupId} categoryId={categoryId} />
        <Alert type="error" showIcon message={errorMessage ?? t('judgeWorkspace.openProjectError')} />
      </>
    );
  }

  const project = detail.project;
  const fields: Array<{ label: string; value?: string; link?: boolean }> = [
    { label: t('judgeProjectDetail.owner'), value: project.team_name },
    { label: t('judgeProjectDetail.designer'), value: project.designer_name },
    { label: t('judgeProjectDetail.socialMedia'), value: project.social_media_link, link: true },
    { label: t('judgeProjectDetail.creativeArea'), value: project.extra_details },
    { label: t('judgeProjectDetail.objective'), value: project.short_description },
  ];
  const longSections: Array<{ label: string; value?: string }> = [
    { label: t('judgeProjectDetail.designProcess'), value: project.full_description },
    { label: t('judgeProjectDetail.impact'), value: project.concept },
  ];

  return (
    <>
      {contextHolder}
      <JudgeStepper current={3} groupId={groupId} categoryId={categoryId} />

      {errorMessage ? <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} /> : null}

      <div className="project-detail">
        <div className="project-detail__head">
          <div className="project-detail__media-wrap">
            {currentIndex >= 0 ? <div className="project-detail__index">{currentIndex + 1}</div> : null}
            <ProjectPreview
              src={project.image_url}
              alt={project.title}
              className="project-detail__media"
              placeholderClassName="project-card__placeholder project-detail__media"
            />
          </div>

          <div className="project-detail__fields">
            <div className="project-detail__field">
              <span className="project-detail__label">{t('judgeProjectDetail.projectTitle')}</span>
              <Typography.Title level={4} className="project-detail__title">
                {project.title}
              </Typography.Title>
            </div>

            {fields.map((field) => (
              <div className="project-detail__field" key={field.label}>
                <span className="project-detail__label">{field.label}</span>
                {field.value ? (
                  field.link ? (
                    <a href={field.value} target="_blank" rel="noreferrer" className="project-detail__value">
                      <LinkOutlined /> {field.value}
                    </a>
                  ) : (
                    <Typography.Paragraph className="project-detail__value">{field.value}</Typography.Paragraph>
                  )
                ) : (
                  <Typography.Text type="secondary">{t('common.notProvided')}</Typography.Text>
                )}
              </div>
            ))}
          </div>
        </div>

        {longSections.map((section) => (
          <div className="project-detail__field project-detail__field--block" key={section.label}>
            <span className="project-detail__label">{section.label}</span>
            <Typography.Paragraph className="project-detail__value">
              {section.value || t('common.notProvided')}
            </Typography.Paragraph>
          </div>
        ))}

        {project.drive_link ? (
          <div className="project-detail__field project-detail__field--block">
            <span className="project-detail__label">{t('judgeProjectDetail.moreInfo')}</span>
            <a href={project.drive_link} target="_blank" rel="noreferrer" className="project-detail__value">
              <LinkOutlined /> {project.drive_link}
            </a>
          </div>
        ) : null}

        <Typography.Title level={3} className="project-detail__scoring-title">
          {t('judgeProjectDetail.scoringTitle')}
        </Typography.Title>

        <Form form={form} onFinish={handleFinish} className="project-detail__form">
          <Table<ScoringCriterion>
            rowKey="id"
            dataSource={detail.criteria}
            pagination={false}
            className="project-detail__table"
            columns={[
              {
                title: t('judgeProjectDetail.colOrder'),
                width: 70,
                align: 'center',
                render: (_, __, index) => index + 1,
              },
              {
                title: t('judgeProjectDetail.colCriterion', { total: totalMax }),
                render: (_, criterion) => (
                  <>
                    <Typography.Text strong>{criterion.name}</Typography.Text>{' '}
                    <Typography.Text type="secondary">
                      {t('judgeProjectDetail.maxScoreSuffix', { max: criterion.max_score })}
                    </Typography.Text>
                  </>
                ),
              },
              {
                title: t('judgeProjectDetail.colRubric'),
                dataIndex: 'description',
                render: (value: string) =>
                  value || <Typography.Text type="secondary">{t('common.noDescription')}</Typography.Text>,
              },
              {
                title: t('judgeProjectDetail.colScore'),
                width: 130,
                align: 'center',
                render: (_, criterion) => (
                  <Form.Item
                    name={['scores', criterion.id]}
                    noStyle
                    rules={[
                      { required: true, message: t('projectVoteDrawer.scoreRequired') },
                      {
                        validator: async (_rule, value) => {
                          if (typeof value !== 'number') {
                            throw new Error(t('projectVoteDrawer.scoreMustBeNumber'));
                          }
                          if (value < 0 || value > criterion.max_score) {
                            throw new Error(t('projectVoteDrawer.scoreOutOfRange', { max: criterion.max_score }));
                          }
                        },
                      },
                    ]}
                  >
                    <InputNumber min={0} max={criterion.max_score} style={{ width: 90 }} />
                  </Form.Item>
                ),
              },
            ]}
          />

          <div className="project-detail__footer">
            <Button onClick={() => navigate(`${basePath}/projects`)}>
              {t('judgeProjectDetail.backToList')}
            </Button>
            <Button type="primary" size="large" htmlType="submit" loading={submitting} className="project-detail__submit">
              {t('judgeProjectDetail.submit')}
            </Button>
            <Button size="large" onClick={goNext}>
              {nextProject ? t('judgeProjectDetail.nextCandidate') : t('judgeProjectDetail.finishToSummary')}{' '}
              <ArrowRightOutlined />
            </Button>
          </div>
        </Form>
      </div>
    </>
  );
}
