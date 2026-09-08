import type { Hero, Role } from "@/lib/types";
import { ARCHETYPE_CATEGORY_ORDER, ROLE_LABEL } from "@/lib/types";
import styles from "./HeroPickerPanel.module.css";

const ROLE_ORDER: Role[] = ["tank", "damage", "support"];
const UNCATEGORIZED_LABEL = "기타";

interface Props {
  title: string;
  heroes: Hero[];
  selectedIds: string[];
  maxCount: number;
  onChange: (ids: string[]) => void;
}

export function HeroPickerPanel({ title, heroes, selectedIds, maxCount, onChange }: Props) {
  const atMax = selectedIds.length >= maxCount;

  function toggle(heroId: string) {
    if (selectedIds.includes(heroId)) {
      onChange(selectedIds.filter((id) => id !== heroId));
    } else if (!atMax) {
      onChange([...selectedIds, heroId]);
    }
  }

  function renderHeroButton(hero: Hero) {
    const selected = selectedIds.includes(hero.id);
    return (
      <button
        key={hero.id}
        type="button"
        onClick={() => toggle(hero.id)}
        disabled={!selected && atMax}
        className={`${styles.heroButton} ${selected ? styles.heroButtonSelected : ""}`}
      >
        {hero.icon_url ? (
          <img src={hero.icon_url} alt="" className={styles.heroIcon} />
        ) : (
          <span className={styles.heroIconFallback}>{hero.name[0]}</span>
        )}
        <span className={styles.heroName}>{hero.name}</span>
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.count}>
          {selectedIds.length}/{maxCount}
        </span>
      </div>

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
            <div className={styles.roleLabel}>{ROLE_LABEL[role]}</div>
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
