import uuid
from pprint import pprint
from random import randint
from gameplay_server import (create_session, delete_session, get_session, get_sessions,
update_session, add_to_session, remove_from_session, create_player, delete_player,
get_players, start_session)
from editor_server import create_game, delete_game

"""
===============================
            HELPERS
===============================
"""

def dummy_game():
    gdata = {
        "name" : "test game",
        "rounds" : []
    }

    created, game_obj = create_game(gdata)
    if created:
        return game_obj["id"]

    return None

def dummy_session(game_id):
    sdata = {
        "name" : "test session",
        "game_id" : game_id
    }

    created = create_session(sdata)
    print(created)
    if created["success"]:
        return created["object"]["id"]
    return None

def dummy_player():
    pdata = {"player_name": f"test team {randint(1, 100000)}"}
    created = create_player(pdata)
    if created["success"]:
        return created["object"]["id"]
    return None

"""
===============================
            TESTS
===============================
"""

def missing_name():
    print("\nTEST: session is missing name attribute")
    data = {}
    pprint(create_session(data))

def name_is_not_str():
    print("\nTEST: name attribute is not str")
    data = {"name": []}
    pprint(create_session(data))

def missing_game_id():
    print("\nTEST: session is missing game_id")
    data = {"name": "f"}
    pprint(create_session(data))

def game_id_is_not_str():
    print("\nTEST: game_id is not str")
    data = {"name": "f", "game_id":[]}
    pprint(create_session(data))

def game_id_is_not_valid():
    print("\nTEST: game_id is not valid")
    data = {"name": "f", "game_id":"f"}
    pprint(create_session(data))

def game_id_is_valid_but_nonexistent():
    print("\nTEST: game_id is valid but nonexistent")
    data = {"name": "f", "game_id": uuid.uuid4()}
    pprint(create_session(data))

def crud():
    print("\nTEST: crud path")
    game_id = dummy_game()
    session_id = dummy_session(game_id)
    print(session_id)

    gotten = get_session(session_id)
    print("get session after create:")
    pprint(gotten)

    gotten = update_session(session_id, {"name" : "updated_name"})
    print("get session after update:")
    print(gotten)

    delete_session(session_id)

    sessions = get_sessions()
    print("get sessions after delete:")
    pprint(sessions['object'])

    delete_game(game_id)

def add_player_to_session():
    print("\nTEST: add player to session")
    game_id = dummy_game()
    session_id = dummy_session(game_id)
    player_id = dummy_player()

    add = add_to_session(session_id, {"player_id": player_id})
    print(add)

    gotten = get_session(session_id)
    print("get session after player add:")
    pprint(gotten)

    remove = remove_from_session(session_id, {"player_id": player_id})

    gotten = get_session(session_id)
    print("get session after player delete:")
    pprint(gotten)

    delete_player(player_id)
    delete_session(session_id)
    delete_game(game_id)

def add_players_and_get():
    print("\nTEST: add player to session")
    game_id = dummy_game()
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




if __name__ =="__main__":
    missing_name()
    name_is_not_str()
    missing_game_id()
    game_id_is_not_str()
    game_id_is_not_valid()
    game_id_is_valid_but_nonexistent()
    crud()
    add_player_to_session()
    add_players_and_get()
    add_after_starting()


