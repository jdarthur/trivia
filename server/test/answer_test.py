import random
from gameplay_server import (get_current_question, answer_question, get_current_round, get_answers)
from .test_helpers import DummySessionWithPlayers


def compose_answer(dummy_session, player_id=None):
    session_id = dummy_session.session_id
    round_id = get_current_round(session_id)['object']['id']
    question_id = get_current_question(session_id)['object']['id']
    if player_id is None:
        player_id = dummy_session.players[0]

    return {
        "round_id": round_id,
        "question_id": question_id,
        "player_id": player_id,
        "wager": 1,
        "answer": str(random.randint(0, 99999))
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
        player_id = session.players[0]

        answer_body = compose_answer(session)
        answer = answer_question(session_id, answer_body)
        assert answer["success"]

        question_id = answer_body['question_id']

        answers = get_answers(session_id, question_id)
        assert answers['object'][player_id][-1]["id"] == answer['object']["id"]


def test_two_successful_answers():
    with DummySessionWithPlayers(players=2) as session:
        session_id = session.session_id
        player_id1 = session.players[0]
        player_id2 = session.players[1]

        answer_body = compose_answer(session, player_id1)
        answer1 = answer_question(session_id, answer_body)
        assert answer1["success"]

        answer_body = compose_answer(session, player_id2)
        answer2 = answer_question(session_id, answer_body)
        assert answer2["success"]

        question_id = answer_body['question_id']

        answers = get_answers(session_id, question_id)
        assert answers['object'][player_id1][-1]["id"] == answer1['object']["id"]
        assert answers['object'][player_id2][-1]["id"] == answer2['object']["id"]


def test_answer_twice():
    with DummySessionWithPlayers() as session:
        session_id = session.session_id
        player_id = session.players[0]

        answer_body = compose_answer(session)
        answer = answer_question(session_id, answer_body)
        assert answer["success"]

        answer_body = compose_answer(session)
        answer2 = answer_question(session_id, answer_body)
        assert answer2["success"]

        question_id = answer_body['question_id']

        answers = get_answers(session_id, question_id)
        assert answers['object'][player_id][0]["id"] == answer['object']["id"]
        assert answers['object'][player_id][1]["id"] == answer2['object']["id"]
