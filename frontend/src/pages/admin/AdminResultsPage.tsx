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
          messageApi.error(error instanceof ApiError ? error.message : 'ไม่สามารถโหลดสรุปคะแนนของหมวดหมู่ได้');
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
      messageApi.success('เริ่มส่งออกไฟล์ CSV แล้ว');
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'ไม่สามารถส่งออกไฟล์ CSV ได้');
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
            สรุปผลคะแนน
          </Typography.Title>
          <Typography.Paragraph className="page-subtitle">
            ดูผลงานอันดับหนึ่งในแต่ละหมวดหมู่รางวัล แล้วไปที่หน้า <strong>อันดับคะแนน</strong>{' '}
            เพื่อตรวจสอบตารางอันดับคะแนนแบบเต็มของหมวดหมู่นั้น
          </Typography.Paragraph>
        </section>

        <Card className="soft-card">
          <div className="results-section-heading">
            <div>
              <Typography.Title level={3} className="results-section-heading__title">
                อันดับหนึ่งของแต่ละหมวดหมู่
              </Typography.Title>
              <Typography.Paragraph className="results-section-heading__copy">
                การ์ดสรุปแต่ละใบแสดงผลงานที่นำอยู่ในหมวดหมู่นั้น โดยอ้างอิงจากข้อมูลคะแนนที่มีอยู่ในขณะนี้
              </Typography.Paragraph>
            </div>

            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={() => void handleExportAll()}
            >
              ส่งออกผลคะแนนทั้งหมด
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
                    {summary.leader?.project_name ?? 'ยังไม่มีผลงานที่จัดอันดับ'}
                  </Typography.Title>

                  <div className="results-winner-card__stats">
                    <span>
                      <strong>#{summary.leader?.ranking ?? '-'}</strong>
                      อันดับ
                    </span>
                    <span>
                      <strong>{summary.leader?.total_score ?? 0}</strong>
                      คะแนนรวม
                    </span>
                    <span>
                      <strong>{summary.leader ? summary.leader.average_score.toFixed(1) : '0.0'}</strong>
                      เฉลี่ย
                    </span>
                  </div>

                  <Button
                    type="primary"
                    onClick={() => navigate(`/admin/rankings?category=${summary.categoryId}`)}
                  >
                    ดูอันดับคะแนนของหมวดหมู่นี้
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <Card loading={summaryLoading} bordered={false} className="soft-card">
              {!summaryLoading ? <Empty description="ยังไม่มีสรุปคะแนนของหมวดหมู่" /> : null}
            </Card>
          )}

          {categories.length > 0 ? (
            <div className="results-summary-footer">
              <Typography.Text className="results-summary-footer__copy">
                ต้องการดูตารางอันดับคะแนนแบบละเอียดหรือไม่? เปิด <strong>อันดับคะแนน</strong> จากแถบเมนูด้านซ้าย
              </Typography.Text>
            </div>
          ) : null}
        </Card>
      </Space>
    </>
  );
}
