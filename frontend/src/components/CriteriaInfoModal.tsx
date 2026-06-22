import { Modal, Typography } from 'antd';

import { useLanguage } from '../contexts/LanguageContext';
import type { ScoringCriterion } from '../types/domain';

interface CriteriaInfoModalProps {
  criterion: ScoringCriterion | null;
  open: boolean;
  onClose: () => void;
}

export function CriteriaInfoModal({ criterion, open, onClose }: CriteriaInfoModalProps) {
  const { t } = useLanguage();

  return (
    <Modal
      open={open}
      title={criterion?.name ?? t('criteriaInfoModal.title')}
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
            {criterion.description || t('criteriaInfoModal.noRubric')}
          </Typography.Paragraph>
        </>
      ) : null}
    </Modal>
  );
}
