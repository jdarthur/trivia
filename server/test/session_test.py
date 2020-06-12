import uuid
from gameplay_server import (create_session, delete_session, get_session, get_sessions,
                             update_session, add_to_session, remove_from_session,
                             delete_player, get_players)
from .test_helpers import (indentprint, DummyGame, dummy_session,
                           object_with_id_in_list, dummy_player)

"""
===============================
            HELPERS
===============================
"""


def create_and_print(data):
    session = create_session(data)
    if session['success']:
        session = session['object']
    indentprint(session)
    return session


"""
===============================
            TESTS
===============================
"""


def test_missing_name():
    print("\nTEST: session is missing name attribute")
    data = {}
    created = create_and_print(data)
    assert created['success'] is False


def test_name_is_not_str():
    print("\nTEST: name attribute is not str")
    data = {"name": []}
    created = create_and_print(data)
    assert created['success'] is False


def test_missing_game_id():
    print("\nTEST: session is missing game_id")
    data = {"name": "f"}
    created = create_and_print(data)
    assert created['success'] is False


def test_game_id_is_not_str():
    print("\nTEST: game_id is not str")
    data = {"name": "f", "game_id": []}
    created = create_and_print(data)
    assert created['success'] is False


def test_game_id_is_not_valid():
    print("\nTEST: game_id is not valid")
    data = {"name": "f", "game_id": "f"}
    created = create_and_print(data)
    assert created['success'] is False


def test_game_id_is_valid_but_nonexistent():
    print("\nTEST: game_id is valid but nonexistent")
    data = {"name": "f", "game_id": uuid.uuid4()}
    created = create_and_print(data)
    assert created['success'] is False


def test_crud():
    print("\nTEST: crud path")
    with DummyGame() as game_id:
        session_id = dummy_session(game_id)

        gotten = get_session(session_id)
        print("get session after create:")
        assert gotten["success"]

        gotten = update_session(session_id, {"name": "updated_name"})
        print("get session after update:")
        assert gotten['object']['name'] == 'updated_name'

        delete_session(session_id)

        sessions = get_sessions()
        print("get sessions after delete:")
        assert object_with_id_in_list(sessions['object'], session_id, False)


def test_add_player_to_session():
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


def test_add_players_and_get():
    print("\nTEST: add player to session and get, the nremove")
    with DummyGame() as game_id:
        print("begin test_add_players_and_get")
        session_id = dummy_session(game_id)
        print("after session create")
        for i in range(0, 4):
            player_id = dummy_player()
            print(player_id)
            add_to_session(session_id, {"player_id": player_id})

        players = get_players(session_id)
        assert players['success']

        players = players["object"]
        print(f"players in session '{session_id}':")
        assert len(players) == 4

        for player in players:
            player_id = player["id"]
            remove_from_session(session_id, {"player_id": player_id})
            delete_player(player_id)

        players = get_players(session_id)
        assert players['success']
        players = players["object"]

        print(f"players in session '{session_id}' after delete:")
        assert len(players) == 0

        delete_session(session_id)
