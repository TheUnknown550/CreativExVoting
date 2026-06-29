import type { HallOfFameDetails, Project } from '../types/domain';

export function parseHallOfFameDetails(project: Pick<Project, 'special_details'>): HallOfFameDetails | null {
  const raw = project.special_details?.trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<HallOfFameDetails>;
    if (
      !parsed ||
      (parsed.variant !== 'hall_of_fame_company' && parsed.variant !== 'hall_of_fame_brand') ||
      typeof parsed.description !== 'string' ||
      !Array.isArray(parsed.sections)
    ) {
      return null;
    }

    return {
      variant: parsed.variant,
      entity_label_th: typeof parsed.entity_label_th === 'string' ? parsed.entity_label_th : '',
      entity_label_en: typeof parsed.entity_label_en === 'string' ? parsed.entity_label_en : '',
      description_label_th: typeof parsed.description_label_th === 'string' ? parsed.description_label_th : '',
      description_label_en: typeof parsed.description_label_en === 'string' ? parsed.description_label_en : '',
      description: parsed.description,
      sections: parsed.sections
        .filter((section) => section && typeof section === 'object')
        .map((section) => ({
          key: typeof section.key === 'string' ? section.key : '',
          title_th: typeof section.title_th === 'string' ? section.title_th : '',
          title_en: typeof section.title_en === 'string' ? section.title_en : '',
          content: typeof section.content === 'string' ? section.content : '',
          link: typeof section.link === 'string' ? section.link : '',
        })),
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    };
  } catch {
    return null;
  }
}

export function isHallOfFameProject(project: Pick<Project, 'special_details'>): boolean {
  return parseHallOfFameDetails(project) !== null;
}
