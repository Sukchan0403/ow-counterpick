"use client";

import { useState } from "react";
import styles from "./HeroAvatar.module.css";

interface Props {
  iconUrl: string;
  name: string;
  variant: "icon" | "portrait";
  highlighted?: boolean;
  lazy?: boolean;
}

// HeroPickerPanel(작은 아이콘)과 ResultsPanel(큰 초상화)이 각각 따로 구현하던
// "핫링크 이미지 또는 이니셜 폴백" 렌더링을 하나로 합침. CDN 이미지 로드가
// 실패해도(404, 핫링크 차단 등) onError로 감지해 깨진 이미지 아이콘 대신
// 이니셜 폴백으로 전환한다.
export function HeroAvatar({ iconUrl, name, variant, highlighted = false, lazy = true }: Props) {
  const [failed, setFailed] = useState(false);
  const sizeClass = variant === "icon" ? styles.icon : styles.portrait;
  const highlightClass = highlighted ? styles.highlighted : "";
  const initial = name.charAt(0) || "?";

  if (iconUrl && !failed) {
    return (
      <img
        src={iconUrl}
        alt=""
        className={`${sizeClass} ${highlightClass}`}
        loading={lazy ? "lazy" : undefined}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={`${styles.fallback} ${sizeClass} ${highlightClass}`}>{initial}</span>
  );
}
