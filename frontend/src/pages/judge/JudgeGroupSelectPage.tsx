import { LockOutlined, RightOutlined } from '@ant-design/icons';
import { Alert, Card, Empty, Spin, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import * as judgeApi from '../../api/judge';
import { ApiError } from '../../api/client';
import { BrandMark } from '../../components/BrandMark';
import { JudgeStepper } from '../../components/JudgeStepper';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { localize } from '../../locales/localize';
import type { JudgeAwardGroup } from '../../types/domain';

export function JudgeGroupSelectPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const [groups, setGroups] = useState<JudgeAwardGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    const activeToken: string = token;
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    async function loadGroups() {
      try {
        const nextGroups = await judgeApi.getJudgeGroups(activeToken);
        if (!cancelled) {
          setGroups(nextGroups);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof ApiError ? error.message : t('judgeGroups.loadError'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadGroups();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <>
      <JudgeStepper current={1} />

      {errorMessage ? <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} /> : null}

      {loading ? (
        <div className="full-height-spin" style={{ minHeight: 280 }}>
          <Spin size="large" />
        </div>
      ) : groups.length > 0 ? (
        <div className="judge-workspace">
          <aside className="judge-brand-panel">
            <BrandMark className="judge-brand-panel__mark" />
            <Typography.Title level={3} className="judge-brand-panel__title">
              {t('judgeGroups.heading')}
            </Typography.Title>
            <Typography.Paragraph className="judge-brand-panel__copy">
              {t('judgeGroups.intro')}
            </Typography.Paragraph>
          </aside>

          <section className="judge-nominees">
            <div className="judge-nominees__heading">
              <Typography.Title level={2} className="judge-nominees__title">
                {t('judgeGroups.heading')}
              </Typography.Title>
            </div>

            <div className="award-group-list">
              {groups.map((group) => {
                const locked = !group.assigned;
                return (
                  <button
                    type="button"
                    key={group.id}
                    className={`award-group-card${locked ? ' award-group-card--locked' : ''}`}
                    disabled={locked}
                    onClick={() => {
                      if (!locked) {
                        navigate(`/judge/groups/${group.id}`);
                      }
                    }}
                  >
                    <div className="award-group-card__index">{group.code || '•'}</div>
                    <div className="award-group-card__content">
                      <div className="award-group-card__titlerow">
                        <Typography.Title level={4} className="award-group-card__title">
                          {localize(language, group.name, group.name_th)}
                        </Typography.Title>
                        {locked ? (
                          <Tag icon={<LockOutlined />} className="award-group-card__lock">
                            {t('judgeGroups.locked')}
                          </Tag>
                        ) : (
                          <Tag color="orange">
                            {t('judgeGroups.saakhaaCount', { count: group.category_count })}
                          </Tag>
                        )}
                      </div>
                      <Typography.Paragraph className="award-group-card__copy">
                        {localize(language, group.description, group.description_th)}
                      </Typography.Paragraph>
                    </div>
                    {!locked ? <RightOutlined className="award-group-card__chevron" /> : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <Card className="soft-card">
          <Empty description={t('judgeGroups.empty')} />
        </Card>
      )}
    </>
  );
}
