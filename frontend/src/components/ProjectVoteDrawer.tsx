import {
  FileSearchOutlined,
  InfoCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import {
  Button,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Image,
  InputNumber,
  Space,
  Spin,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';

import type { JudgeProjectDetail, ScoringCriterion, Vote } from '../types/domain';
import { CriteriaInfoModal } from './CriteriaInfoModal';

interface ProjectVoteDrawerProps {
  open: boolean;
  loading: boolean;
  detail: JudgeProjectDetail | null;
  vote: Vote | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (projectId: string, scores: Array<{ criterion_id: string; score: number }>) => Promise<void>;
}

export function ProjectVoteDrawer({
  open,
  loading,
  detail,
  vote,
  submitting,
  onClose,
  onSubmit,
}: ProjectVoteDrawerProps) {
  const [form] = Form.useForm<{ scores: Record<string, number> }>();
  const [activeCriterion, setActiveCriterion] = useState<ScoringCriterion | null>(null);
  const scoreValues = Form.useWatch('scores', form);

  useEffect(() => {
    if (open && detail) {
      const existingScores = Object.fromEntries(
        (vote?.scores ?? []).map((score) => [score.criterion_id, score.score]),
      );

      const nextScores = Object.fromEntries(
        detail.criteria.map((criterion) => [criterion.id, existingScores[criterion.id]]),
      );

      form.setFieldsValue({ scores: nextScores });
    } else {
      form.resetFields();
    }
  }, [detail, form, open, vote]);

  const totalScore =
    detail?.criteria.reduce((sum, criterion) => {
      const currentValue = scoreValues?.[criterion.id];
      return sum + (typeof currentValue === 'number' ? currentValue : 0);
    }, 0) ?? 0;

  async function handleFinish(values: { scores: Record<string, number> }) {
    if (!detail) {
      return;
    }

    await onSubmit(
      detail.project.id,
      detail.criteria.map((criterion) => ({
        criterion_id: criterion.id,
        score: Number(values.scores[criterion.id]),
      })),
    );
  }

  const externalLinks = detail
    ? [
        { label: 'Proposal link', value: detail.project.proposal_link },
        { label: 'Social media link', value: detail.project.social_media_link },
        { label: 'Google Drive / more info', value: detail.project.drive_link },
        { label: 'Attached file link', value: detail.project.attached_file_link },
      ].filter((item) => item.value)
    : [];

  return (
    <>
      <Drawer
        open={open}
        onClose={() => {
          setActiveCriterion(null);
          onClose();
        }}
        width={720}
        title={detail?.project.title ?? 'Project details'}
        destroyOnHidden
      >
        {loading ? (
          <div className="full-height-spin" style={{ minHeight: 320 }}>
            <Spin size="large" />
          </div>
        ) : !detail ? (
          <Empty description="Select a project to view details." />
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {detail.project.image_url ? (
              <Image
                src={detail.project.image_url}
                alt={detail.project.title}
                style={{ width: '100%', borderRadius: 20, objectFit: 'cover', maxHeight: 320 }}
              />
            ) : (
              <div className="project-card__placeholder" style={{ borderRadius: 20, height: 240 }}>
                Project preview
              </div>
            )}

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Category">{detail.project.category_name}</Descriptions.Item>
              <Descriptions.Item label="Designer / Team">
                {detail.project.designer_name || detail.project.team_name || 'Not provided'}
              </Descriptions.Item>
              <Descriptions.Item label="Short description">
                {detail.project.short_description || 'Not provided'}
              </Descriptions.Item>
              <Descriptions.Item label="Full description">
                {detail.project.full_description || 'Not provided'}
              </Descriptions.Item>
              <Descriptions.Item label="Concept">
                {detail.project.concept || 'Not provided'}
              </Descriptions.Item>
              <Descriptions.Item label="Extra details">
                {detail.project.extra_details || 'Not provided'}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Title level={5}>Project Resources</Typography.Title>
              {externalLinks.length > 0 ? (
                <div className="detail-link-list">
                  {externalLinks.map((item) => (
                    <a href={item.value} key={item.label} target="_blank" rel="noreferrer">
                      <LinkOutlined /> {item.label}
                    </a>
                  ))}
                </div>
              ) : (
                <Typography.Text type="secondary">No external links added for this project.</Typography.Text>
              )}
            </div>

            <Divider />

            <Typography.Title level={4} style={{ margin: 0 }}>
              Submit Your Vote
            </Typography.Title>

            <div className="drawer-score-total">
              <Typography.Text strong>Total score</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {totalScore}
              </Typography.Title>
            </div>

            <Form form={form} layout="vertical" onFinish={handleFinish}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {detail.criteria.map((criterion) => (
                  <div key={criterion.id} className="soft-card" style={{ padding: 18 }}>
                    <Space
                      direction="vertical"
                      size={12}
                      style={{ width: '100%', justifyContent: 'space-between' }}
                    >
                      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                        <div>
                          <Typography.Text strong>{criterion.name}</Typography.Text>
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
                            Maximum score: {criterion.max_score}
                          </Typography.Paragraph>
                        </div>

                        <Button
                          icon={<InfoCircleOutlined />}
                          onClick={() => setActiveCriterion(criterion)}
                        >
                          Rubric
                        </Button>
                      </Space>

                      <Form.Item
                        label="Score"
                        name={['scores', criterion.id]}
                        rules={[
                          { required: true, message: 'A score is required.' },
                          {
                            validator: async (_, value) => {
                              if (typeof value !== 'number') {
                                throw new Error('Score must be a number.');
                              }
                              if (value < 0 || value > criterion.max_score) {
                                throw new Error(`Score must be between 0 and ${criterion.max_score}.`);
                              }
                            },
                          },
                        ]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber min={0} max={criterion.max_score} style={{ width: '100%' }} />
                      </Form.Item>
                    </Space>
                  </div>
                ))}
              </Space>

              <Button
                type="primary"
                htmlType="submit"
                size="large"
                icon={<FileSearchOutlined />}
                loading={submitting}
                style={{ marginTop: 20, width: '100%' }}
              >
                Send Voting Results
              </Button>
            </Form>
          </Space>
        )}
      </Drawer>

      <CriteriaInfoModal
        criterion={activeCriterion}
        open={Boolean(activeCriterion)}
        onClose={() => setActiveCriterion(null)}
      />
    </>
  );
}
