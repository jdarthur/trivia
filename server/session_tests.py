from pprint import pprint
from gameplay_server import create_session, delete_session, get_session, get_sessions, update_session
from editor_server import create_game, delete_game

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
    data = {"name": "f", "game_id":"5e9c82c83e9f1b817df277aa"}
    pprint(create_session(data))

def crud():
    print("\nTEST: crud path")
    gdata = {
        "name" : "test game",
        "rounds" : []
    }

    created, game_obj = create_game(gdata)
    if created:
        game_id = game_obj["id"]

        sdata = {
            "name" : "test session",
            "game_id" : game_id
        }

        created = create_session(sdata)
        if created["success"]:
            session = created["object"]
            session_id = session["id"]

            gotten = get_session(session_id)
            if gotten["success"]:
                print("get session after create:")
                pprint(gotten['object'])

            gotten = update_session(session_id, {"name" : "updated_name"})
            if gotten["success"]:
                print("get session after update:")
                pprint(gotten['object'])

            delete_session(session_id)

            sessions = get_sessions()
            print("get sessions after delete:")
            pprint(sessions['object'])

        delete_game(game_id)


if __name__ =="__main__":
    missing_name()
    name_is_not_str()
    missing_game_id()
    game_id_is_not_str()
    game_id_is_not_valid()
    game_id_is_valid_but_nonexistent()
    crud()

