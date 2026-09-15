import type { Hero, Role } from "@/lib/types";
import { ARCHETYPE_CATEGORY_ORDER, ROLE_LABEL } from "@/lib/types";
import { HeroAvatar } from "./HeroAvatar";
import styles from "./HeroPickerPanel.module.css";

const ROLE_ORDER: Role[] = ["tank", "damage", "support"];
const UNCATEGORIZED_LABEL = "기타";

interface Props {
  title: string;
  heroes: Hero[];
  selectedIds: string[];
  maxCount: number;
  onChange: (ids: string[]) => void;
  // 역할별 최대 인원(예: 탱커1·딜러2·힐러2). 넘기면 해당 역할이 정원을 채운
  // 순간 그 역할 영웅 버튼이 전부 비활성화된다 — 표준 조합에 안 맞는 구성
  // 자체를 선택 단계에서 막기 위함.
  roleLimits?: Partial<Record<Role, number>>;
  // true면 바깥 패널 박스(배경/테두리/패딩)와 제목/카운트 헤더를 생략한다 —
  // HeroPickerModal처럼 이미 자기 모달 헤더가 있는 컨테이너 안에 넣을 때 사용.
  bare?: boolean;
}

export function HeroPickerPanel({
  title,
  heroes,
  selectedIds,
  maxCount,
  onChange,
  roleLimits,
  bare = false,
}: Props) {
  const atMax = selectedIds.length >= maxCount;

  const countByRole: Partial<Record<Role, number>> = {};
  for (const id of selectedIds) {
    const hero = heroes.find((h) => h.id === id);
    if (hero) countByRole[hero.role] = (countByRole[hero.role] ?? 0) + 1;
  }

  function isRoleAtMax(role: Role) {
    const limit = roleLimits?.[role];
    return limit !== undefined && (countByRole[role] ?? 0) >= limit;
  }

  function toggle(hero: Hero) {
    if (selectedIds.includes(hero.id)) {
      onChange(selectedIds.filter((id) => id !== hero.id));
    } else if (!atMax && !isRoleAtMax(hero.role)) {
      onChange([...selectedIds, hero.id]);
    }
  }

  function renderHeroButton(hero: Hero) {
    const selected = selectedIds.includes(hero.id);
    const disabled = !selected && (atMax || isRoleAtMax(hero.role));
    return (
      <button
        key={hero.id}
        type="button"
        onClick={() => toggle(hero)}
        disabled={disabled}
        className={`${styles.heroButton} ${selected ? styles.heroButtonSelected : ""}`}
      >
        <HeroAvatar iconUrl={hero.icon_url} name={hero.name} variant="icon" />
        <span className={styles.heroName}>{hero.name}</span>
      </button>
    );
  }

  return (
    <div className={bare ? undefined : styles.panel}>
      {!bare && (
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <span className={styles.count}>
            {selectedIds.length}/{maxCount}
          </span>
        </div>
      )}

      {ROLE_ORDER.map((role) => {
        const roleHeroes = heroes.filter((h) => h.role === role);
        if (roleHeroes.length === 0) return null;

        const knownCategories = ARCHETYPE_CATEGORY_ORDER[role];
        const knownSet = new Set(knownCategories);
        const uncategorized = roleHeroes.filter((h) => !knownSet.has(h.archetype_category));
        const groups: { label: string; heroes: Hero[] }[] = [
          ...knownCategories
            .map((category) => ({
              label: category,
              heroes: roleHeroes.filter((h) => h.archetype_category === category),
            }))
            .filter((g) => g.heroes.length > 0),
          ...(uncategorized.length > 0
            ? [{ label: UNCATEGORIZED_LABEL, heroes: uncategorized }]
            : []),
        ];

        return (
          <div key={role} className={styles.roleGroup}>
            <div className={styles.roleLabel}>
              {ROLE_LABEL[role]}
              {roleLimits?.[role] !== undefined && (
                <span className={styles.roleCount}>
                  {" "}
                  {countByRole[role] ?? 0}/{roleLimits[role]}
                </span>
              )}
            </div>
            {groups.map((group) => (
              <div key={group.label} className={styles.archetypeGroup}>
                <div className={styles.archetypeLabel}>{group.label}</div>
                <div className={styles.heroGrid}>{group.heroes.map(renderHeroButton)}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
