import random
from pprint import pprint

from .api_calls import (get_current_question, answer_question, get_current_round,
                        get_answers, get_scoreboard, get_session, score_question, set_current_question)
from .test_helpers import DummySessionWithPlayers, has_errors


def compose_answer(dummy_session, player_id=None):
    session_id = dummy_session.session_id
    round_id = get_current_round(session_id)['id']
    question_id = get_current_question(session_id)['id']
    if player_id is None:
        player_id = dummy_session.players[0]

    return {
        "round_id": round_id,
        "question_id": question_id,
        "player_id": player_id,
        "wager": 1,
        "answer": str(random.randint(0, 99999))
    }


def get_answer_for_player(answers, player_id) -> list:
    """
    take player ID and translate from:

    from
      [
        { player_id: x, answers: [{answer: a}, {answer: aa}] },
        { player_id: y, answers: [{answer: b}, {answer: bb}] }
      ]
    to
     [{answer: a}, {answer: aa}]

    """
    for answer in answers:
        if answer['player_id'] == player_id:
            return answer["answers"]
    return []


def get_score(scoreboard, player_id):
    for player in scoreboard["scores"]:
        if player["player_id"] == player_id:
            return player
    return None


def create_score(mod, question_index, round_index, player_id, override=None) -> dict:
    s = {
        "player_id": mod,
        'question_index': question_index,
        'round_index': round_index,
        'players': {player_id: {'correct': True}}
    }

    if override is not None:
        s['players'][player_id]["score_override"] = override
    return s


# def test_missing_wager():
#     with DummySessionWithPlayers() as session:
#         answer_body = compose_answer(session)
#         del answer_body['wager']
#         answer = answer_question(session.session_id, answer_body)
#         assert has_errors(answer) is True


# def test_missing_answer():
#     with DummySessionWithPlayers() as session:
#         answer_body = compose_answer(session)
#         del answer_body['answer']
#         answer = answer_question(session.session_id, answer_body)
#         assert has_errors(answer) is True


# def test_missing_round():
#     with DummySessionWithPlayers() as session:
#         answer_body = compose_answer(session)
#         del answer_body['round_id']
#         answer = answer_question(session.session_id, answer_body)
#         assert has_errors(answer) is True


# def test_missing_question_id():
#     with DummySessionWithPlayers() as session:
#         answer_body = compose_answer(session)
#         del answer_body['question_id']
#         answer = answer_question(session.session_id, answer_body)
#         assert has_errors(answer) is True


# def test_illegal_wager():
#     with DummySessionWithPlayers() as session:
#         answer_body = compose_answer(session)
#         answer_body['wager'] = 69
#         answer = answer_question(session.session_id, answer_body)
#         assert has_errors(answer) is True


def test_successful_answer():
    with DummySessionWithPlayers() as session:
        session_id = session.session_id
        mod = session.mod_id
        player_id = session.players[0]

        answer_body = compose_answer(session)
        print(answer_body)
        answer = answer_question(session_id, answer_body)
        assert has_errors(answer) is False
        print(answer)

        session = get_session(session_id)
        pprint(session)

        question_id = answer_body['question_id']
        round_id = answer_body['round_id']

        answers = get_answers(session_id, round_id, question_id, player_id=mod)
        print(answers)
        assert answers[0]["answers"][0]["id"] == answer["id"]


def test_two_successful_answers():
    with DummySessionWithPlayers(players=2) as session:
        session_id = session.session_id
        mod = session.mod_id
        player_id1 = session.players[0]
        player_id2 = session.players[1]

        answer_body = compose_answer(session, player_id1)
        answer1 = answer_question(session_id, answer_body)
        assert has_errors(answer1) is False

        answer_body = compose_answer(session, player_id2)
        answer2 = answer_question(session_id, answer_body)
        assert has_errors(answer1) is False

        question_id = answer_body['question_id']
        round_id = answer_body['round_id']

        answers = get_answers(session_id, round_id, question_id, player_id=mod)

        p1_answers = get_answer_for_player(answers, player_id1)
        p2_answers = get_answer_for_player(answers, player_id2)

        print(answers)
        assert p1_answers[-1]["id"] == answer1["id"]
        assert p2_answers[-1]["id"] == answer2["id"]


