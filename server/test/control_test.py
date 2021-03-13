from .api_calls import (get_current_question, get_current_round,
                        set_current_question, set_current_round)
from .test_helpers import DummySessionWithPlayers, has_errors


def test_set_current_question_invalid_session_id():
    resp = set_current_question("83b2f715-0153-4272-89eb-87ef4a13a0bc", "83b2f715-0153-4272-89eb-87ef4a13a0bc", 0, 1)
    assert has_errors(resp) is True
    assert "Invalid session ID" in resp["errors"]


def test_set_current_question_non_mod():
    with DummySessionWithPlayers(rounds=2, questions_per_round=2) as session:
        session_id = session.session_id

        resp = set_current_question(session_id, "83b2f715-0153-4272-89eb-87ef4a13a0bc", 1, 0)
        assert has_errors(resp) is True
        assert "Forbidden" in resp["errors"]


def test_set_current_round_invalid_session_id():
    resp = set_current_round("83b2f715-0153-4272-89eb-87ef4a13a0bc", "83b2f715-0153-4272-89eb-87ef4a13a0bc", 0, 1)
    assert has_errors(resp) is True
    assert "Invalid session ID" in resp["errors"]


def test_set_current_round_non_mod():
    with DummySessionWithPlayers(rounds=2, questions_per_round=1) as session:
        session_id = session.session_id

        resp = set_current_round(session_id, "83b2f715-0153-4272-89eb-87ef4a13a0bc", 1, 0)
        assert has_errors(resp) is True
        assert "Forbidden" in resp["errors"]


def test_set_current_question_and_round_positive():
    round_count = 2
    question_count = 3
    with DummySessionWithPlayers(rounds=round_count, questions_per_round=question_count) as session:
        session_id = session.session_id
        mod = session.mod_id

        for roundIndex in range(0, round_count):
            for questionIndex in range(0, question_count):
                question_as_player = get_current_question(session_id)
                assert question_as_player["id"] == questionIndex

                round_as_player = get_current_round(session_id)
                assert round_as_player["id"] == roundIndex

                if questionIndex < (question_count - 1):
                    resp = set_current_question(session_id, mod, questionIndex + 1, roundIndex)
                    assert has_errors(resp) is False
                else:
                    if roundIndex < (round_count - 1):
                        resp = set_current_round(session_id, mod, roundIndex + 1, 0)
                        assert has_errors(resp) is False


def test_set_round_forward_backward():
    round_count = 2
    question_count = 2
    with DummySessionWithPlayers(rounds=round_count, questions_per_round=question_count) as session:
        session_id = session.session_id
        mod = session.mod_id

        # go forward
        for roundIndex in range(0, round_count):
            for questionIndex in range(0, question_count):
                print(f"iteration {questionIndex}")
                question_as_player = get_current_question(session_id)
                print(question_as_player)
                assert question_as_player["id"] == questionIndex

                round_as_player = get_current_round(session_id)
                assert round_as_player["id"] == roundIndex

                if questionIndex < (question_count - 1):
                    resp = set_current_question(session_id, mod, questionIndex + 1, roundIndex)
                    assert has_errors(resp) is False
                else:
                    if roundIndex < (round_count - 1):
                        resp = set_current_round(session_id, mod, roundIndex + 1, 0)
                        assert has_errors(resp) is False

        # go backward
        print("\nbackward")
        question_index = question_count - 1
        round_index = round_count - 1
        while question_index != 0 or round_index != 0:
            if question_index > 0:
                set_current_question(session_id, mod, question_index - 1, round_index)
            else:
                set_current_round(session_id, mod, round_index - 1, question_count - 1)

            question_as_player = get_current_question(session_id)
            print(question_as_player)
            question_index = question_as_player["id"]

            round_as_player = get_current_round(session_id)
            round_index = round_as_player["id"]
