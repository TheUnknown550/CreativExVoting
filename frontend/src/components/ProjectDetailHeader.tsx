import type { ReactNode } from 'react';
import { Typography } from 'antd';

import { useLanguage } from '../contexts/LanguageContext';
import type { Project } from '../types/domain';
import { Linkify } from './Linkify';
import { ProjectPreview } from './ProjectPreview';

interface ProjectDetailHeaderProps {
  project: Project;
  /** Optional badge rendered over the image, e.g. judge's position indicator. */
  badge?: ReactNode;
  onImageClick?: () => void;
}

// Shared hero (image + title + owner/designer/social/creative-area/objective)
// and info-block (design process/impact/drive link) layout used by both the
// judge-facing project detail page and the admin preview-as-judge page, so
// the two stay in sync instead of being hand-edited in lockstep.
export function ProjectDetailHeader({ project, badge, onImageClick }: ProjectDetailHeaderProps) {
  const { t } = useLanguage();

  const heroFields: Array<{ label: string; value?: string }> = [
    { label: t('judgeProjectDetail.owner'), value: project.team_name },
    { label: t('judgeProjectDetail.designer'), value: project.designer_name },
    { label: t('judgeProjectDetail.imageLink'), value: project.image_source_url },
    { label: t('judgeProjectDetail.socialMedia'), value: project.social_media_link },
    { label: t('judgeProjectDetail.creativeArea'), value: project.extra_details },
    { label: t('judgeProjectDetail.objective'), value: project.short_description },
  ];
  const infoBlocks: Array<{ label: string; value?: string }> = [
    { label: t('judgeProjectDetail.designProcess'), value: project.full_description },
    { label: t('judgeProjectDetail.impact'), value: project.concept },
    { label: t('judgeProjectDetail.moreInfo'), value: project.drive_link },
  ];

  return (
    <>
      <header className="pd__hero">
        <div className="pd__media-wrap">
          {project.image_url && onImageClick ? (
            <button
              type="button"
              className="pd__media-button"
              onClick={onImageClick}
              aria-label={t('judgeProjectDetail.projectTitle')}
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
          {badge}
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
                    <Linkify text={field.value} />
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
              <p className="pd__info-text">
                <Linkify text={block.value} />
              </p>
            ) : (
              <p className="pd__info-text pd__field-empty">{t('common.notProvided')}</p>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
