"""필수픽 임계치(config.MUST_PICK_PERCENTAGE_THRESHOLD) 실증 검증용 스크립트.

실제 큐레이션된 시드 데이터(seed-data/*.json, DB 아님 — scoring.py는 DB에
의존하지 않는 순수 함수라 JSON을 직접 읽어도 충분하다)를 대상으로:

1. "카운터 단독" 시나리오: counter_relations의 각 행마다, 그 후보가 딱 그
   상대 영웅 하나만 상대하는 상황을 가정하고 채점한다.
2. "시너지 단독" 시나리오: synergy_relations의 각 행마다 동일하게 채점한다.
3. "카운터+시너지 결합" 시나리오: 같은 후보가 counter_relations와
   synergy_relations 양쪽에 모두 등장하는 경우, 그 둘을 합쳐서 채점한다.

각 그룹에서 is_must_pick이 몇 건이나 발동하는지, percentage 분포(최소/최대/
평균)가 어떤지 출력한다. 이 출력을 보고 MUST_PICK_PERCENTAGE_THRESHOLD나
PERCENTAGE_SCALE을 조정할지 사람이 판단한다.

실행 (backend/ 디렉토리, 가상환경 활성화 상태에서):
    python3 -m scripts.audit_must_pick_distribution
"""
import json
import statistics
from pathlib import Path

from app.scoring import score_candidates

SEED_DIR = Path(__file__).resolve().parent.parent.parent / "seed-data"


def load(name: str):
    with open(SEED_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def summarize(label: str, percentages: list[int], must_pick_count: int) -> None:
    print(f"\n[{label}] {len(percentages)}건")
    if not percentages:
        print("  (데이터 없음)")
        return
    print(f"  percentage: min={min(percentages)} max={max(percentages)} "
          f"avg={statistics.mean(percentages):.1f}")
    print(f"  is_must_pick 발동: {must_pick_count}건 "
          f"({must_pick_count / len(percentages) * 100:.1f}%)")


def main() -> None:
    heroes = load("heroes.json")
    heroes_by_id = {h["id"]: h for h in heroes}
    counters = load("counter_relations.json")
    synergies = load("synergy_relations.json")

    def candidate_for(hero_id: str) -> dict:
        h = heroes_by_id[hero_id]
        return {"id": h["id"], "name": h["name"], "role": h["role"], "archetype": h.get("archetype", "")}

    # 1) 카운터 단독
    counter_only_pct: list[int] = []
    counter_only_must_pick = 0
    for row in counters:
        result = score_candidates(
            [candidate_for(row["hero_id"])],
            [row],
            [],
            [],
        )[0]
        counter_only_pct.append(result.percentage)
        counter_only_must_pick += int(result.is_must_pick)
    summarize("카운터 단독", counter_only_pct, counter_only_must_pick)

    # 2) 시너지 단독
    synergy_only_pct: list[int] = []
    synergy_only_must_pick = 0
    for row in synergies:
        result = score_candidates(
            [candidate_for(row["hero_id"])],
            [],
            [row],
            [],
        )[0]
        synergy_only_pct.append(result.percentage)
        synergy_only_must_pick += int(result.is_must_pick)
    summarize("시너지 단독", synergy_only_pct, synergy_only_must_pick)

    # 3) 카운터+시너지 결합 (같은 후보가 두 리스트 모두에 등장하는 경우)
    # synergy_relations는 한 방향으로만 저장되므로(scoring.py의 synergy_by_hero와
    # 동일하게) hero_id/synergy_hero_id 양쪽을 다 확인해야 한다 — 안 그러면
    # synergy_hero_id 쪽에만 등장하는 후보가 조용히 누락된다.
    counter_heroes = {row["hero_id"] for row in counters}
    synergy_heroes = {row["hero_id"] for row in synergies} | {
        row["synergy_hero_id"] for row in synergies
    }
    combined_pct: list[int] = []
    combined_must_pick = 0
    for hero_id in counter_heroes & synergy_heroes:
        hero_counters = [r for r in counters if r["hero_id"] == hero_id]
        hero_synergies = [
            r for r in synergies if r["hero_id"] == hero_id or r["synergy_hero_id"] == hero_id
        ]
        result = score_candidates(
            [candidate_for(hero_id)],
            hero_counters[:1],
            hero_synergies[:1],
            [],
        )[0]
        combined_pct.append(result.percentage)
        combined_must_pick += int(result.is_must_pick)
    summarize("카운터+시너지 결합", combined_pct, combined_must_pick)


if __name__ == "__main__":
    main()
