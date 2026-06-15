import { DownloadOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { AdminProjectRanking, Category } from '../../types/domain';

interface CategoryWinnerSummary {
  categoryId: string;
  categoryName: string;
  leader: AdminProjectRanking | null;
}

export function AdminResultsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryWinners, setCategoryWinners] = useState<CategoryWinnerSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!token) {
      return;
    }
    const activeToken: string = token;

    let cancelled = false;
    setSummaryLoading(true);

    async function loadSummary() {
      try {
        const nextCategories = await adminApi.getAdminCategories(activeToken);
        if (cancelled) {
          return;
        }

        setCategories(nextCategories);

        const summaries = await Promise.all(
          nextCategories.map(async (category) => {
            const response = await adminApi.getAdminResults(activeToken, category.id);
            return {
              categoryId: category.id,
              categoryName: category.name,
              leader: response.rankings[0] ?? null,
            } satisfies CategoryWinnerSummary;
          }),
        );

        if (!cancelled) {
          setCategoryWinners(summaries);
        }
      } catch (error) {
        if (!cancelled) {
          messageApi.error(error instanceof ApiError ? error.message : 'Unable to load category summaries.');
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
      messageApi.success('CSV export started.');
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to export CSV.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <section className="page-hero">
          <Typography.Title className="page-title" level={1}>
            Vote Summary
          </Typography.Title>
          <Typography.Paragraph className="page-subtitle">
            See the current top project in every award category, then jump into the dedicated
            Rankings page to inspect that category&apos;s leaderboard.
          </Typography.Paragraph>
        </section>

        <Card className="soft-card">
          <div className="results-section-heading">
            <div>
              <Typography.Title level={3} className="results-section-heading__title">
                Top of Each Category
              </Typography.Title>
              <Typography.Paragraph className="results-section-heading__copy">
                Each summary card shows the current leading project for that category based on the
                scoring data available so far.
              </Typography.Paragraph>
            </div>

            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={() => void handleExportAll()}
            >
              Export All Results
            </Button>
          </div>

          {categoryWinners.length > 0 ? (
            <div className="results-overview-grid">
              {categoryWinners.map((summary) => (
                <article className="results-winner-card" key={summary.categoryId}>
                  <Typography.Text className="results-winner-card__eyebrow">
                    {summary.categoryName}
                  </Typography.Text>

                  <Typography.Title level={4} className="results-winner-card__title">
                    {summary.leader?.project_name ?? 'No ranked project yet'}
                  </Typography.Title>

                  <div className="results-winner-card__stats">
                    <span>
                      <strong>#{summary.leader?.ranking ?? '-'}</strong>
                      Rank
                    </span>
                    <span>
                      <strong>{summary.leader?.total_score ?? 0}</strong>
                      Total
                    </span>
                    <span>
                      <strong>{summary.leader ? summary.leader.average_score.toFixed(1) : '0.0'}</strong>
                      Avg
                    </span>
                  </div>

                  <Button
                    type="primary"
                    onClick={() => navigate(`/admin/rankings?category=${summary.categoryId}`)}
                  >
                    View Category Ranking
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <Card loading={summaryLoading} bordered={false} className="soft-card">
              {!summaryLoading ? <Empty description="No category summaries available yet." /> : null}
            </Card>
          )}

          {categories.length > 0 ? (
            <div className="results-summary-footer">
              <Typography.Text className="results-summary-footer__copy">
                Need the detailed leaderboard? Open <strong>Rankings</strong> from the left sidebar.
              </Typography.Text>
            </div>
          ) : null}
        </Card>
      </Space>
    </>
  );
}
