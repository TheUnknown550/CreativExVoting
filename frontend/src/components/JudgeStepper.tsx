import { useNavigate } from 'react-router-dom';

import { useLanguage } from '../contexts/LanguageContext';

export type JudgeStep = 1 | 2 | 3 | 4;

interface JudgeStepperProps {
  current: JudgeStep;
  groupId?: string;
  categoryId?: string;
}

// Four-step progress bar shown across the judge flow:
// 1) select group (หมวด) 2) select sub-category (สาขา) 3) vote 4) summary.
export function JudgeStepper({ current, groupId, categoryId }: JudgeStepperProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const steps: Array<{ step: JudgeStep; label: string; target: string | null }> = [
    { step: 1, label: t('judgeStepper.step1'), target: '/judge' },
    {
      step: 2,
      label: t('judgeStepper.step2'),
      target: groupId ? `/judge/groups/${groupId}` : null,
    },
    {
      step: 3,
      label: t('judgeStepper.step3'),
      target:
        groupId && categoryId
          ? `/judge/groups/${groupId}/categories/${categoryId}/projects`
          : null,
    },
    {
      step: 4,
      label: t('judgeStepper.step4'),
      target:
        groupId && categoryId
          ? `/judge/groups/${groupId}/categories/${categoryId}/summary`
          : null,
    },
  ];

  return (
    <nav className="judge-stepper" aria-label="progress">
      {steps.map(({ step, label, target }) => {
        const isActive = step === current;
        const isReachable = target !== null && step <= current;
        return (
          <button
            type="button"
            key={step}
            className={`judge-stepper__item${isActive ? ' judge-stepper__item--active' : ''}`}
            disabled={!isReachable || isActive}
            onClick={() => {
              if (target && isReachable && !isActive) {
                navigate(target);
              }
            }}
          >
            <span className={`judge-stepper__badge${isActive ? ' judge-stepper__badge--active' : ''}`}>
              {step}
            </span>
            <span className="judge-stepper__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
