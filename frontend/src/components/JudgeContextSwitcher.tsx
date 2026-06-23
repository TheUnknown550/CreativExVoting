import { LockOutlined } from '@ant-design/icons';
import { Select } from 'antd';
import { useEffect, useState } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';

import * as judgeApi from '../api/judge';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { localize } from '../locales/localize';
import type { Category, JudgeAwardGroup } from '../types/domain';

// Two linked dropdowns in the judge top bar so judges can jump between award
// groups (หมวด) and sub-categories (สาขา) without walking back through the steps.
export function JudgeContextSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const [groups, setGroups] = useState<JudgeAwardGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const catMatch = matchPath('/judge/groups/:groupId/categories/:categoryId/*', location.pathname);
  const groupMatch = catMatch ? null : matchPath('/judge/groups/:groupId', location.pathname);
  const groupId = catMatch?.params.groupId ?? groupMatch?.params.groupId;
  const categoryId = catMatch?.params.categoryId;

  useEffect(() => {
    if (!token) {
      return;
    }
    const activeToken: string = token;
    let cancelled = false;
    void judgeApi
      .getJudgeGroups(activeToken)
      .then((data) => {
        if (!cancelled) {
          setGroups(data);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !groupId) {
      setCategories([]);
      return;
    }
    const activeToken: string = token;
    const activeGroupId: string = groupId;
    let cancelled = false;
    void judgeApi
      .getJudgeCategories(activeToken, activeGroupId)
      .then((data) => {
        if (!cancelled) {
          setCategories(data);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, groupId]);

  return (
    <div className="judge-switcher">
      <Select
        className="judge-switcher__select"
        placeholder={t('judgeStepper.step1')}
        value={groupId}
        onChange={(value) => navigate(`/judge/groups/${value}`)}
        options={groups.map((group) => ({
          value: group.id,
          disabled: !group.assigned,
          label: group.assigned ? (
            localize(language, group.name, group.name_th)
          ) : (
            <span>
              <LockOutlined /> {localize(language, group.name, group.name_th)}
            </span>
          ),
        }))}
      />
      <Select
        className="judge-switcher__select"
        placeholder={t('judgeStepper.step2')}
        value={categoryId}
        disabled={!groupId}
        onChange={(value) => navigate(`/judge/groups/${groupId}/categories/${value}/projects`)}
        options={categories.map((category) => ({
          value: category.id,
          label: localize(language, category.name, category.name_th),
        }))}
      />
    </div>
  );
}