def test_answer_twice():
    with DummySessionWithPlayers() as session:
        session_id = session.session_id
        mod = session.mod_id
        player_id = session.players[0]

        answer_body = compose_answer(session)
        answer = answer_question(session_id, answer_body)
        assert has_errors(answer) is False

        answer_body = compose_answer(session)
        answer2 = answer_question(session_id, answer_body)
        assert has_errors(answer2) is False

        question_id = answer_body['question_id']
        round_id = answer_body['round_id']

        answers = get_answers(session_id, round_id, question_id, player_id=mod)

        p1_answers = get_answer_for_player(answers, player_id)

        print(answers)
        assert p1_answers[0]["id"] == answer["id"]
        assert p1_answers[1]["id"] == answer2["id"]


def test_get_scoreboard():
    with DummySessionWithPlayers(players=2) as session:
        session_id = session.session_id
        mod = session.mod_id
        player1 = session.players[0]
        player2 = session.players[1]

        scoreboard = get_scoreboard(session_id, mod)
        pprint(scoreboard)
        assert has_errors(scoreboard) is False

        assert sum(get_score(scoreboard, player1)["score"]) == 0
        assert sum(get_score(scoreboard, player2)["score"]) == 0


def test_score_answer():
    """
    two players answer question
    mark p1 == correct, p2 == incorrect
    verify scoreboard updated with wagers
    """
    with DummySessionWithPlayers(players=2) as session:
        session_id = session.session_id
        mod = session.mod_id
        player_id1 = session.players[0]
        player_id2 = session.players[1]

        answer_body = compose_answer(session, player_id1)
        answer1 = answer_question(session_id, answer_body)
        pprint(answer1)
        assert has_errors(answer1) is False

        answer_body = compose_answer(session, player_id2)
        answer2 = answer_question(session_id, answer_body)
        pprint(answer2)
        assert has_errors(answer2) is False

        question_id = answer_body['question_id']
        round_id = answer_body['round_id']
        score_body = {
            'player_id': mod,
            'question_id': question_id,
            'round_id': round_id,
            'players': {
                player_id1: {'correct': True},
                player_id2: {'correct': False}
            }
        }

        session = get_session(session_id)
        pprint(session)

        scored = score_question(session_id, score_body)
        print(scored)
        assert has_errors(scored) is False

        scoreboard = get_scoreboard(session_id, mod)
        print(scoreboard)

        assert sum(get_score(scoreboard, player_id1)["score"]) == answer_body['wager']
        assert sum(get_score(scoreboard, player_id2)["score"]) == 0


def test_score_two_answers():
    with DummySessionWithPlayers(questions_per_round=2) as session:
        session_id = session.session_id
        mod = session.mod_id
        player_id = session.players[0]
        question_id1 = 0
        question_id2 = 1
        round_id = 0

        answer_body = compose_answer(session)
        answer = answer_question(session_id, answer_body)
        assert has_errors(answer) is False

        score_body = {
            "player_id": mod,
            'question_index': question_id1,
            'round_index': round_id,
            'players': {player_id: {'correct': True}}
        }
        score_question(session_id, score_body)
        scoreboard = get_scoreboard(session_id, mod)
        pprint(scoreboard)
        assert sum(get_score(scoreboard, player_id)["score"]) == 1

        set_current_question(session_id, mod, question_id2, round_id)

        answer_body = compose_answer(session)
        answer_body['wager'] = 2
        answer = answer_question(session_id, answer_body)
        assert has_errors(answer) is False

        score_body = {
            "player_id": mod,
            'question_index': question_id2,
            'round_index': round_id,
            'players': {player_id: {'correct': True}}
        }
        score_question(session_id, score_body)

        scoreboard = get_scoreboard(session_id, mod)
        pprint(scoreboard)
        assert sum(get_score(scoreboard, player_id)["score"]) == 3


def test_rescore_answers():
    with DummySessionWithPlayers(questions_per_round=3) as session:
        session_id = session.session_id
        mod = session.mod_id
        player_id = session.players[0]

        for i in range(0, 3):
            # answer question
            answer_body = compose_answer(session)
            answer_body["wager"] = i + 1
            answer_question(session_id, answer_body)

            # score question
            score_body = create_score(mod, i, 0, player_id)
            score_question(session_id, score_body)

            # set next question
            if i < 2:
                set_current_question(session_id, mod, i + 1, 0)

        scoreboard = get_scoreboard(session_id, mod)
        pprint(scoreboard)
        assert get_score(scoreboard, player_id)["score"] == [1, 2, 3]

        for i in range(0, 3):
            # score question with override
            score_body = create_score(mod, i, 0, player_id, override=5)
            score_question(session_id, score_body)

            scoreboard = get_scoreboard(session_id, mod)
            pprint(scoreboard)
            assert get_score(scoreboard, player_id)["score"][i] == 5
