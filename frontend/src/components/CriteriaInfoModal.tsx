import { Modal, Typography } from 'antd';

import { useLanguage } from '../contexts/LanguageContext';
import { localize } from '../locales/localize';
import type { ScoringCriterion } from '../types/domain';

interface CriteriaInfoModalProps {
  criterion: ScoringCriterion | null;
  open: boolean;
  onClose: () => void;
}

export function CriteriaInfoModal({ criterion, open, onClose }: CriteriaInfoModalProps) {
  const { t, language } = useLanguage();
  const name = criterion ? localize(language, criterion.name, criterion.name_th) : '';
  const description = criterion ? localize(language, criterion.description, criterion.description_th) : '';

  return (
    <Modal
      open={open}
      title={name || t('criteriaInfoModal.title')}
      footer={null}
      onCancel={onClose}
      className="criteria-modal"
    >
      {criterion ? (
        <>
          <Typography.Paragraph>
            <strong>{t('criteriaInfoModal.maxScore')}</strong> {criterion.max_score}
          </Typography.Paragraph>
          <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
            {description || t('criteriaInfoModal.noRubric')}
          </Typography.Paragraph>
        </>
      ) : null}
    </Modal>
  );
}
