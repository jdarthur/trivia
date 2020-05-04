"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""

import bson

from mongo_manager import MongoManager
from flask import Flask, jsonify, request
app = Flask(__name__)

from mongo_manager import MongoManager

from validator import (model, succeed, fail, RestField, IdField,
                       ListOfIds, ListOfType)
from validator import (SUCCESS, ERROR, ERRORS, OBJECT, CREATE,
                       UPDATE, DELETE, GET_ONE, GET_ALL)


NAME = "name"
ROUNDS = "rounds"
ID = "id"
ROUND = "round"
CATEGORY = "category"
QUESTION = "question"
ANSWER = "answer"
QUESTIONS = "questions"
WAGERS = "wagers"
ROUNDS_USED = "rounds_used"
ERROR = "error"
TEXT_FILTER = "text_filter"
UNUSED_ONLY = "unused_only"

ROUND_ID = "round_id"
QUESTION_ID = "QUESTION_ID"

MONGO_HOST = "localhost"
MONGO_DB = "trivia"

mongo = MongoManager(MONGO_HOST, MONGO_DB)

@app.route('/api/question', methods=['POST'])
def create_one_question():
    created = create_question(request.json)
    if created[SUCCESS]:
        return jsonify(created[OBJECT])
    return jsonify({ERRORS: created[ERRORS]})


qmodel = [
    RestField(QUESTION),
    RestField(ANSWER),
    RestField(CATEGORY)
]
@model(qmodel, CREATE, "question")
def create_question(data):
    created = mongo.create("question", data)
    if not created:
        return fail(errors="Failed to create question")
    return succeed(fix_id(created))


@app.route('/api/question/<question_id>', methods=['DELETE'])
def delete_one_question(question_id):
    success, resp = delete_question(question_id)
    if success:
        return jsonify(resp)
    return jsonify({ERROR : resp})


@model(qmodel, DELETE, "question")
def delete_question(question_id, question={}):
    mongo.delete("question", question_id)
    remove_question_from_all_rounds(question_id)
    return question


@model(qmodel, GET_ONE, "question")
def get_question(question_id, question={}):
    return succeed(fix_id(question))


@app.route('/api/question/<question_id>', methods=['PUT'])
def update_one_question(question_id):
    updated = update_question(question_id, request.json)
    if updated[SUCCESS]:
        return jsonify(updated[OBJECT])
    return jsonify({ERRORS: updated[ERRORS]})


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
    return fail(errors=[f"Failed to update {QUESTION} with data {data}"])


@app.route('/api/questions', methods=['GET'])
def get_all_questions():
    text_filter = request.args.get(TEXT_FILTER, None)
    unused_only = request.args.get(UNUSED_ONLY, False)

    return jsonify({QUESTIONS: get_questions(text_filter, unused_only)})


def get_questions(text_filter=None, unused_only=True):
    ret = []
    questions = mongo.get_all("question")
    if questions:
        for q in questions:
            if matches(q, text_filter, unused_only):
                ret.append(fix_id(q))
    return ret


def matches(question, text_filter, unused_only):
    return matches_text_filter(question, text_filter) and matches_unused_only(question, unused_only)


def matches_text_filter(question, text_filter):
    if text_filter is None:
        return True

    for field in [QUESTION, ANSWER, CATEGORY]:
        if text_filter in question[field]:
            return True

    print("does not match {} '{}': {}".format(TEXT_FILTER, text_filter, question))
    return False


def matches_unused_only(question, unused_only):
    if not unused_only:
        return True

    match = len(question.get(ROUNDS_USED, [])) == 0
    if not match:
        print("does not match {} '{}': {}".format(UNUSED_ONLY, unused_only, question))
        return False
    return True


def fix_id(data):
    if data is None:
        return None

    new = {}
    for key in data:
        if key == "_id":
            new[ID] = str(data[key])
        else:
            new[key] = data[key]
    return new


def valid_round(data):
    valid, error = exists_and_type(data, NAME, str)
    if not valid:
        return False, error

    valid, error = exists_and_type(data, QUESTIONS, list)
    if not valid:
        return False, error

    valid, error = exists_and_type(data, WAGERS, list)
    if not valid:
        return False, error

    if len(data[QUESTIONS]) != len(data[WAGERS]):
        return False, "{} length ({}) does not equal "\
            "{} length ({}). (data: {})".format(WAGERS, len(data[WAGERS]),
                                                QUESTIONS, len(data[QUESTIONS]), data)

    for wager in data[WAGERS]:

        if not isinstance(wager, int):
            return False, "wager '{}' is not int (data: {})".format(wager, data)

        if wager <= 0:
            return False, "wager '{}' is not positive int (data: {})".format(wager, data)

    for question_id in data[QUESTIONS]:

        if data[QUESTIONS].count(question_id) > 1:
            return False, "question id '{}' used more than once (data: {})".format(question_id, data)

        valid, err = valid_question_id(question_id, data)
        if not valid:
            return False, err

    return True, None


