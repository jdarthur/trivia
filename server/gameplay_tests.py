from pprint import pprint
from gameplay_server import (delete_session, start_session, set_current_question,
                             get_current_question, get_session, delete_player, add_to_session)
from session_tests import dummy_session, dummy_player
from session_tests import DummyGame, indentprint


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


def add_after_starting():
    print("\nTEST: add player to session after starting")
    with DummyGame() as game_id:
        session_id = dummy_session(game_id)
        player_id = dummy_player()

        print("Starting session")
        start_session(session_id, {"started": True})
        indentprint(get_session(session_id))
        
        print(f"adding player {player_id} to started session")
        added = add_to_session(session_id, {"player_id": player_id})
        pprint(added)

        delete_player(player_id)
        delete_session(session_id)


def set_question_and_get():
    print("\nTEST: set question and get current question")
    with DummyGame(rounds=1, questions_per_round=5, return_class=True) as game:
        game_id = game.game_id
        question2 = game.questions[1]
        session_id = dummy_session(game_id)

        print("Starting session")
        started = start_session(session_id, {"started": True})
        pprint(started)

        set_current_question(session_id, question2)
        session = get_session(session_id)
        print("session")
        indentprint(session)

        print("current question")
        question = get_current_question(session_id)
        indentprint(question)

        delete_session(session_id)


if __name__ == "__main__":
    add_after_starting()
    set_question_and_get()
