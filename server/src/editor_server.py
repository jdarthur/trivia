"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask.json import JSONEncoder
from datetime import datetime

from mongo_manager import MongoManager

from validator import (model, succeed, fail, RestField,
                       ListOfIds, ListOfType, get_all, DictOfIds)
from validator import (SUCCESS, ERRORS, OBJECT, CREATE,
                       UPDATE, DELETE, GET_ONE, ID)




load_dotenv()
debug = os.environ.get("debug").upper() == 'TRUE'

class CustomJSONEncoder(JSONEncoder):
    def default(self, obj):
        try:
            if isinstance(obj, datetime):
                return obj.isoformat()
            iterable = iter(obj)
        except TypeError:
            pass
        else:
            return list(iterable)
        return JSONEncoder.default(self, obj)


app = Flask(__name__)
app.json_encoder = CustomJSONEncoder

NAME = "name"
ROUNDS = "rounds"
ROUND = "round"
GAME = "game"
CATEGORY = "category"
QUESTION = "question"
ANSWER = "answer"
QUESTIONS = "questions"
WAGERS = "wagers"
ROUNDS_USED = "rounds_used"
TEXT_FILTER = "text_filter"
UNUSED_ONLY = "unused_only"

ROUND_ID = "round_id"
QUESTION_ID = "question_id"
ROUND_NAMES = "round_names"
GAMES = "games"

MONGO_HOST = "localhost"
MONGO_DB = "trivia"
URL_BASE = "/editor"

mongo = MongoManager(MONGO_HOST, MONGO_DB)


"""
===================================================
                   QUESTION API
===================================================
"""

"""
==============================
        API ENDPOINTS
==============================
"""
@app.route(f'{URL_BASE}/question', methods=['POST'])
def create_one_question():
    return create_and_respond("question", request.json)


@app.route(f'{URL_BASE}/question/<question_id>', methods=['GET'])
def get_one_question(question_id):
    return get_and_respond("question", question_id)


@app.route(f'{URL_BASE}/question/<question_id>', methods=['DELETE'])
def delete_one_question(question_id):
    return delete_and_respond("question", question_id)


qmodel = [
    RestField(QUESTION),
    RestField(ANSWER),
    RestField(CATEGORY)
]
@model(qmodel, CREATE, "question")
def create_question(data):
    created = mongo.create("question", data)
    if not created:
        return fail("Failed to create question")
    return succeed(created)


@app.route(f'{URL_BASE}/questions', methods=['GET'])
def get_all_questions():
    text_filter = request.args.get(TEXT_FILTER, None)
    unused_only = request.args.get(UNUSED_ONLY, False)
    if (unused_only.lower() == "false"):
        unused_only = False
    questions = get_questions(text_filter, unused_only)
    if not questions[SUCCESS]:
        return jsonify(questions)
    return jsonify({QUESTIONS: questions[OBJECT]})


"""
==============================
        API HELPERS
==============================
"""
@model(qmodel, GET_ONE, "question")
def get_question(question_id, question={}):
    return succeed(question)


@app.route(f'{URL_BASE}/question/<question_id>', methods=['PUT'])
def update_one_question(question_id):
    updated = update_question(question_id, request.json)
    if updated[SUCCESS]:
        return jsonify(updated[OBJECT])
    return jsonify({ERRORS: updated[ERRORS]}), 400


@model(qmodel, UPDATE, "question")
def update_question(question_id, data, question={}):
    """
    returns
         True/false if update successful
    """
    success = mongo.update("question", question_id, data)
    if success:
        question.update(data)
        return succeed(question)
    return fail(f"Failed to update {QUESTION} with data {data}")


def get_questions(text_filter=None, unused_only=True):
    ret = []
    questions = get_all("question")
    for q in questions:
        if matches(q, text_filter, unused_only, ROUNDS_USED, QUESTION):
            ret.append(q)
    return succeed(ret)


@model(qmodel, DELETE, "question")
def delete_question(question_id, question={}):
    mongo.delete("question", question_id)
    removed = remove_question_from_all_rounds(question)
    if not removed[SUCCESS]:
        return removed
    return succeed(question)

"""
==============================
        MISC HELPERS
==============================
"""
def matches(question, text_filter, unused_only, unused_only_key, data_type):
    return matches_text_filter(question, text_filter, data_type) and matches_unused_only(question, unused_only, unused_only_key)


