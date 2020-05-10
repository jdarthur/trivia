from editor_server import delete_round
from editor_server import (create_game, delete_game, get_game,
                           update_game, get_games)
from .test_helpers import object_with_id_in_list, indentprint, DummyGame


def create_and_print(data):
    created = create_game(data)
    print("created:")
    indentprint(created)
    return created


def test_missing_name():
    print("\nTEST: game is missing name attribute")
    data = {}
    created = create_and_print(data)
    assert created["success"] is False


def test_missing_rounds():
    print("\nTEST: game is missing rounds attribute")
    data = {"name": "f"}
    created = create_and_print(data)
    assert created["success"] is False


def test_rounds_is_not_list():
    print("\nTEST: rounds attribute is not list")
    data = {"name": "f", "rounds": "f"}
    created = create_and_print(data)
    assert created["success"] is False


def test_round_id_not_str():
    print("\nTEST: round ID is not str")
    data = {"name": "f", "rounds": [1]}
    created = create_and_print(data)
    assert created["success"] is False


def test_round_id_not_valid():
    print("\nTEST: round ID is not valid")
    data = {"name": "f", "rounds": ["fff"]}
    created = create_and_print(data)
    assert created["success"] is False


def test_round_id_valid_but_nonexistent():
    print("\nTEST: round ID is valid but nonexistent")
    data = {"name": "f", "rounds": ["5e9c82c83e9f1b817df277aa"]}
    created = create_and_print(data)
    assert created["success"] is False


def test_round_id_duplicated():
    print("\nTEST: round ID is duplicated")
    data = {"name": "f", "rounds": ["5e9c82c83e9f1b817df277aa",
                                    "5e9c82c83e9f1b817df277aa"]}
    created = create_and_print(data)
    assert created["success"] is False


def test_crud():
    print("\nTEST: crud path")
    with DummyGame(rounds=2, return_class=True) as game:
        game_id = game.game_id
        round_id = game.rounds[1]

        game = get_game(game_id)

        print("game created:")
        assert game["success"]
        print(game)

        updated = update_game(game_id, {"rounds": [round_id]})
        assert updated["success"]

        all_games = get_games()
        print("   all games after update: {}".format(all_games))
        assert object_with_id_in_list(all_games, game_id, True)

        success = delete_game(game_id)
        assert success

        all_games = get_games()
        print("   all games after delete: {}".format(all_games))
        assert object_with_id_in_list(all_games, game_id, False)


def test_round_removed_from_game_when_deleted():
    print("\nTEST: round is removed from games when round is deleted")
    with DummyGame(return_class=True) as game:
        game_id = game.game_id
        round_id = game.rounds[0]

        gotten = get_game(game_id)
        print("game before round delete:")
        indentprint(gotten)
        assert gotten['object']['rounds'][0] == round_id

        delete_round(round_id)

        gotten = get_game(game_id)
        print("game after round delete:")
        indentprint(game)
        assert len(gotten['object']['rounds']) == 0
