"use client";

import { useMemo, useState } from "react";
import type { Hero, Role } from "@/lib/types";
import { HeroPickerPanel } from "./HeroPickerPanel";
import styles from "./HeroPickerModal.module.css";

interface Props {
  title: string;
  heroes: Hero[];
  selectedIds: string[];
  maxCount: number;
  roleLimits?: Partial<Record<Role, number>>;
  onChange: (ids: string[]) => void;
  onClose: () => void;
}

export function HeroPickerModal({
  title,
  heroes,
  selectedIds,
  maxCount,
  roleLimits,
  onChange,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");

  // 이미 고른 영웅은 검색어와 상관없이 항상 보여야 선택 해제가 가능하다 —
  // 검색어를 지우기 전엔 선택된 영웅이 사라져서 못 뺴는 상황을 막기 위함.
  const filteredHeroes = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return heroes;
    return heroes.filter(
      (h) => h.name.includes(trimmed) || selectedIds.includes(h.id),
    );
  }, [heroes, query, selectedIds]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            {title} ({selectedIds.length}/{maxCount})
          </span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <input
          type="text"
          className={styles.searchInput}
          placeholder="영웅 이름 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className={styles.scrollArea}>
          {filteredHeroes.length === 0 ? (
            <div className={styles.noResults}>검색 결과가 없어요.</div>
          ) : (
            <HeroPickerPanel
              title={title}
              heroes={filteredHeroes}
              selectedIds={selectedIds}
              maxCount={maxCount}
              roleLimits={roleLimits}
              onChange={onChange}
              bare
            />
          )}
        </div>
      </div>
    </div>
  );
}
