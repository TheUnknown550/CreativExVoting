import { Alert, Card, Empty, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import * as judgeApi from '../../api/judge';
import { ApiError } from '../../api/client';
import { JudgeStepper } from '../../components/JudgeStepper';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type { JudgeAwardGroup } from '../../types/domain';

export function JudgeGroupSelectPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { t } = useLanguage();
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
        if (cancelled) {
          return;
        }

        setGroups(nextGroups);
        const firstAssignedGroup = nextGroups.find((group) => group.assigned);
        if (firstAssignedGroup) {
          navigate(`/judge/groups/${firstAssignedGroup.id}`, { replace: true });
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
  }, [token, navigate, t]);

  if (loading) {
    return (
      <>
        <JudgeStepper current={1} />
        <div className="full-height-spin" style={{ minHeight: 280 }}>
          <Spin size="large" />
        </div>
      </>
    );
  }

  const firstAssignedGroup = groups.find((group) => group.assigned);
  if (firstAssignedGroup) {
    return <Navigate to={`/judge/groups/${firstAssignedGroup.id}`} replace />;
  }

  return (
    <>
      <JudgeStepper current={1} />
      {errorMessage ? <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} /> : null}
      <Card className="soft-card">
        <Empty description={t('judgeGroups.empty')} />
      </Card>
    </>
  );
}
