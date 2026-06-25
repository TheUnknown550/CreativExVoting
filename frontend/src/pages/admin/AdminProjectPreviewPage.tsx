import { ArrowLeftOutlined, LinkOutlined } from '@ant-design/icons';
import { Alert, Button, InputNumber, Modal, Spin, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import * as adminApi from '../../api/admin';
import { ApiError, resolveAssetUrl } from '../../api/client';
import { ProjectPreview } from '../../components/ProjectPreview';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localize } from '../../locales/localize';
import type { Project, ScoringCriterion } from '../../types/domain';

interface RubricLine {
  range: string;
  text: string;
}

function parseRubric(description: string) {
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

export function AdminProjectPreviewPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { token } = useAuth();
  const { t, language } = useLanguage();

  const [project, setProject] = useState<Project | null>(null);
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  useEffect(() => {
    if (!token || !projectId) {
      return;
    }

    const activeToken: string = token;
    const activeProjectId: string = projectId;
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    async function loadData() {
      try {
        const projects = await adminApi.getAdminProjects(activeToken);
        if (cancelled) {
          return;
        }

        const currentProject = projects.find((item) => item.id === activeProjectId) ?? null;
        if (!currentProject) {
          setProject(null);
          setCriteria([]);
          setErrorMessage(t('adminProjects.projectNotFound'));
          return;
        }

        const nextCriteria = await adminApi.getAdminCriteria(activeToken, currentProject.category_id);
        if (cancelled) {
          return;
        }

        setProject(currentProject);
        setCriteria(nextCriteria);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof ApiError ? error.message : t('adminProjects.loadPreviewError'));
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
  }, [projectId, token]);

  const totalMax = useMemo(
    () => criteria.reduce((sum, criterion) => sum + criterion.max_score, 0),
    [criteria],
  );

  if (loading) {
    return (
      <div className="full-height-spin" style={{ minHeight: 320 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!project) {
    return <Alert type="error" showIcon message={errorMessage ?? t('adminProjects.projectNotFound')} />;
  }

  const heroFields: Array<{ label: string; value?: string; link?: boolean }> = [
    { label: t('judgeProjectDetail.owner'), value: project.team_name },
    { label: t('judgeProjectDetail.designer'), value: project.designer_name },
    { label: t('judgeProjectDetail.socialMedia'), value: project.social_media_link, link: true },
    { label: t('judgeProjectDetail.creativeArea'), value: project.extra_details },
    { label: t('judgeProjectDetail.objective'), value: project.short_description },
  ];

  const infoBlocks: Array<{ label: string; value?: string; link?: boolean }> = [
    { label: t('judgeProjectDetail.designProcess'), value: project.full_description },
    { label: t('judgeProjectDetail.impact'), value: project.concept },
    { label: t('judgeProjectDetail.moreInfo'), value: project.drive_link, link: true },
  ];

  return (
    <>
      <div className="pd admin-preview-page">
        <div className="pd__topbar">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/projects')}>
            {t('adminProjects.previewBack')}
          </Button>
        </div>

        <div className="admin-preview-note">
          {t('adminProjects.previewNote')}
        </div>

        {errorMessage ? <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} /> : null}

        <header className="pd__hero">
          <div className="pd__media-wrap">
            {project.image_url ? (
              <button
                type="button"
                className="pd__media-button"
                onClick={() => setImagePreviewOpen(true)}
                aria-label={project.title}
              >
                <ProjectPreview
                  src={project.image_url}
                  alt={project.title}
                  className="pd__media"
                  placeholderClassName="pd__media pd__media--placeholder"
                />
              </button>
            ) : (
              <ProjectPreview
                src={project.image_url}
                alt={project.title}
                className="pd__media"
                placeholderClassName="pd__media pd__media--placeholder"
              />
            )}
          </div>

          <div className="pd__hero-info">
            <span className="pd__eyebrow">{t('judgeProjectDetail.projectTitle')}</span>
            <Typography.Title level={2} className="pd__title">
              {project.title}
            </Typography.Title>

            <dl className="pd__fields">
              {heroFields.map((field) => (
                <div className="pd__field" key={field.label}>
                  <dt className="pd__field-label">{field.label}</dt>
                  <dd className="pd__field-value">
                    {field.value ? (
                      field.link ? (
                        <a href={field.value} target="_blank" rel="noreferrer" className="pd__field-link">
                          <LinkOutlined /> {field.value}
                        </a>
                      ) : (
                        field.value
                      )
                    ) : (
                      <span className="pd__field-empty">{t('common.notProvided')}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        <section className="pd__info">
          {infoBlocks.map((block) => (
            <div className="pd__info-block" key={block.label}>
              <h3 className="pd__info-label">{block.label}</h3>
              {block.value ? (
                block.link ? (
                  <a href={block.value} target="_blank" rel="noreferrer" className="pd__field-link">
                    <LinkOutlined /> {block.value}
                  </a>
                ) : (
                  <p className="pd__info-text">{block.value}</p>
                )
              ) : (
                <p className="pd__info-text pd__field-empty">{t('common.notProvided')}</p>
              )}
            </div>
          ))}
        </section>

        <section className="pd__form">
          <div className="pd__scoring-head">
            <Typography.Title level={3} className="pd__scoring-title">
              {t('judgeProjectDetail.scoringTitle')}
            </Typography.Title>
            <div className="pd__total">
              <span className="pd__total-label">{t('projectVoteDrawer.totalScore')}</span>
              <span className="pd__total-value">
                0 <span className="pd__total-max">/ {totalMax}</span>
              </span>
            </div>
          </div>

          <div className="pd__criteria">
            {criteria.map((criterion, index) => {
              const { intro, bands } = parseRubric(
                localize(language, criterion.description, criterion.description_th),
              );

              return (
                <div className="score-card" key={criterion.id}>
                  <div className="score-card__num">{index + 1}</div>

                  <div className="score-card__main">
                    <div className="score-card__head">
                      <h4 className="score-card__name">{localize(language, criterion.name, criterion.name_th)}</h4>
                      <span className="score-card__max">
                        {t('judgeProjectDetail.maxScoreSuffix', { max: criterion.max_score })}
                      </span>
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
                      <InputNumber
                        size="large"
                        min={0}
                        max={criterion.max_score}
                        controls={false}
                        className="score-card__input"
                        placeholder="0"
                        disabled
                      />
                      <span className="score-pill__max">/ {criterion.max_score}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
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
