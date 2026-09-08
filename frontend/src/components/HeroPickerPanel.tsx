import type { Hero, Role } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";
import styles from "./HeroPickerPanel.module.css";

const ROLE_ORDER: Role[] = ["tank", "damage", "support"];

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
        return (
          <div key={role} className={styles.roleGroup}>
            <div className={styles.roleLabel}>{ROLE_LABEL[role]}</div>
            <div className={styles.heroGrid}>
              {roleHeroes.map((hero) => {
                const selected = selectedIds.includes(hero.id);
                return (
                  <button
                    key={hero.id}
                    type="button"
                    onClick={() => toggle(hero.id)}
                    disabled={!selected && atMax}
                    className={`${styles.heroButton} ${
                      selected ? styles.heroButtonSelected : ""
                    }`}
                  >
                    {hero.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
