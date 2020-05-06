from editor_server import (create_round, delete_round)
from editor_server import (create_game, delete_game, get_game,
                           update_game, get_games)

from rounds_tests import indentprint


def create_and_print(data):
    created = create_game(data)
    print("created:")
    indentprint(created)
    return created


def dummy_round():
    rdata = {
        "name": "test round",
        "questions": [],
        "wagers": []
    }
    created = create_round(rdata)
    if created["success"]:
        return created["object"]["id"]
    return None


def dummy_game(rounds=[]):
    gdata = {
        "name": "test game",
        "rounds": rounds
    }
    created = create_game(gdata)
    if created["success"]:
        return created["object"]["id"]

    return None


def missing_name():
    print("\nTEST: game is missing name attribute")
    data = {}
    create_and_print(data)


def missing_rounds():
    print("\nTEST: game is missing rounds attribute")
    data = {"name": "f"}
    create_and_print(data)


def rounds_is_not_list():
    print("\nTEST: rounds attribute is not list")
    data = {"name": "f", "rounds": "f"}
    create_and_print(data)


def round_id_not_str():
    print("\nTEST: round ID is not str")
    data = {"name": "f", "rounds": [1]}
    create_and_print(data)


def round_id_not_valid():
    print("\nTEST: round ID is not valid")
    data = {"name": "f", "rounds": ["fff"]}
    create_and_print(data)


def round_id_valid_but_nonexistent():
    print("\nTEST: round ID is valid but nonexistent")
    data = {"name": "f", "rounds": ["5e9c82c83e9f1b817df277aa"]}
    create_and_print(data)


def round_id_duplicated():
    print("\nTEST: round ID is duplicated")
    data = {"name": "f", "rounds": ["5e9c82c83e9f1b817df277aa",
                                    "5e9c82c83e9f1b817df277aa"]}
    create_and_print(data)


def crud():
    print("\nTEST: crud path")
    round_id = dummy_round()

    game_id = dummy_game()
    game = get_game(game_id)

    print("game created:")
    indentprint(game)

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
    round_id = dummy_round()
    game_id = dummy_game(rounds=[round_id])

    game = get_game(game_id)
    print("game before round delete:")
    indentprint(game)

    delete_round(round_id)

    game = get_game(game_id)
    print("game after round delete:")
    indentprint(game)

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
