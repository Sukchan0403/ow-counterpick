import type { Role } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";
import styles from "./RoleSelectPanel.module.css";

const ROLES: Role[] = ["tank", "damage", "support"];

interface Props {
  value: Role | null;
  onChange: (role: Role) => void;
  hasError?: boolean;
}

export function RoleSelectPanel({ value, onChange, hasError }: Props) {
  return (
    <div className={styles.wrap}>
      {ROLES.map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => onChange(role)}
          className={`${styles.pill} ${value === role ? styles.pillSelected : ""} ${
            hasError && !value ? styles.pillError : ""
          }`}
        >
          {ROLE_LABEL[role]}
        </button>
      ))}
    </div>
  );
}
