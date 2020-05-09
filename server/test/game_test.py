from editor_server import (create_round, delete_round)
from editor_server import (create_game, delete_game, get_game,
                           update_game, get_games, delete_question)

from .rounds_tests import indentprint
from .questions_tests import dummy_question


class DummyGame(object):
    def __init__(self, rounds=1, questions_per_round=1, return_class=False):
        self.rcount = rounds
        self.qcount = questions_per_round
        self.return_class = return_class

    def __enter__(self):
        self.rounds = []
        self.questions = []
        for i in range(0, self.rcount):
            rqs = []
            for j in range(0, self.qcount):
                question_id = dummy_question()
                self.questions.append(question_id)
                rqs.append(question_id)

            r = dummy_round(rqs)
            print(r)
            self.rounds.append(r)

        self.game_id = dummy_game(self.rounds)
        if self.return_class:
            return self
        return self.game_id

    def __exit__(self, type, value, traceback):

        delete_game(self.game_id)

        for round_id in self.rounds:
            delete_round(round_id)

        for question_id in self.questions:
            delete_question(question_id)


def create_and_print(data):
    created = create_game(data)
    print("created:")
    indentprint(created)
    return created


def dummy_round(question_ids):
    wagers = []
    for i in range(0, len(question_ids)):
        wagers.append(i + 1)
    rdata = {
        "name": "test round",
        "questions": question_ids,
        "wagers": wagers
    }
    created = create_round(rdata)
    if created["success"]:
        return created["object"]["id"]
    print(created)
    return None


def dummy_game(rounds):
    gdata = {
        "name": "test game",
        "rounds": rounds
    }
    created = create_game(gdata)
    if created["success"]:
        return created["object"]["id"]
    print(created)
    return None


def test_missing_name():
    print("\nTEST: game is missing name attribute")
    data = {}
    created = create_and_print(data)
    assert created["success"] is False


def test_missing_rounds():
    print("\nTEST: game is missing rounds attribute")
    data = {"name": "f"}
    create_and_print(data)


def test_rounds_is_not_list():
    print("\nTEST: rounds attribute is not list")
    data = {"name": "f", "rounds": "f"}
    create_and_print(data)


def test_round_id_not_str():
    print("\nTEST: round ID is not str")
    data = {"name": "f", "rounds": [1]}
    create_and_print(data)


def test_round_id_not_valid():
    print("\nTEST: round ID is not valid")
    data = {"name": "f", "rounds": ["fff"]}
    create_and_print(data)


def test_round_id_valid_but_nonexistent():
    print("\nTEST: round ID is valid but nonexistent")
    data = {"name": "f", "rounds": ["5e9c82c83e9f1b817df277aa"]}
    create_and_print(data)


def test_round_id_duplicated():
    print("\nTEST: round ID is duplicated")
    data = {"name": "f", "rounds": ["5e9c82c83e9f1b817df277aa",
                                    "5e9c82c83e9f1b817df277aa"]}
    create_and_print(data)


def test_crud():
    print("\nTEST: crud path")
    with DummyGame(return_class=True) as game:
        game_id = game.game_id
        round_id = game.rounds[0]

        game = get_game(game_id)

        print("game created:")
        assert game["success"]
        print(game)

        updated = update_game(game_id, {"game": []})
        assert updated["success"]

        all_games = get_games()
        print("   all games after update: {}".format(all_games))

        success = delete_game(game_id)

        all_games = get_games()
        print("   all games after delete: {}".format(all_games))


def test_round_removed_from_game_when_deleted():
    print("\nTEST: round is removed from games when round is deleted")
    with DummyGame(return_class=True) as game:
        game_id = game.game_id
        round_id = game.rounds[0]

        gotten = get_game(game_id)
        print("game before round delete:")
        indentprint(gotten)

        delete_round(round_id)

        gotten = get_game(game_id)
        print("game after round delete:")
        indentprint(game)
