from pprint import pprint
from .api_calls import (delete_session, start_session, set_current_question, get_current_question,
                        get_session, delete_player, add_to_session, delete_game)
from .test_helpers import DummyGame, dummy_session, dummy_player, indentprint, has_errors


def start_game_without_rounds():



    pass


def start_game_without_questions():
    pass


def test_start_session_game_id_nonexistent():

    with DummyGame() as game_id:
        session = dummy_session(game_id)
        mod = session["mod"]
        session_id = session["id"]

        delete_game(game_id)

        started = start_session(session_id, mod)
        print(started)
        assert has_errors(started)


def test_add_after_starting():
    print("\nTEST: add player to session after starting")
    with DummyGame() as game_id:
        session = dummy_session(game_id)
        mod = session["mod"]
        session_id = session["id"]
        player_id = dummy_player()

        print("Starting session")
        started = start_session(session_id, mod)
        print(started)
        assert has_errors(started) is False
        indentprint(get_session(session_id))

        print(f"adding player {player_id} to started session")
        added = add_to_session(session_id, {"player_id": player_id})
        pprint(added)
        assert has_errors(added)

        delete_player(player_id)
        delete_session(session_id, mod)


def test_set_question_and_get():
    print("\nTEST: set question and get current question")
    with DummyGame(rounds=1, questions_per_round=5, return_class=True) as game:
        game_id = game.game_id
        question2 = 1
        round_id = 0
        session = dummy_session(game_id)
        mod = session["mod"]
        session_id = session["id"]

        print("Starting session")
        started = start_session(session_id, mod)
        assert has_errors(started) is False
        print(started)

        question_before = get_current_question(session_id)

        newq = set_current_question(session_id, mod, question2, round_id)
        assert has_errors(newq) is False

        session = get_session(session_id)
        assert session['current_question'] == question2

        question_after = get_current_question(session_id)
        print(question_after)
        assert has_errors(question_after) is False
        assert question_before["question"] != question_after["question"]

        delete_session(session_id, mod)