add_r2q_model = [
    IdField(ROUND_ID, "round")
]
@model(add_r2q_model, UPDATE, "question")
def add_round_to_question(question_id, data, question={}):
    round_id = data[ROUND_ID]
    rounds_used = question.get(ROUNDS_USED, [])
    if round_id in rounds_used:
        raise RuntimeError(f"Round {round_id} is already added to question {question_id}")

    success = mongo.push("question", question_id, ROUNDS_USED, round_id)
    if not success:
        return fail(error=f"Failed to add {ROUND} to {QUESTION}")

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
        return fail(error=f"Failed to remove {ROUND} from {QUESTION}")

    rounds_used.remove(round_id)
    question[ROUNDS_USED] = rounds_used
    return succeed(question)


@model([], UPDATE, "question")
def remove_question_from_all_rounds(question_id, data={}, question={}):
    rounds_used = question.get(ROUNDS_USED, [])
    for round_id in rounds_used:
        success = mongo.pull("round", round_id, QUESTIONS, question_id)
        if not success:
            return fail(error=f"Failed to remove {QUESTION} {question_id} from {ROUND} {round_id}")

    return succeed(question)


def set_round_in_questions(round_obj, orig_questions=[]):

    round_id = str(round_obj.get("_id"))
    questions = round_obj.get(QUESTIONS, [])

    for question_id in questions:
        if question_id not in orig_questions:
            add_round_to_question(question_id, {ROUND_ID: round_id})

    for question_id in orig_questions:

        if question_id not in questions:
            remove_round_from_question(question_id, {ROUND_ID: round_id})

rmodel = [
    RestField(NAME),
    ListOfIds(QUESTIONS, "question", optional=True),
    ListOfType(WAGERS, "wagers", optional=True)
]

@model(rmodel, CREATE, "round")
def create_round(data):
    if len(data[QUESTIONS]) != len(data[WAGERS]):
        return fail(errors=[   "wager"])

            f"{WAGERS} length ({len(data[WAGERS])}) does not equal "\
            "{QUESTIONS} length ({}) (data: {data}))".format(WAGERS, len(data[WAGERS]),
                                                QUESTIONS, len(data[QUESTIONS]), data)

    created = editor.create_round(data)
    if not created:
        return False, "Failed to create round"

    set_round_in_questions(created, []) #no original questions, new round

    return True, fix_id(created)

def delete_round(round_id):
    exists = get_round(round_id)
    if exists:
        success = editor.delete_round(round_id)

        if success:
            delete_round_from_all_games(round_id)

            questions = exists.get(QUESTIONS, [])
            for question_id in questions:
                remove_round_from_question(question_id, round_id)
        else:
            return False

    return True


def update_round(round_id, data, set_questions=True):
    exists = editor.get_round(round_id)
    if exists:
        orig_questions = exists.get(QUESTIONS, [])
        success = editor.update_round(round_id, data)

        if success and set_questions:
            exists[QUESTIONS] = data.get(QUESTIONS, orig_questions)
            set_round_in_questions(exists, orig_questions)
        return True
    return False

def get_round(round_id):
    return fix_id(editor.get_round(round_id))

def get_rounds():
    ret = []
    rounds = editor.get_rounds()
    for r in rounds:
        ret.append(fix_id(r))
    return ret

def delete_round_from_all_games(round_id):
    games = get_games()
    for game in games:
        rounds = game.get(ROUNDS, [])
        if round_id in rounds:
            rounds.remove(round_id)
        update_game(game.get(ID), {ROUNDS: rounds})

def get_games():
    ret = []
    games = editor.get_games()
    for g in games:
        ret.append(fix_id(g))
    return ret

def get_game(game_id):
    valid, resp = valid_game_id(game_id, None)
    if valid:
        return True, fix_id(resp)
    return False, resp

def create_game(data):
    valid, err = valid_game(data)
    if not valid:
        return False, err

    created = editor.create_game(data)
    if not created:
        return False, "Failed to create game"

    return True, fix_id(data)

def update_game(game_id, data):
    exists = editor.get_game(game_id)
    if exists:
        return editor.update_game(game_id, data)

def delete_game(game_id):
    exists, error = get_game(game_id)
    if exists:
        return editor.delete_game(game_id)

def valid_game(data):
    valid, error = exists_and_type(data, NAME, str)
    if not valid:
        return False, error

    valid, error = exists_and_type(data, ROUNDS, list)
    if not valid:
        return False, error

    rounds = data[ROUNDS]
    for round_id in rounds:

        if rounds.count(round_id) > 1:
            return False, "round id '{}' used more than once (data: {})".format(round_id, data)

        valid, error = valid_round_id(round_id, data)
        if not valid:
            return False, error

    return True, None

def valid_round_id(round_id, game):

    if not isinstance(round_id, str):
        return False, "round_id '{}' is not str (data: {})".format(round_id, game)

    try:
        if get_round(round_id) is None:
            return False, "round with ID '{}' does not exist (data: {})".format(round_id, game)

    except bson.errors.InvalidId:
        return False, "round_id '{}' is not valid (data: {})".format(round_id, game)

    return True, None

def valid_game_id(game_id, session):

    if not isinstance(game_id, str):
        return False, "game_id '{}' is not str (data: {})".format(game_id, session)

    try:
        game = editor.get_game(game_id)
        if game is None:
            return False, "game with ID '{}' does not exist (data: {})".format(game_id, session)
        return True, game

    except bson.errors.InvalidId:
        return False, "game_id '{}' is not valid (data: {})".format(game_id, session)

    return True, None

if __name__ == "__main__":

    app.run(host="0.0.0.0", debug=True)
