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
  InputNumber,
  Space,
  Spin,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';

import { useLanguage } from '../contexts/LanguageContext';
import type { JudgeProjectDetail, ScoringCriterion, Vote } from '../types/domain';
import { CriteriaInfoModal } from './CriteriaInfoModal';
import { ProjectPreview } from './ProjectPreview';

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
  const { t } = useLanguage();
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
        { label: t('projectVoteDrawer.proposalLink'), value: detail.project.proposal_link },
        { label: t('projectVoteDrawer.socialMediaLink'), value: detail.project.social_media_link },
        { label: t('projectVoteDrawer.driveLink'), value: detail.project.drive_link },
        { label: t('projectVoteDrawer.attachedFileLink'), value: detail.project.attached_file_link },
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
        width={960}
        title={detail?.project.title ?? t('projectVoteDrawer.projectDetails')}
        destroyOnHidden
        className="vote-drawer"
      >
        {loading ? (
          <div className="full-height-spin" style={{ minHeight: 320 }}>
            <Spin size="large" />
          </div>
        ) : !detail ? (
          <Empty description={t('projectVoteDrawer.selectProject')} />
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <ProjectPreview
              src={detail.project.image_url}
              alt={detail.project.title}
              placeholderClassName="project-card__placeholder"
              style={{ width: '100%', borderRadius: 20, objectFit: 'cover', maxHeight: 320, height: 240 }}
            />

            <Descriptions column={1} bordered size="small" className="vote-drawer__details">
              <Descriptions.Item label={t('projectVoteDrawer.category')}>
                {detail.project.category_name}
              </Descriptions.Item>
              <Descriptions.Item label={t('projectVoteDrawer.designerTeam')}>
                {detail.project.designer_name || detail.project.team_name || t('common.notProvided')}
              </Descriptions.Item>
              <Descriptions.Item label={t('projectVoteDrawer.shortDescription')}>
                {detail.project.short_description || t('common.notProvided')}
              </Descriptions.Item>
              <Descriptions.Item label={t('projectVoteDrawer.fullDescription')}>
                {detail.project.full_description || t('common.notProvided')}
              </Descriptions.Item>
              <Descriptions.Item label={t('projectVoteDrawer.concept')}>
                {detail.project.concept || t('common.notProvided')}
              </Descriptions.Item>
              <Descriptions.Item label={t('projectVoteDrawer.extraDetails')}>
                {detail.project.extra_details || t('common.notProvided')}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Title level={5}>{t('projectVoteDrawer.projectResources')}</Typography.Title>
              {externalLinks.length > 0 ? (
                <div className="detail-link-list">
                  {externalLinks.map((item) => (
                    <a href={item.value} key={item.label} target="_blank" rel="noreferrer">
                      <LinkOutlined /> {item.label}
                    </a>
                  ))}
                </div>
              ) : (
                <Typography.Text type="secondary">{t('projectVoteDrawer.noExternalLinks')}</Typography.Text>
              )}
            </div>

            <Divider style={{ borderColor: '#cfd5dc' }} />

            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('projectVoteDrawer.submitYourVote')}
            </Typography.Title>

            <div className="drawer-score-total">
              <Typography.Text strong>{t('projectVoteDrawer.totalScore')}</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {totalScore}
              </Typography.Title>
            </div>

            <Form form={form} layout="vertical" onFinish={handleFinish}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {detail.criteria.map((criterion, index) => (
                  <div key={criterion.id} className="vote-criterion-card">
                    <Space
                      direction="vertical"
                      size={12}
                      style={{ width: '100%', justifyContent: 'space-between' }}
                    >
                      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Typography.Text className="vote-criterion-card__index">
                          {t('projectVoteDrawer.criterionLabel')} {index + 1}
                        </Typography.Text>
                        <div>
                          <Typography.Text strong>{criterion.name}</Typography.Text>
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
                            {t('projectVoteDrawer.maxScoreLabel')}: {criterion.max_score}
                          </Typography.Paragraph>
                        </div>

                        <Button
                          icon={<InfoCircleOutlined />}
                          onClick={() => setActiveCriterion(criterion)}
                        >
                          {t('projectVoteDrawer.rubric')}
                        </Button>
                      </Space>

                      <Form.Item
                        label={t('projectVoteDrawer.score')}
                        name={['scores', criterion.id]}
                        rules={[
                          { required: true, message: t('projectVoteDrawer.scoreRequired') },
                          {
                            validator: async (_, value) => {
                              if (typeof value !== 'number') {
                                throw new Error(t('projectVoteDrawer.scoreMustBeNumber'));
                              }
                              if (value < 0 || value > criterion.max_score) {
                                throw new Error(
                                  t('projectVoteDrawer.scoreOutOfRange', { max: criterion.max_score }),
                                );
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
                {t('projectVoteDrawer.sendVotingResults')}
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