def matches_text_filter(question, text_filter, data_type):
    if text_filter is None:
        return True

    if data_type == QUESTION:
        for field in [QUESTION, ANSWER, CATEGORY]:
            if text_filter.lower() in question[field].lower():
                return True
    if data_type == ROUND:
        for field in [NAME]:
            if text_filter.lower() in question[field].lower():
                return True

    # print("does not match {} '{}': {}".format(TEXT_FILTER, text_filter, question))
    return False


def matches_unused_only(question, unused_only, unused_only_key):
    if not unused_only:
        return True

    match = len(question.get(unused_only_key, [])) == 0
    if not match:
        # print("does not match {} '{}': {}".format(UNUSED_ONLY, unused_only, question))
        return False
    return True


add_r2q_model = [
    RestField(ROUND_ID,)
]
@model(add_r2q_model, UPDATE, "question")
def add_round_to_question(question_id, data, question={}):
    round_id = data[ROUND_ID]
    rounds_used = question.get(ROUNDS_USED, [])
    if round_id in rounds_used:
        raise RuntimeError(f"Round {round_id} is already added to question {question_id}")

    success = mongo.push("question", question_id, ROUNDS_USED, round_id)
    if not success:
        return fail(f"Failed to add {ROUND} to {QUESTION}")

    rounds_used.append(round_id)
    question[ROUNDS_USED] = rounds_used
    return succeed(question)


@model(add_r2q_model, UPDATE, "question")
def remove_round_from_question(question_id, data, question={}):
    round_id = data[ROUND_ID]
    rounds_used = question.get(ROUNDS_USED, [])
    if round_id not in rounds_used:
        raise RuntimeError(f"Round {round_id} is not added to question {question_id}")

    success = mongo.pull("question", question_id, ROUNDS_USED, round_id)
    if not success:
        return fail(f"Failed to remove {ROUND} from {QUESTION}")

    rounds_used.remove(round_id)
    question[ROUNDS_USED] = rounds_used
    return succeed(question)


def remove_question_from_all_rounds(question):
    rounds_used = question.get(ROUNDS_USED, [])
    question_id = question.get(ID)
    for round_id in rounds_used:
        modified_count = mongo.pull("round", round_id, QUESTIONS, question_id)
        if modified_count == 0:
            return fail(f"Failed to remove {QUESTION} {question_id} from {ROUND} {round_id}")

    return succeed(question)


def set_round_in_questions(round_obj, orig_questions=[]):
    round_id = round_obj[ID]
    questions = round_obj.get(QUESTIONS, [])

    for question_id in questions:
        if question_id not in orig_questions:
            add_round_to_question(question_id, {ROUND_ID: round_id})

    for question_id in orig_questions:
        if question_id not in questions:
            remove_round_from_question(question_id, {ROUND_ID: round_id})





"""
====================================================
                       ROUNDS
====================================================
"""

"""
==============================
        API ENDPOINTS
==============================
"""
rmodel = [
    RestField(NAME),
    ListOfIds(QUESTIONS, "question"),
    ListOfType(WAGERS, int)
]
@app.route(f'{URL_BASE}/round', methods=['POST'])
def create_one_round():
    return create_and_respond("round", request.json)


@app.route(f'{URL_BASE}/round/<round_id>', methods=['PUT'])
def update_one_round(round_id):
    return update_and_respond("round", round_id, request.json)


@app.route(f'{URL_BASE}/round/<round_id>', methods=['DELETE'])
def delete_one_round(round_id):
    return delete_and_respond("round", round_id)

@app.route(f'{URL_BASE}/round/<round_id>', methods=['GET'])
def get_one_round(round_id):
    return get_and_respond("round", round_id)


@app.route(f'{URL_BASE}/rounds', methods=['GET'])
def get_all_rounds():
    text_filter = request.args.get(TEXT_FILTER, None)
    unused_only = request.args.get(UNUSED_ONLY, False)
    rounds = get_rounds(text_filter, unused_only)
    if not rounds[SUCCESS]:
        return jsonify(rounds)
    return jsonify({ROUNDS: rounds[OBJECT]})


"""
=========================
      API HELPERS
=========================
"""
@model(rmodel, CREATE, "round")
def create_round(data):
    validate = validate_wagers(data)
    if not validate[SUCCESS]:
        return validate

    created = mongo.create("round", data)
    if not created:
        return fail("Failed to create round")

    set_round_in_questions(created, [])  # no original questions, new round
    return succeed(created)


