from .api_calls import (create_game, delete_game, get_game,
                        update_game, get_games, get_round, delete_round)
from .test_helpers import object_with_id_in_list, indentprint, DummyGame, DummyRound, has_errors


def create_and_print(data):
    created = create_game(data)
    print("created:")
    indentprint(created)
    return created


def test_rounds_is_not_list():
    print("\nTEST: rounds attribute is not list")
    data = {"name": "f", "rounds": "f"}
    created = create_and_print(data)
    assert has_errors(created) == True


def test_round_id_not_str():
    print("\nTEST: round ID is not str")
    data = {"name": "f", "rounds": [1]}
    created = create_and_print(data)
    assert has_errors(created) == True


def test_round_id_not_valid():
    print("\nTEST: round ID is not valid")
    data = {"name": "f", "rounds": ["fff"]}
    created = create_and_print(data)
    assert has_errors(created) == True


def test_round_id_valid_but_nonexistent():
    print("\nTEST: round ID is valid but nonexistent")
    data = {"name": "f", "rounds": ["5e9c82c83e9f1b817df277aa"]}
    created = create_and_print(data)
    assert has_errors(created) == True


def test_round_id_duplicated():
    print("\nTEST: round ID is duplicated")
    data = {"name": "f", "rounds": ["5e9c82c83e9f1b817df277aa",
                                    "5e9c82c83e9f1b817df277aa"]}
    created = create_and_print(data)
    assert has_errors(created) == True


def test_round_missing_name():
    with DummyRound() as round_id:
        with DummyRound() as round_id2:

            data = {
                "name": "f",
                "rounds": [round_id],
                "round_names": {round_id2: "f"}
            }

        created = create_and_print(data)
        assert has_errors(created) == True


def test_more_round_names_than_rounds():
    with DummyRound() as round_id:
        data = {
            "name": "f",
            "rounds": [],
            "round_names": {round_id: "f"}
        }

        created = create_and_print(data)
        assert has_errors(created) == True


def test_more_rounds_than_round_names():
    with DummyRound() as round_id:
        data = {
            "name": "f",
            "rounds": [round_id],
            "round_names": {}
        }

        created = create_and_print(data)
        assert has_errors(created) == True


def test_crud():
    print("\nTEST: crud path")
    with DummyGame(rounds=2, return_class=True) as game:
        game_id = game.game_id
        round_id = game.rounds[1]

        game = get_game(game_id)

        import time

        print("game created:")
        print(game)
        assert has_errors(game) is False
        print(game)

        updated = update_game(game_id, {"rounds": [round_id], "round_names": {round_id: "test1234"}})
        print(updated)
        assert has_errors(updated) == False

        all_games = get_games()
        print("   \n all games after update: {}".format(all_games))
        assert object_with_id_in_list(all_games, game_id, True)

        success = delete_game(game_id)
        assert success

        all_games = get_games()
        print("\n   all games after delete: {}".format(all_games))
        assert object_with_id_in_list(all_games, game_id, False)


def test_round_removed_from_game_when_deleted():
    print("\nTEST: round is removed from games when round is deleted")
    with DummyGame(return_class=True) as game:
        game_id = game.game_id
        round_id = game.rounds[0]

        gotten = get_game(game_id)
        print("game before round delete:")
        indentprint(gotten)
        assert gotten['rounds'][0] == round_id

        delete_round(round_id)

        gotten = get_game(game_id)
        print("game after round delete:")
        indentprint(gotten)
        assert len(gotten['rounds']) == 0

def test_game_added_and_removed_in_round():
    """
    create game with round
     - round should have games: [:game_id]
    remove round from game
     - round should have games: []
    """
    with DummyGame(return_class=True) as game:
        game_id = game.game_id
        round_id = game.rounds[0]

        round = get_round(round_id)
        assert len(round.get("games", [])) == 1
        assert round.get("games", [])[0] == game_id

        update = update_game(game_id, {"rounds": []})
        print("update game: ")
        print(update)

        round = get_round(round_id)
        print("updated round after: ")
        print(round)

        assert len(round.get("games", [])) == 0

        assert len(update["round_names"]) == 0
        indentprint(round)

def test_game_removed_from_round_when_deleted():
    """
    create game with round
     - round should have games: [:game_id]
    delete game
     - round should have games: []
    """
    with DummyGame(return_class=True) as game:
        game_id = game.game_id
        round_id = game.rounds[0]


        round = get_round(round_id)
        assert len(round.get("games", [])) == 1
        assert round.get("games", [])[0] == game_id

        delete_game(game_id)
        round = get_round(round_id)
        assert len(round.get("games", [])) == 0
        indentprint(round)
