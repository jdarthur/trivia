from pprint import pprint
from random import randint
from gameplay_server import (create_session, delete_session, start_session, set_current_question,
                             get_current_question, get_question, dummy_game, dummy_session, dummy_player)
from editor_server import create_game, delete_game, create_question, delete_question


def set_question_and_get():
    print("\nTEST: add player to session")
    game_id = dummy_game()
    session_id = dummy_session(game_id)

    print("Starting session")
    started = start_session(session_id, {"started": True})
    pprint(started)

    print(f"adding player {player_id} to started session")
    added = add_to_session(session_id, {"player_id": player_id})
    pprint(added)

    delete_player(player_id)
    delete_session(session_id)
    delete_game(game_id) 


def add_after_starting():
    print("\nTEST: add player to session")
    game_id = dummy_game()
    session_id = dummy_session(game_id)
    player_id = dummy_player()

    print("Starting session")
    started = start_session(session_id, {"started": True})
    pprint(started)

    print(f"adding player {player_id} to started session")
    added = add_to_session(session_id, {"player_id": player_id})
    pprint(added)

    delete_player(player_id)
    delete_session(session_id)
    delete_game(game_id)
