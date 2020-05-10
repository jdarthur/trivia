from pprint import pprint
from gameplay_server import (delete_session, start_session, set_current_question,
                             get_current_question, get_session, delete_player, add_to_session)
from .test_helpers import DummyGame, dummy_session, dummy_player, indentprint


def start_game_without_rounds():
    pass


def start_game_without_questions():
    pass


def start_session_game_id_nonexistent():
    # create game
    # create session(game_id)
    # delete game
    # start_session
    # fail
    pass


def test_add_after_starting():
    print("\nTEST: add player to session after starting")
    with DummyGame() as game_id:
        session_id = dummy_session(game_id)
        player_id = dummy_player()

        print("Starting session")
        started = start_session(session_id)
        assert started['success'] is True
        indentprint(get_session(session_id))

        print(f"adding player {player_id} to started session")
        added = add_to_session(session_id, {"player_id": player_id})
        pprint(added)
        assert added['success'] is False

        delete_player(player_id)
        delete_session(session_id)


def test_set_question_and_get():
    print("\nTEST: set question and get current question")
    with DummyGame(rounds=1, questions_per_round=5, return_class=True) as game:
        game_id = game.game_id
        question2 = game.questions[1]
        session_id = dummy_session(game_id)

        print("Starting session")
        started = start_session(session_id)
        assert started['success']

        newq = set_current_question(session_id, question2)
        assert newq['success']

        session = get_session(session_id)
        assert session['object']['current_question'] == question2

        question = get_current_question(session_id)
        assert question['success']

        delete_session(session_id)
