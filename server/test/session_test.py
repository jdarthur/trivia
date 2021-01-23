import uuid
from .api_calls import (create_session, delete_session, get_session, get_sessions,
                        update_session, add_to_session, remove_from_session,
                        delete_player, get_players_in_session)
from .test_helpers import (indentprint, DummyGame, dummy_session,
                           object_with_id_in_list, dummy_player, has_errors)

"""
===============================
            HELPERS
===============================
"""


def create_and_print(data):
    session = create_session(data)
    indentprint(session)
    return session


"""
===============================
            TESTS
===============================
"""


# def test_name_is_not_str():
#     print("\nTEST: name attribute is not str")
#     data = {"name": []}
#     created = create_and_print(data)
#     assert has_errors(created)


# def test_missing_game_id():
#     print("\nTEST: session is missing game_id")
#     data = {"name": "f"}
#     created = create_and_print(data)
#     assert has_errors(created)


# def test_game_id_is_not_str():
#     print("\nTEST: game_id is not str")
#     data = {"name": "f", "game_id": []}
#     created = create_and_print(data)
#     assert has_errors(created)


# def test_game_id_is_not_valid():
#     print("\nTEST: game_id is not valid")
#     data = {"name": "f", "game_id": "f"}
#     created = create_and_print(data)
#     assert has_errors(created)


# def test_game_id_is_valid_but_nonexistent():
#     print("\nTEST: game_id is valid but nonexistent")
#     data = {"name": "f", "game_id": str(uuid.uuid4())}
#     created = create_and_print(data)
#     assert has_errors(created)


def test_crud():
    print("\nTEST: crud path")
    with DummyGame() as game_id:
        session = dummy_session(game_id)
        session_id = session["id"]
        mod = session["mod"]

        gotten = get_session(session_id)
        print("get session after create:")
        print(gotten)
        assert has_errors(gotten) is False

        gotten = update_session(session_id, {"name": "updated_name", "mod": mod})
        print("get session after update:")
        print(gotten)
        assert gotten['name'] == 'updated_name'

        delete_session(session_id, mod)

        sessions = get_sessions()
        print("get sessions after delete:")
        assert object_with_id_in_list(sessions, session_id, False)


def test_add_player_to_session():
    print("\nTEST: add player to session")
    with DummyGame() as game_id:
        session = dummy_session(game_id)
        session_id = session["id"]
        mod = session["mod"]
        player_id = dummy_player()

        add = add_to_session(session_id, {"player_id": player_id})
        indentprint(add)

        gotten = get_session(session_id)
        print("get session after player add:")
        indentprint(gotten)

        remove_from_session(session_id, {"player_id": player_id, "admin_id": mod})

        gotten = get_session(session_id)
        print("get session after player delete:")
        indentprint(gotten)

        delete_player(player_id)
        delete_session(session_id, mod)


def test_add_players_and_get():
    print("\nTEST: add player to session and get, the nremove")
    with DummyGame() as game_id:
        print("begin test_add_players_and_get")
        session = dummy_session(game_id)
        session_id = session["id"]
        mod = session["mod"]
        print("after session create")
        for i in range(0, 4):
            player_id = dummy_player()
            print(player_id)
            add_to_session(session_id, {"player_id": player_id})

        players = get_players_in_session(session_id, mod=mod)
        print(f"players in session '{session_id}':")
        print(players)
        assert len(players) == 4

        for player in players:
            player_id = player["id"]
            remove_from_session(session_id, {"player_id": player_id, "admin_id": mod})
            delete_player(player_id)

        players = get_players_in_session(session_id)
        print(players)

        print(f"players in session '{session_id}' after delete:")
        assert len(players) == 0

        delete_session(session_id, mod)
