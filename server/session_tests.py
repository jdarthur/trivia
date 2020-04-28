from gameplay_server import create_session, delete_session, get_session, get_sessions
from editor_server import create_game, delete_game

def missing_name():
    print("\nTEST: session is missing name attribute")
    data = {}
    created, msg = create_session(data)
    print("   {}".format(msg))

def name_is_not_str():
    print("\nTEST: name attribute is not str")
    data = {"name": []}
    created, msg = create_session(data)
    print("   {}".format(msg))

def missing_game_id():
    print("\nTEST: session is missing game_id")
    data = {"name": "f"}
    created, msg = create_session(data)
    print("   {}".format(msg))

def game_id_is_not_str():
    print("\nTEST: game_id is not str")
    data = {"name": "f", "game_id":[]}
    created, msg = create_session(data)
    print("   {}".format(msg))

def game_id_is_not_valid():
    print("\nTEST: game_id is not valid")
    data = {"name": "f", "game_id":"f"}
    created, msg = create_session(data)
    print("   {}".format(msg))


def game_id_is_valid_but_nonexistent():
    print("\nTEST: game_id is valid but nonexistent")
    data = {"name": "f", "game_id":"5e9c82c83e9f1b817df277aa"}
    created, msg = create_session(data)
    print("   {}".format(msg))

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

        created, session = create_session(sdata)
        if created:
            session_id = session["id"]
            valid, session = get_session(session_id)
            print("   get session after create: {}".format(session))

            delete_session(session_id)

            sessions = get_sessions()
            print("   get sessions after delete: {}".format(sessions))

        delete_game(game_id)


if __name__ =="__main__":
    missing_name()
    name_is_not_str()
    missing_game_id()
    game_id_is_not_str()
    game_id_is_not_valid()
    game_id_is_valid_but_nonexistent()
    crud()

