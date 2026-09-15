import type { Hero, Role } from "@/lib/types";
import { ARCHETYPE_CATEGORY_ORDER, ROLE_LABEL } from "@/lib/types";
import { HeroAvatar } from "./HeroAvatar";
import styles from "./SharedHeroGrid.module.css";

const ROLE_ORDER: Role[] = ["tank", "damage", "support"];
const UNCATEGORIZED_LABEL = "기타";

export type Team = "enemy" | "our";

interface Props {
  heroes: Hero[];
  activeTeam: Team;
  onChangeActiveTeam: (team: Team) => void;
  enemyIds: string[];
  ourIds: string[];
  enemyMax: number;
  ourMax: number;
  roleLimits?: Partial<Record<Role, number>>;
  onChangeEnemy: (ids: string[]) => void;
  onChangeOur: (ids: string[]) => void;
}

// 급박한 실전 상황에서 타이핑(오타 위험)도, 모달 열고 닫기도 없이 — 그리드
// 하나를 두고 위 토글로 "지금 클릭하면 어느 팀에 추가될지"만 바꾼다. 오버워치
// 룰상 미러 픽(같은 영웅이 양 팀에 다 있을 수 있음)이 허용되므로, 한 영웅이
// 상대·우리 팀 양쪽에 동시에 표시(파란 점+초록 점)될 수 있다.
export function SharedHeroGrid({
  heroes,
  activeTeam,
  onChangeActiveTeam,
  enemyIds,
  ourIds,
  enemyMax,
  ourMax,
  roleLimits,
  onChangeEnemy,
  onChangeOur,
}: Props) {
  const activeIds = activeTeam === "enemy" ? enemyIds : ourIds;
  const activeMax = activeTeam === "enemy" ? enemyMax : ourMax;
  const onChangeActive = activeTeam === "enemy" ? onChangeEnemy : onChangeOur;
  const atMax = activeIds.length >= activeMax;

  const countByRole: Partial<Record<Role, number>> = {};
  for (const id of activeIds) {
    const hero = heroes.find((h) => h.id === id);
    if (hero) countByRole[hero.role] = (countByRole[hero.role] ?? 0) + 1;
  }

  function isRoleAtMax(role: Role) {
    const limit = roleLimits?.[role];
    return limit !== undefined && (countByRole[role] ?? 0) >= limit;
  }

  function toggle(hero: Hero) {
    if (activeIds.includes(hero.id)) {
      onChangeActive(activeIds.filter((id) => id !== hero.id));
    } else if (!atMax && !isRoleAtMax(hero.role)) {
      onChangeActive([...activeIds, hero.id]);
    }
  }

  function renderHeroButton(hero: Hero) {
    const isEnemy = enemyIds.includes(hero.id);
    const isOur = ourIds.includes(hero.id);
    const isActiveSelected = activeIds.includes(hero.id);
    const disabled = !isActiveSelected && (atMax || isRoleAtMax(hero.role));
    return (
      <button
        key={hero.id}
        type="button"
        onClick={() => toggle(hero)}
        disabled={disabled}
        className={`${styles.heroButton} ${isEnemy ? styles.markedEnemy : ""} ${
          isOur ? styles.markedOur : ""
        }`}
      >
        <HeroAvatar iconUrl={hero.icon_url} name={hero.name} variant="icon" />
        <span className={styles.heroName}>{hero.name}</span>
        {isEnemy && <span className={styles.dotEnemy} />}
        {isOur && <span className={styles.dotOur} />}
      </button>
    );
  }

  return (
    <div>
      <div className={styles.teamToggle}>
        <button
          type="button"
          className={`${styles.teamButton} ${activeTeam === "enemy" ? styles.teamButtonActive : ""}`}
          onClick={() => onChangeActiveTeam("enemy")}
        >
          상대 팀 {enemyIds.length}/{enemyMax}
        </button>
        <button
          type="button"
          className={`${styles.teamButton} ${activeTeam === "our" ? styles.teamButtonActive : ""}`}
          onClick={() => onChangeActiveTeam("our")}
        >
          우리 팀 {ourIds.length}/{ourMax}
        </button>
      </div>

      <div className={styles.legend}>
        <span>
          <span className={styles.legendDot} style={{ background: "var(--blue)" }} />
          상대 팀
        </span>
        <span>
          <span className={styles.legendDot} style={{ background: "var(--green)" }} />
          우리 팀
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
            <div className={styles.roleLabel}>
              {ROLE_LABEL[role]}
              {roleLimits?.[role] !== undefined && activeIds.length > 0 && (
                <span>
                  {" "}
                  ({countByRole[role] ?? 0}/{roleLimits[role]})
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
