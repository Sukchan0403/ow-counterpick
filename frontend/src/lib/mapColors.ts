// 실제 맵 스크린샷 대신 쓰는 추상적인 플랫 컬러 (저작권 문제 없는 자체 아이코노그래피).
// 목업(Claude Design 캔버스)에서 쓰던 톤을 재사용.
export const MAP_COLORS: Record<string, string> = {
  eichenwalde: "#2b4a3f",
  kings_row: "#3a3f52",
  hollywood: "#4a3a2b",
  dorado: "#5a3a2f",
  havana: "#3f5a4a",
  junkertown: "#5a4a2b",
  ilios: "#2f4a5a",
  oasis: "#3a5a4f",
  hanaoka: "#5a2f3a",
  throne_of_anubis: "#5a4a2f",
  colosseo: "#4a2f3a",
  new_queen_street: "#2f3a5a",
  suravasa: "#2f5a4f",
  new_junk_city: "#5a3a2f",
};

const FALLBACK_COLORS = ["#2b4a3f", "#3a3f52", "#4a3a2b", "#3f5a4a"];

export function colorForMap(mapId: string): string {
  if (MAP_COLORS[mapId]) return MAP_COLORS[mapId];
  let hash = 0;
  for (const ch of mapId) hash = (hash * 31 + ch.charCodeAt(0)) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[hash];
}
