"""빈 포지션 자동 판단 로직(app/composition.py) 유닛 테스트."""
import pytest

from app.composition import InvalidTeamCompositionError, infer_empty_position


def test_infers_missing_support_when_one_support_short():
    # 탱커 1 · 딜러 2 · 힐러 1 -> 힐러 한 자리 부족
    roles = ["tank", "damage", "damage", "support"]
    assert infer_empty_position(roles) == "support"


def test_infers_missing_tank_when_no_tank_picked():
    roles = ["damage", "damage", "support", "support"]
    assert infer_empty_position(roles) == "tank"


def test_infers_missing_damage_when_one_damage_short():
    roles = ["tank", "damage", "support", "support"]
    assert infer_empty_position(roles) == "damage"


def test_raises_when_a_role_is_over_filled():
    # 탱커 2명 -> 표준 조합으로 설명 불가
    roles = ["tank", "tank", "damage", "support"]
    with pytest.raises(InvalidTeamCompositionError):
        infer_empty_position(roles)


def test_raises_when_two_roles_are_short_at_once():
    # 탱커 0 · 딜러 1 · 힐러 2 -> 탱커와 딜러 둘 다 부족해서 유일하게 정해지지 않음
    roles = ["damage", "support", "support"]
    with pytest.raises(InvalidTeamCompositionError):
        infer_empty_position(roles)
