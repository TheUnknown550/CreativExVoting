import { Modal, Typography } from 'antd';

import type { ScoringCriterion } from '../types/domain';

interface CriteriaInfoModalProps {
  criterion: ScoringCriterion | null;
  open: boolean;
  onClose: () => void;
}

export function CriteriaInfoModal({ criterion, open, onClose }: CriteriaInfoModalProps) {
  return (
    <Modal
      open={open}
      title={criterion?.name ?? 'เกณฑ์การให้คะแนน'}
      footer={null}
      onCancel={onClose}
      className="criteria-modal"
    >
      {criterion ? (
        <>
          <Typography.Paragraph>
            <strong>คะแนนเต็ม:</strong> {criterion.max_score}
          </Typography.Paragraph>
          <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
            {criterion.description || 'ยังไม่มีคำอธิบายเกณฑ์การให้คะแนน'}
          </Typography.Paragraph>
        </>
      ) : null}
    </Modal>
  );
}