@model(rmodel, DELETE, "round")
def delete_round(round_id, round_obj={}):

    success = mongo.delete("round", round_id)
    if success:

        deleted = delete_round_from_all_games(round_id)
        if not deleted[SUCCESS]:
            return deleted

        questions = round_obj.get(QUESTIONS, [])
        for question_id in questions:
            removed = remove_round_from_question(question_id, {ROUND_ID: round_id})
            if not removed[SUCCESS]:
                return removed

        return succeed(round_obj)


@model(rmodel, UPDATE, "round")
def update_round(round_id, data, round_obj={}, set_questions=True):
    validate = validate_wagers(data)
    if not validate[SUCCESS]:
        return validate

    orig_questions = round_obj.get(QUESTIONS, [])
    success = mongo.update("round", round_id, data)
    if success:
        if set_questions:
            round_obj[QUESTIONS] = data.get(QUESTIONS, orig_questions)
            set_round_in_questions(round_obj, orig_questions)
        return succeed(round_obj)
    return fail(f"Failed to update round")


@model(rmodel, GET_ONE, "round")
def get_round(round_id, round_obj={}):
    return succeed(round_obj)


def get_rounds(text_filter=None, unused_only=True):
    ret = []
    rounds = get_all("round")
    for r in rounds:
        if matches(r, text_filter, unused_only, GAMES, ROUND):
            ret.append(r)
    return succeed(ret)


"""
==============================
        MISC HELPERS
==============================
"""
def delete_round_from_all_games(round_id):
    """
    don't need to validate round_id because this is called
    inside delete_round where round_id is already validated
    """
    games = get_games()[OBJECT]
    for game in games:
        game_id = game[ID]
        mongo.pull("game", game_id, ROUNDS, round_id)
    return succeed({})

def validate_wagers(data):
    qlen = len(data.get(QUESTIONS, []))
    wlen = len(data.get(WAGERS, []))
    if qlen != wlen:
        error = f"{WAGERS} length ({wlen}) does not equal {QUESTIONS} length ({qlen}) (data: {data}))"
        return fail(error)

    for wager in data.get(WAGERS, []):
        if wager <= 0:
            return fail(f"Wager '{wager}' is not positive int")
    return succeed(data)


"""
====================================================
                       GAMES
====================================================
"""

"""
=========================
      API ENDPOINTS
=========================
"""
@app.route(f'{URL_BASE}/game/<game_id>', methods=['GET'])
def get_one_game(game_id):
    return get_and_respond("game", game_id)


@app.route(f'{URL_BASE}/game', methods=['POST'])
def create_one_game():
    return create_and_respond("game", request.json)


@app.route(f'{URL_BASE}/game/<game_id>', methods=['PUT'])
def update_one_game(game_id):
    return update_and_respond("game", game_id, request.json)


@app.route(f'{URL_BASE}/game/<game_id>', methods=['DELETE'])
def delete_one_game(game_id):
    return delete_and_respond("game", game_id)

@app.route(f'{URL_BASE}/games', methods=['GET'])
def get_all_games():
    games = get_games()
    if not games[SUCCESS]:
        return jsonify(games)
    return jsonify({GAMES: games[OBJECT]})


"""
=========================
      API_HELPERS
=========================
"""
gmodel = [
    RestField(NAME),
    ListOfIds(ROUNDS, "round"),
    DictOfIds(ROUND_NAMES, "round")
]
@model(gmodel, GET_ONE, "game")
def get_game(game_id, game={}):
    return succeed(game)


@model(gmodel, CREATE, "game")
def create_game(data):

    round_names = data[ROUND_NAMES]
    rounds = data[ROUNDS]

    if len(round_names) != len(rounds):
        return fail(f"{ROUND_NAMES} is different length ({len(round_names)}) than {ROUNDS} ({len(rounds)})")

    for round_id in rounds:
        if round_names.get(round_id, None) is None:
            return fail(f"missing round name for round with id {round_id})")

    created = mongo.create("game", data)
    if not created:
        return fail("Failed to create game")

    # add game_id to all rounds, and return error if this fails
    game_id = created[ID]
    rupdate = rounds_have_game_id(rounds, game_id)
    if not rupdate:
        return rupdate

    return succeed(created)


def rounds_have_game_id(rounds, game_id):
    """
    set state of round so that all rounds in list have
    game_id in their games list
    """
    for round_id in rounds:
        added = set_round_and_game_id(round_id, game_id, True)
        if not added:
            return added
    return succeed(rounds)


