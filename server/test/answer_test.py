from gameplay_server import (get_current_question, answer_question, get_current_round)
from .test_helpers import DummySessionWithPlayers


def compose_answer(dummy_session):
    session_id = dummy_session.session_id
    round_id = get_current_round(session_id)['object']['id']
    question_id = get_current_question(session_id)['object']['id']
    player_id = dummy_session.players[0]

    return {
        "round_id": round_id,
        "question_id": question_id,
        "player_id": player_id,
        "wager": 1,
        "answer": "12345"
    }


def test_missing_wager():
    with DummySessionWithPlayers() as session:
        answer_body = compose_answer(session)
        del answer_body['wager']
        answer = answer_question(session.session_id, answer_body)
        assert answer["success"] is False


def test_missing_answer():
    with DummySessionWithPlayers() as session:
        answer_body = compose_answer(session)
        del answer_body['answer']
        answer = answer_question(session.session_id, answer_body)
        assert answer["success"] is False


def test_missing_round():
    with DummySessionWithPlayers() as session:
        answer_body = compose_answer(session)
        del answer_body['round_id']
        answer = answer_question(session.session_id, answer_body)
        assert answer["success"] is False


def test_missing_question_id():
    with DummySessionWithPlayers() as session:
        answer_body = compose_answer(session)
        del answer_body['question_id']
        answer = answer_question(session.session_id, answer_body)
        assert answer["success"] is False


def test_illegal_wager():
    with DummySessionWithPlayers() as session:
        answer_body = compose_answer(session)
        answer_body['wager'] = 69
        answer = answer_question(session.session_id, answer_body)
        assert answer["success"] is False


def test_successful_answer():
    with DummySessionWithPlayers() as session:
        session_id = session.session_id
        round_id = get_current_round(session_id)['object']['id']
        question_id = get_current_question(session_id)['object']['id']
        player_id = session.players[0]

        answer_body = {
            "round_id": round_id,
            "question_id": question_id,
            "player_id": player_id,
            "wager": 1,
            "answer": "12345"
        }
        answer = answer_question(session_id, answer_body)
        assert answer["success"]



def answer_twice():
    assert False
