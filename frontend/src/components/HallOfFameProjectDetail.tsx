import { Typography } from 'antd';
import type { ReactNode } from 'react';

import { useLanguage } from '../contexts/LanguageContext';
import type { HallOfFameDetails, Project } from '../types/domain';
import { Linkify } from './Linkify';
import { ProjectPreview } from './ProjectPreview';

interface HallOfFameProjectDetailProps {
  project: Project;
  details: HallOfFameDetails;
  badge?: ReactNode;
  onImageClick?: () => void;
}

export function HallOfFameProjectDetail({ project, details, badge, onImageClick }: HallOfFameProjectDetailProps) {
  const { language } = useLanguage();
  const entityLabel = language === 'th' ? details.entity_label_th : details.entity_label_en || details.entity_label_th;
  const descriptionLabel =
    language === 'th' ? details.description_label_th : details.description_label_en || details.description_label_th;

  return (
    <section className="hof-detail">
      <div className="hof-detail__hero">
        <div className="hof-detail__media-wrap">
          {project.image_url && onImageClick ? (
            <button type="button" className="hof-detail__media-button" onClick={onImageClick}>
              <ProjectPreview
                src={project.image_url}
                alt={project.title}
                className="hof-detail__media"
                placeholderClassName="hof-detail__media hof-detail__media--placeholder"
              />
            </button>
          ) : (
            <ProjectPreview
              src={project.image_url}
              alt={project.title}
              className="hof-detail__media"
              placeholderClassName="hof-detail__media hof-detail__media--placeholder"
            />
          )}
          {badge}
        </div>

        <div className="hof-detail__content">
          <div className="hof-detail__block">
            <div className="hof-detail__label">{entityLabel}</div>
            <Typography.Title level={2} className="hof-detail__title">
              {project.title}
            </Typography.Title>
          </div>

          <div className="hof-detail__block">
            <div className="hof-detail__label">{descriptionLabel}</div>
            <div className="hof-detail__text">
              <Linkify text={details.description} />
            </div>
          </div>

          {details.sections.map((section, index) => (
            <div className="hof-detail__block" key={section.key || `${index}-${section.title_th}`}>
              <div className="hof-detail__section-title">
                {index + 1}. {language === 'th' ? section.title_th : section.title_en || section.title_th}
              </div>
              <div className="hof-detail__text">
                <Linkify text={section.content} />
              </div>
              {section.link ? (
                <div className="hof-detail__link-wrap">
                  <div className="hof-detail__link-label">{language === 'th' ? 'ลิงก์' : 'Link'}</div>
                  <div className="hof-detail__link">
                    <Linkify text={section.link} />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
