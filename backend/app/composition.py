"""빈 포지션 자동 판단 로직.

DB에 의존하지 않는 순수 함수 — our_heroes 4명의 역할(role) 목록만 받아서,
TEAM_ROLE_COMPOSITION(1탱커·2딜러·2힐러) 기준으로 정확히 한 자리가 비어있는지
판정한다. 급박한 실전 상황에서 사용자가 "빈 포지션"을 직접 골라야 했던 걸
없애기 위한 것 — 이미 고른 아군 4명의 역할만 보면 남은 한 자리는 항상
결정적으로 정해진다(표준 조합이 유일하므로).
"""
from app.config import TEAM_ROLE_COMPOSITION


class InvalidTeamCompositionError(Exception):
    """our_heroes 4명의 역할 구성으로 빈 포지션을 유일하게 판단할 수 없을 때."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def infer_empty_position(our_hero_roles: list[str]) -> str:
    """our_hero_roles: 우리 팀이 이미 고른 4명의 role 목록.

    표준 5인 조합(TEAM_ROLE_COMPOSITION) 대비, 정확히 한 역할만 1명 부족하고
    나머지 역할은 전부 정원이 찬 경우에만 그 역할을 반환한다. 그 외(예:
    탱커를 2명 고름, 또는 두 역할이 동시에 부족함)는 표준 조합으로 설명할
    수 없는 구성이라 에러를 던진다.
    """
    counts = {role: 0 for role in TEAM_ROLE_COMPOSITION}
    for role in our_hero_roles:
        counts[role] = counts.get(role, 0) + 1

    deficits = {role: TEAM_ROLE_COMPOSITION[role] - counts.get(role, 0) for role in TEAM_ROLE_COMPOSITION}

    over_filled = [role for role, deficit in deficits.items() if deficit < 0]
    if over_filled:
        raise InvalidTeamCompositionError(
            f"표준 조합(탱커 1 · 딜러 2 · 힐러 2) 기준으로 정원을 초과한 역할이 있어요: "
            f"{', '.join(over_filled)}"
        )

    short_roles = [role for role, deficit in deficits.items() if deficit > 0]
    if len(short_roles) != 1 or deficits[short_roles[0]] != 1:
        raise InvalidTeamCompositionError(
            "표준 조합(탱커 1 · 딜러 2 · 힐러 2) 기준으로 정확히 한 자리만 비어야 "
            "포지션을 자동으로 판단할 수 있어요. 빈 포지션을 직접 선택해주세요."
        )

    return short_roles[0]
