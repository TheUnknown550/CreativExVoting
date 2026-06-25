import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Alert, Button, Form, InputNumber, Modal, Segmented, Spin, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import * as judgeApi from '../../api/judge';
import { ApiError, resolveAssetUrl } from '../../api/client';
import { JudgeStepper } from '../../components/JudgeStepper';
import { ProjectDetailHeader } from '../../components/ProjectDetailHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localize } from '../../locales/localize';
import type { JudgeProjectCard, JudgeProjectDetail, Vote } from '../../types/domain';

interface RubricLine {
  range: string;
  text: string;
}

// Splits a stored rubric description into an optional intro plus the scoring
// bands (e.g. "20-25 = ...") so we can render them as readable rows.
function parseRubric(description: string): { intro: string[]; bands: RubricLine[] } {
  const intro: string[] = [];
  const bands: RubricLine[] = [];
  for (const raw of (description ?? '').split(/\n+/)) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    const match = line.match(/^(\d+\s*[-–]\s*\d+)\s*=\s*([\s\S]*)$/);
    if (match) {
      bands.push({ range: match[1].replace(/\s+/g, ''), text: match[2].trim() });
    } else {
      intro.push(line);
    }
  }
  return { intro, bands };
}

export function JudgeProjectDetailPage() {
  const navigate = useNavigate();
  const { groupId, categoryId, projectId } = useParams<{
    groupId: string;
    categoryId: string;
    projectId: string;
  }>();
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const [form] = Form.useForm<{ scores: Record<string, number> }>();
  const scoreValues = Form.useWatch('scores', form);

  const [detail, setDetail] = useState<JudgeProjectDetail | null>(null);
  const [vote, setVote] = useState<Vote | null>(null);
  const [siblings, setSiblings] = useState<JudgeProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
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
  const prevProject = currentIndex > 0 ? siblings[currentIndex - 1] : undefined;
  const nextProject = currentIndex >= 0 ? siblings[currentIndex + 1] : undefined;
  const totalMax = useMemo(
    () => detail?.criteria.reduce((sum, criterion) => sum + criterion.max_score, 0) ?? 0,
    [detail],
  );
  const currentTotal = detail
    ? detail.criteria.reduce((sum, criterion) => {
        const value = scoreValues?.[criterion.id];
        return sum + (typeof value === 'number' ? value : 0);
      }, 0)
    : 0;

  function goNext() {
    navigate(nextProject ? `${basePath}/projects/${nextProject.id}` : `${basePath}/summary`);
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

  return (
    <>
      {contextHolder}
      <JudgeStepper current={3} groupId={groupId} categoryId={categoryId} />

      {errorMessage ? <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} /> : null}

      <div className="pd">
        <div className="pd__topbar">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            {t('judgeProjectDetail.back')}
          </Button>
          <Segmented<string>
            value=""
            options={[
              { label: t('judgeWorkspace.voteProjectsTab'), value: 'projects' },
              { label: t('judgeWorkspace.summaryTab'), value: 'summary' },
            ]}
            onChange={(value) =>
              navigate(value === 'summary' ? `${basePath}/summary` : `${basePath}/projects`)
            }
          />
        </div>

        <ProjectDetailHeader
          project={project}
          onImageClick={() => setImagePreviewOpen(true)}
          badge={
            currentIndex >= 0 ? (
              <span className="pd__badge">
                {t('judgeProjectDetail.position', { current: currentIndex + 1, total: siblings.length })}
              </span>
            ) : null
          }
        />

        <Form form={form} onFinish={handleFinish} className="pd__form">
          <div className="pd__scoring-head">
            <Typography.Title level={3} className="pd__scoring-title">
              {t('judgeProjectDetail.scoringTitle')}
            </Typography.Title>
            <div className="pd__total">
              <span className="pd__total-label">{t('projectVoteDrawer.totalScore')}</span>
              <span className="pd__total-value">
                {currentTotal} <span className="pd__total-max">/ {totalMax}</span>
              </span>
            </div>
          </div>

          <div className="pd__criteria">
            {detail.criteria.map((criterion, index) => {
              const { intro, bands } = parseRubric(
                localize(language, criterion.description, criterion.description_th),
              );
              return (
                <div className="score-card" key={criterion.id}>
                  <div className="score-card__num">{index + 1}</div>

                  <div className="score-card__main">
                    <div className="score-card__head">
                      <h4 className="score-card__name">{localize(language, criterion.name, criterion.name_th)}</h4>
                      <span className="score-card__max">{t('judgeProjectDetail.maxScoreSuffix', { max: criterion.max_score })}</span>
                    </div>

                    {intro.map((line) => (
                      <p className="score-card__intro" key={line}>
                        {line}
                      </p>
                    ))}

                    {bands.length > 0 ? (
                      <ul className="rubric">
                        {bands.map((band) => (
                          <li className="rubric__row" key={band.range}>
                            <span className="rubric__range">{band.range}</span>
                            <span className="rubric__text">{band.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="score-card__score">
                    <div className="score-pill">
                      <Form.Item
                        name={['scores', criterion.id]}
                        className="score-card__field"
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
                        <InputNumber
                          size="large"
                          min={0}
                          max={criterion.max_score}
                          controls={false}
                          className="score-card__input"
                          placeholder="0"
                        />
                      </Form.Item>
                      <span className="score-pill__max">/ {criterion.max_score}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pd__actionbar">
            <div className="pd__actionbar-side">
              {prevProject ? (
                <Button onClick={() => navigate(`${basePath}/projects/${prevProject.id}`)} icon={<ArrowLeftOutlined />}>
                  {t('judgeProjectDetail.previousCandidate')}
                </Button>
              ) : (
                <Button onClick={() => navigate(`${basePath}/projects`)}>{t('judgeProjectDetail.backToList')}</Button>
              )}
            </div>

            <Button type="primary" size="large" htmlType="submit" loading={submitting} className="pd__submit">
              {t('judgeProjectDetail.submit')} · {currentTotal}/{totalMax}
            </Button>

            <div className="pd__actionbar-side pd__actionbar-side--end">
              <Button size="large" onClick={goNext}>
                {nextProject ? t('judgeProjectDetail.nextCandidate') : t('judgeProjectDetail.finishToSummary')}{' '}
                <ArrowRightOutlined />
              </Button>
            </div>
          </div>
        </Form>
      </div>

      <Modal
        open={imagePreviewOpen}
        footer={null}
        onCancel={() => setImagePreviewOpen(false)}
        centered
        width="min(96vw, 1200px)"
        className="pd__image-modal"
      >
        <img
          src={resolveAssetUrl(project.image_url)}
          alt={project.title}
          className="pd__image-modal-content"
        />
      </Modal>
    </>
  );
}
