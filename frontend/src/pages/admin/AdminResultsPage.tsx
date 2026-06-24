import { DownloadOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Space, Spin, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localize } from '../../locales/localize';
import type { AdminProjectRanking, AwardGroup, Category } from '../../types/domain';

export function AdminResultsPage() {
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<AwardGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [leaders, setLeaders] = useState<Record<string, AdminProjectRanking>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!token) {
      return;
    }
    const activeToken: string = token;

    let cancelled = false;
    setLoading(true);

    async function loadSummary() {
      try {
        // One rankings call for every category, then pick the leader per category
        // client-side (instead of one heavy request per category).
        const [nextGroups, nextCategories, results] = await Promise.all([
          adminApi.getAdminGroups(activeToken),
          adminApi.getAdminCategories(activeToken),
          adminApi.getAdminResults(activeToken),
        ]);
        if (cancelled) {
          return;
        }

        const leaderByCategory: Record<string, AdminProjectRanking> = {};
        for (const ranking of results.rankings) {
          if (!leaderByCategory[ranking.category_id]) {
            leaderByCategory[ranking.category_id] = ranking;
          }
        }

        setGroups(nextGroups);
        setCategories(nextCategories);
        setLeaders(leaderByCategory);
      } catch (error) {
        if (!cancelled) {
          messageApi.error(error instanceof ApiError ? error.message : t('adminResults.loadError'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Build [super award group -> its sub-categories] sections, ordered.
  const sections = useMemo(() => {
    const activeCategories = categories.filter((category) => category.is_active);
    const result = groups
      .map((group) => ({
        group,
        categories: activeCategories
          .filter((category) => category.award_group_id === group.id)
          .sort((a, b) => a.display_order - b.display_order),
      }))
      .filter((section) => section.categories.length > 0);

    const ungrouped = activeCategories.filter((category) => !category.award_group_id);
    if (ungrouped.length > 0) {
      result.push({ group: null as unknown as AwardGroup, categories: ungrouped });
    }
    return result;
  }, [groups, categories]);

  async function handleExportAll() {
    if (!token) {
      return;
    }

    setExporting(true);
    try {
      const blob = await adminApi.exportResultsCsv(token);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'voting-results.csv';
      anchor.click();
      URL.revokeObjectURL(url);
      messageApi.success(t('adminResults.exportSuccess'));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminResults.exportError'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card className="soft-card">
          <div className="results-section-heading">
            <div>
              <Typography.Title level={3} className="results-section-heading__title">
                {t('adminResults.topOfEachCategory')}
              </Typography.Title>
              <Typography.Paragraph className="results-section-heading__copy">
                {t('adminResults.topOfEachCategoryCopy')}
              </Typography.Paragraph>
            </div>

            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={() => void handleExportAll()}
            >
              {t('adminResults.exportAllResults')}
            </Button>
          </div>

          {loading ? (
            <div className="full-height-spin" style={{ minHeight: 220 }}>
              <Spin size="large" />
            </div>
          ) : sections.length > 0 ? (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {sections.map((section) => (
                <div className="results-group" key={section.group?.id ?? 'ungrouped'}>
                  <div className="results-group__heading">
                    <Typography.Title level={4} className="results-group__title">
                      {section.group
                        ? localize(language, section.group.name, section.group.name_th)
                        : t('adminResults.ungrouped')}
                    </Typography.Title>
                    <Tag color="orange">
                      {t('adminResults.categoryCount', { count: section.categories.length })}
                    </Tag>
                  </div>

                  <div className="results-overview-grid">
                    {section.categories.map((category) => {
                      const leader = leaders[category.id] ?? null;
                      return (
                        <article className="results-winner-card" key={category.id}>
                          <Typography.Text className="results-winner-card__eyebrow">
                            {localize(language, category.name, category.name_th)}
                          </Typography.Text>

                          <Typography.Title level={4} className="results-winner-card__title">
                            {leader?.project_name ?? t('adminResults.noRankedProject')}
                          </Typography.Title>

                          <div className="results-winner-card__stats">
                            <span>
                              <strong>{leader?.total_score ?? 0}</strong>
                              {t('adminResults.total')}
                            </span>
                            <span>
                              <strong>{leader ? leader.average_score.toFixed(1) : '0.0'}</strong>
                              {t('adminResults.avg')}
                            </span>
                          </div>

                          <Button type="primary" onClick={() => navigate(`/admin/rankings?category=${category.id}`)}>
                            {t('adminResults.viewCategoryRanking')}
                          </Button>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Space>
          ) : (
            <Empty description={t('adminResults.noSummaries')} />
          )}

          <div className="results-summary-footer">
            <Typography.Text className="results-summary-footer__copy">
              {t('adminResults.footerCopy')} <strong>{t('adminResults.rankingsLink')}</strong>{' '}
              {t('adminResults.footerCopySuffix')}
            </Typography.Text>
          </div>
        </Card>
      </Space>
    </>
  );
}
