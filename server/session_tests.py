import uuid
from pprint import pprint
from random import randint
from gameplay_server import (create_session, delete_session, get_session, get_sessions,
                             update_session, add_to_session, remove_from_session,
                             create_player, delete_player, get_players, start_session)
from editor_server import delete_game, delete_round, delete_question
from game_tests import dummy_game, dummy_round
from rounds_tests import indentprint
from questions_tests import dummy_question

"""
===============================
            HELPERS
===============================
"""


def dummy_session(game_id):
    sdata = {
        "name": "test session",
        "game_id": game_id
    }

    created = create_session(sdata)
    if created["success"]:
        return created["object"]["id"]
    print(created)
    return None


def dummy_player():
    pdata = {"player_name": f"test team {randint(1, 100000)}"}
    created = create_player(pdata)
    if created["success"]:
        return created["object"]["id"]
    print(created)
    return None


def create_and_print(data):
    session = create_session(data)
    if session['success']:
        session = session['object']
    indentprint(session)


class DummyGame(object):
    def __enter__(self):
        self.question_id = dummy_question()
        self.round_id = dummy_round(self.question_id)
        self.game_id = dummy_game(self.round_id)
        return self.game_id

    def __exit__(self, type, value, traceback):
        delete_game(self.game_id)
        delete_round(self.round_id)
        delete_question(self.question_id)


"""
===============================
            TESTS
===============================
"""


def missing_name():
    print("\nTEST: session is missing name attribute")
    data = {}
    create_and_print(data)


def name_is_not_str():
    print("\nTEST: name attribute is not str")
    data = {"name": []}
    create_and_print(data)


def missing_game_id():
    print("\nTEST: session is missing game_id")
    data = {"name": "f"}
    create_and_print(data)


def game_id_is_not_str():
    print("\nTEST: game_id is not str")
    data = {"name": "f", "game_id": []}
    create_and_print(data)


def game_id_is_not_valid():
    print("\nTEST: game_id is not valid")
    data = {"name": "f", "game_id": "f"}
    create_and_print(data)


def game_id_is_valid_but_nonexistent():
    print("\nTEST: game_id is valid but nonexistent")
    data = {"name": "f", "game_id": uuid.uuid4()}
    create_and_print(data)


def crud():
    print("\nTEST: crud path")
    with DummyGame as game_id:
        session_id = dummy_session(game_id)

        gotten = get_session(session_id)
        print("get session after create:")
        pprint(gotten)

        gotten = update_session(session_id, {"name": "updated_name"})
        print("get session after update:")
        print(gotten)

        delete_session(session_id)

        sessions = get_sessions()
        print("get sessions after delete:")
        pprint(sessions['object'])


def add_player_to_session():
    print("\nTEST: add player to session")
    with DummyGame() as game_id:
        session_id = dummy_session(game_id)
        player_id = dummy_player()

        add = add_to_session(session_id, {"player_id": player_id})
        indentprint(add)

        gotten = get_session(session_id)
        print("get session after player add:")
        indentprint(gotten)

        remove_from_session(session_id, {"player_id": player_id})

        gotten = get_session(session_id)
        print("get session after player delete:")
        indentprint(gotten)

        delete_player(player_id)
        delete_session(session_id)


def add_players_and_get():
    print("\nTEST: add player to session and get, the nremove")
    with DummyGame() as game_id:
        session_id = dummy_session(game_id)
        for i in range(0, 4):
            player_id = dummy_player()
            add_to_session(session_id, {"player_id": player_id})

        players = get_players(session_id)
        if players["success"]:
            players = players["object"]
            print(f"players in session '{session_id}':")
            pprint(players)

        for player in players:
            player_id = player["id"]
            remove_from_session(session_id, {"player_id": player_id})
            delete_player(player_id)

        players = get_players(session_id)
        if players["success"]:
            players = players["object"]
            print(f"players in session '{session_id}' after delete:")
            pprint(players)

        delete_session(session_id)


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


if __name__ == "__main__":
    # missing_name()
    # name_is_not_str()
    # missing_game_id()
    # game_id_is_not_str()
    # game_id_is_not_valid()
    # game_id_is_valid_but_nonexistent()
    # crud()
    add_player_to_session()
    add_players_and_get()
    add_after_starting()
