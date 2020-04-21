from trivia_server2 import create_round, delete_round, get_round, update_round, get_rounds
from trivia_server2 import create_game, delete_game, get_game, update_game, get_games

def missing_name():
    print("\nTEST: game is missing name attribute")
    data = {}
    created, msg = create_game(data)
    print("   {}".format(msg))

def missing_rounds():
    print("\nTEST: game is missing rounds attribute")
    data = {"name": "f"}
    created, msg = create_game(data)
    print("   {}".format(msg))

def rounds_is_not_list():
    print("\nTEST: rounds attribute is not list")
    data = {"name": "f", "rounds" : "f"}
    created, msg = create_game(data)
    print("   {}".format(msg))

def round_id_not_str():
    print("\nTEST: round ID is not str")
    data = {"name": "f", "rounds" : [1]}
    created, msg = create_game(data)
    print("   {}".format(msg))

def round_id_not_valid():
    print("\nTEST: round ID is not valid")
    data = {"name": "f", "rounds" : ["fff"]}
    created, msg = create_game(data)
    print("   {}".format(msg))

def round_id_valid_but_nonexistent():
    print("\nTEST: round ID is valid but nonexistent")
    data = {"name": "f", "rounds" : ["5e9c82c83e9f1b817df277aa"]}
    created, msg = create_game(data)
    print("   {}".format(msg))

def round_id_duplicated():
    print("\nTEST: round ID is duplicated")
    data = {"name": "f", "rounds" : ["5e9c82c83e9f1b817df277aa", "5e9c82c83e9f1b817df277aa"]}
    created, msg = create_game(data)
    print("   {}".format(msg))


def crud():
    print("\nTEST: crud path")
    rdata = {
            "name": "test round",
            "questions": [],
            "wagers": []
        }
    created, round_obj = create_round(rdata)
    if created:
        round_id = round_obj["id"]

        gdata = {
            "name" : "test game",
            "rounds" : []
        }

        created, game_obj = create_game(gdata)
        if created:
            game_id = game_obj["id"]
            game = get_game(game_id)

            print("   game created: {}".format(game))

            success = update_game(game_id, {"rounds": [round_id]})
            if success:

                all_games = get_games()
                print("   all games after update: {}".format(all_games))

                success = delete_game(game_id)

                all_games = get_games()
                print("   all games after delete: {}".format(all_games))

        delete_round(round_id)


def round_removed_from_game_when_deleted():
    print("\nTEST: round is removed from games when round is deleted")
    rdata = {
            "name": "test round",
            "questions": [],
            "wagers": []
        }
    created, round_obj = create_round(rdata)
    if created:
        round_id = round_obj["id"]

        gdata = {
            "name" : "test game",
            "rounds" : [round_id]
        }

        created, game = create_game(gdata)
        if created:
            game_id = game["id"]

            game = get_game(game_id)
            print("   game rounds before round delete : {}".format(game["rounds"]))

            delete_round(round_id)

            game = get_game(game_id)
            print("   game rounds after round delete : {}".format(game["rounds"]))

            delete_game(game_id)

if __name__ == "__main__":
    missing_name()
    missing_rounds()
    rounds_is_not_list()
    round_id_not_str()
    round_id_not_valid()
    round_id_valid_but_nonexistent()
    round_id_duplicated()
    crud()
    round_removed_from_game_when_deleted()