def rounds_do_not_have_game_id(rounds, game_id):
    """
    set state of round so that all rounds in list
    do not have game_id in their games list
    """
    for round_id in rounds:
        added = set_round_and_game_id(round_id, game_id, False)
        if not added: return added
    return succeed(rounds)


def set_round_and_game_id(round_id, game_id, present=True):
    """
    set round so that it has or does not have game_id in its games list

    args:
        round_id: ID of target round
        game_id: ID of target game
        present: true if round X is marked as in game Y, false if not
    """
    round = get_round(round_id)
    if not round:
        return fail(f"Can't set game_id {game_id} in nonexistent round_id {round_id}")
    round = round[OBJECT]

    games = round.get(GAMES, [])
    if present and game_id not in games:
        if not mongo.push("round", round_id, GAMES, game_id):
            return fail(f"Failed to add game_id {game_id} to round_id {round_id}")

    if not present and game_id in games:
        if not mongo.pull("round", round_id, GAMES, game_id):
            return fail(f"Failed to remove game_id {game_id} to round_id {round_id}")

    return succeed(round)


@model(gmodel, UPDATE, "game")
def update_game(game_id, data, game={}):

    round_names = data.get(ROUND_NAMES, {})
    rounds = data.get(ROUNDS, [])

    if len(round_names) != len(rounds):
        return fail(f"{ROUND_NAMES} is different length ({len(round_names)}) than {ROUNDS} ({len(rounds)})")

    for round_id in rounds:
        if round_names.get(round_id, None) is None:
            return fail(f"missing round name for round with id {round_id})")


    prev_rounds = game.get(ROUNDS, [])
    target_rounds = data.get(ROUNDS, [])
    for round_id in prev_rounds:
        if round_id not in target_rounds:
            set_round_and_game_id(round_id, game_id, False)  # remove game_id from round

    for round_id in target_rounds:
        if round_id not in prev_rounds:
            set_round_and_game_id(round_id, game_id, True)  # add game_id to round

    if len(round_names) == 0 or len(rounds) == 0:
        data[ROUND_NAMES] = {}
        data[ROUNDS] = {}

    success = mongo.update("game", game_id, data)
    if success:
        game.update(data)
        return succeed(game)
    return fail(f"Failed to update game with data {data}")


@model(gmodel, DELETE, "game")
def delete_game(game_id, game={}):
    mongo.delete("game", game_id)

    rounds = game.get(ROUNDS, [])
    rupdate = rounds_do_not_have_game_id(rounds, game_id)
    if not rupdate:
        return rupdate

    return succeed(game)

def get_games():
    return succeed(get_all("game"))




"""
======================================
        COMMON ENDPOINT HELPERS
======================================
"""
def _resp(op_resp, error=400):
    """
    take fail/succeed response and return flask response
    """
    if op_resp[SUCCESS]:
        return jsonify(op_resp[OBJECT])
    return jsonify({ERRORS: op_resp[ERRORS]}), error


def create_and_respond(endpoint, data):
    """
    try to create some object and return a failure/success resp
    """
    if endpoint == "round":
        return _resp(create_round(data))
    if endpoint == "game":
        return _resp(create_game(data))
    if endpoint == "question":
        return _resp(create_question(data))

    raise Exception(f"unsupported create '{endpoint}'")


def update_and_respond(endpoint, object_id, data):
    """
    try to update some object and return a failure/success resp
    """
    if endpoint == "round":
        return _resp(update_round(object_id, data))
    if endpoint == "game":
        return _resp(update_game(object_id, data))
    if endpoint == "question":
        return _resp(update_question(object_id, data))

    raise Exception(f"unsupported update '{endpoint}'")


def delete_and_respond(endpoint, object_id):
    """
    try to delete some object and return a failure/success resp
    """
    if endpoint == "round":
        return _resp(delete_round(object_id))
    if endpoint == "game":
        return _resp(delete_game(object_id))
    if endpoint == "question":
        return _resp(delete_question(object_id))

    raise Exception(f"unsupported delete '{endpoint}'")

def get_and_respond(endpoint, object_id):
    """
    try to get some object and return a failure/success resp
    """
    if endpoint == "round":
        return _resp(get_round(object_id), 404)
    if endpoint == "game":
        return _resp(get_game(object_id), 404)
    if endpoint == "question":
        return _resp(get_question(object_id), 404)

    raise Exception(f"unsupported get '{endpoint}'")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=6000, debug=debug)
