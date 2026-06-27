import { RightOutlined } from '@ant-design/icons';
import { Alert, Card, Empty, Spin, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import * as judgeApi from '../../api/judge';
import { ApiError } from '../../api/client';
import { BrandMark } from '../../components/BrandMark';
import { JudgeStepper } from '../../components/JudgeStepper';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { localize } from '../../locales/localize';
import type { Category, JudgeAwardGroup } from '../../types/domain';

export function JudgeCategorySelectPage() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const [group, setGroup] = useState<JudgeAwardGroup | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !groupId) {
      return;
    }
    const activeToken: string = token;
    const activeGroupId: string = groupId;
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    async function loadData() {
      try {
        const [groups, nextCategories] = await Promise.all([
          judgeApi.getJudgeGroups(activeToken),
          judgeApi.getJudgeCategories(activeToken, activeGroupId),
        ]);
        if (cancelled) {
          return;
        }

        const currentGroup = groups.find((item) => item.id === activeGroupId) ?? null;
        if (!currentGroup || !currentGroup.assigned) {
          navigate('/judge', { replace: true });
          return;
        }

        setGroup(currentGroup);
        setCategories(nextCategories);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof ApiError ? error.message : t('judgeCategories.loadError'));
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
  }, [token, groupId, navigate]);

  return (
    <>
      <JudgeStepper current={1} groupId={groupId} />

      {errorMessage ? <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} /> : null}

      {loading ? (
        <div className="full-height-spin" style={{ minHeight: 280 }}>
          <Spin size="large" />
        </div>
      ) : (
        <div className="judge-workspace">
          <aside className="judge-brand-panel">
            <BrandMark className="judge-brand-panel__mark" />
            <Typography.Title level={3} className="judge-brand-panel__title">
              {group ? localize(language, group.name, group.name_th) : t('judgeCategories.chooseBranch')}
            </Typography.Title>
            <Typography.Paragraph className="judge-brand-panel__copy">
              {group ? localize(language, group.description, group.description_th) : t('judgeCategories.chooseBranch')}
            </Typography.Paragraph>
          </aside>

          <section className="judge-nominees">
            <div className="judge-nominees__heading">
              <Typography.Title level={2} className="judge-nominees__title">
                {t('judgeCategories.chooseBranch')}
              </Typography.Title>
            </div>

            {categories.length > 0 ? (
              <div className="award-group-list">
                {categories.map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    className="award-group-card"
                    onClick={() =>
                      navigate(`/judge/groups/${groupId}/categories/${category.id}/projects`)
                    }
                  >
                    <div className="award-group-card__index">
                      {group?.code ? `${group.code}.${category.display_order}` : category.display_order}
                    </div>
                    <div className="award-group-card__content">
                      <Typography.Title level={4} className="award-group-card__title">
                        {localize(language, category.name, category.name_th)}
                      </Typography.Title>
                      <Typography.Paragraph className="award-group-card__copy">
                        {localize(language, category.description, category.description_th) ||
                          t('judgeCategories.noDescription')}
                      </Typography.Paragraph>
                    </div>
                    <RightOutlined className="award-group-card__chevron" />
                  </button>
                ))}
              </div>
            ) : (
              <Card className="soft-card">
                <Empty description={t('judgeCategories.empty')} />
              </Card>
            )}
          </section>
        </div>
      )}
    </>
  );
}
