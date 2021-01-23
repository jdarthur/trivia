import pprint
from random import randint
import os
import sys
sys.path.append(os.path.join("..", "src"))

from .api_calls import (create_question, get_question, get_questions,
                        update_question, delete_question,
                        create_round, delete_round,
                        create_game, delete_game,
                        create_session, start_session, add_to_session, delete_session,
                        create_player, delete_player)

# from editor_server import (create_question, create_round, create_game,
#                            delete_question, delete_round, delete_game)

# from gameplay_server import (create_player, create_session, delete_player,
#                              delete_session, start_session, add_to_session)


def has_errors(response):
    return response.get("errors", None) is not None


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
    if has_errors(created) is True:
        return None
    return created["id"]


class DummyQuestion(object):
    def __init__(self):
        self.question_id = None

    def __enter__(self):
        self.question_id = dummy_question()
        return self.question_id

    def __exit__(self, type, value, traceback):
        delete_question(self.question_id)


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
    print(created)
    if has_errors(created) is True:
        return None
    return created["id"]


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
    print(created)
    if has_errors(created) is True:
        return None
    return created["id"]


def dummy_session(game_id):
    sdata = {
        "name": "test session",
        "game_id": game_id
    }

    created = create_session(sdata)
    print(created)
    if has_errors(created):
        return None
    return created


def dummy_player():
    pdata = {
        "team_name": f"test team {randint(1, 100000)}",
        "real_name": "Jim Bibby"
    }
    print("create player ")
    created = create_player(pdata)
    print(created)
    if has_errors(created):
        return None
    return created["id"]


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
            print("created round:")
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
        self.session = dummy_session(self.game.game_id)
        self.session_id = self.session["id"]
        self.mod_id = self.session["mod"]

        self.players = []
        for i in range(0, self.pcount):
            player_id = dummy_player()
            self.players.append(player_id)
            add_to_session(self.session_id, {"player_id": player_id})

        start_session(self.session_id)
        return self

    def __exit__(self, type, value, traceback):

        self.game.__exit__(type, value, traceback)
        delete_session(self.session_id, self.mod)
        for player_id in self.players:
            delete_player(player_id)
