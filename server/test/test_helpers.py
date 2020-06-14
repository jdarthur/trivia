import pprint
from random import randint
from editor_server import (create_question, create_round, create_game,
                           delete_question, delete_round, delete_game)

from gameplay_server import (create_player, create_session, delete_player,
                             delete_session, start_session, add_to_session)


def indentprint(data):
    formatted = pprint.pformat(data).splitlines()
    for line in formatted:
        print(f"   {line}")


def object_with_id_in_list(list, object_id, is_present):
    """
    Test if object with ID x is found in list

    args:
        list: list of dicts from get_all(object_type)
        object_id: expected object id
        is_present: True if object should be in list, False if not
    """
    found = False
    for item in list:
        item_id = item['id']
        if item_id == object_id:
            found = True
            break
    return found == is_present


def dummy_question():
    """
    create a dummy question with randomized question text

    return question_id
    """
    qdata = {
        "question": f"test question {randint(1, 100000)}",
        "answer": "answer",
        "category": "category"
    }

    created = create_question(qdata)
    if created["success"]:
        return created["object"]["id"]
    return None


def dummy_round(question_ids):
    """
    create a dummy round
    args:
        question_ids: list of IDs of questions in round
    return round_id
    """
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
    return None


class DummyRound(object):
    def __init__(self, questions_per_round=1, return_class=False):
        self.qcount = questions_per_round
        self.return_class = return_class

    def __enter__(self):

        self.questions = []
        for j in range(0, self.qcount):
            question_id = dummy_question()
            self.questions.append(question_id)

        self.round_id = dummy_round(self.questions)
        print(self.round_id)

        if self.return_class:
            return self
        return self.round_id

    def __exit__(self, type, value, traceback):

        delete_round(self.round_id)

        for question_id in self.questions:
            delete_question(question_id)


def dummy_game(rounds):
    names = {}
    for i, round in enumerate(rounds):
        names[round] = f"Round {i+1}"

    gdata = {
        "name": "test game",
        "rounds": rounds,
        "round_names": names
    }

    created = create_game(gdata)
    if created["success"]:
        return created["object"]["id"]
    print(created)
    return None


def dummy_session(game_id):
    sdata = {
        "name": "test session",
        "game_id": game_id
    }

    created = create_session(sdata)
    if created["success"]:
        return created["object"]["id"]
    print(created)
    return None


def dummy_player():
    pdata = {
        "team_name": f"test team {randint(1, 100000)}",
        "real_name": "Jim Bibby"
    }
    print("create player ")
    created = create_player(pdata)
    print(created)
    if created["success"]:
        return created["object"]["id"]
    print(f"pc f{created}")
    return None


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


class DummySessionWithPlayers(object):
    def __init__(self, rounds=1, questions_per_round=1, players=1):
        self.game = DummyGame(rounds, questions_per_round)
        self.game.__enter__()
        self.pcount = players

    def __enter__(self):
        self.session_id = dummy_session(self.game.game_id)

        self.players = []
        for i in range(0, self.pcount):
            player_id = dummy_player()
            self.players.append(player_id)
            add_to_session(self.session_id, {"player_id": player_id})

        start_session(self.session_id)
        return self

    def __exit__(self, type, value, traceback):

        self.game.__exit__(type, value, traceback)
        delete_session(self.session_id)
        for player_id in self.players:
            delete_player(player_id)
