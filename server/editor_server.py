"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""

from mongo_manager import MongoManager

from validator import (model, succeed, fail, RestField,
                       ListOfIds, ListOfType, get_all)
from validator import (SUCCESS, ERRORS, OBJECT, CREATE,
                       UPDATE, DELETE, GET_ONE, ID)

from flask import Flask, jsonify, request
app = Flask(__name__)


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
QUESTION_ID = "QUESTION_ID"

MONGO_HOST = "localhost"
MONGO_DB = "trivia"
URL_BASE = "/editor"

mongo = MongoManager(MONGO_HOST, MONGO_DB)


@app.route(f'{URL_BASE}/question', methods=['POST'])
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
        return fail("Failed to create question")
    return succeed(created)


@app.route(f'{URL_BASE}/question/<question_id>', methods=['DELETE'])
def delete_one_question(question_id):
    resp = delete_question(question_id)
    if resp[SUCCESS]:
        return jsonify(resp[OBJECT])
    return jsonify({ERRORS: resp[ERRORS]})


@model(qmodel, DELETE, "question")
def delete_question(question_id, question={}):
    mongo.delete("question", question_id)
    remove_question_from_all_rounds(question)
    return succeed(question)


@model(qmodel, GET_ONE, "question")
def get_question(question_id, question={}):
    return succeed(question)


@app.route(f'{URL_BASE}/question/<question_id>', methods=['PUT'])
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
    return fail(f"Failed to update {QUESTION} with data {data}")


@app.route(f'{URL_BASE}/questions', methods=['GET'])
def get_all_questions():
    text_filter = request.args.get(TEXT_FILTER, None)
    unused_only = request.args.get(UNUSED_ONLY, False)

    return jsonify({QUESTIONS: get_questions(text_filter, unused_only)})


def get_questions(text_filter=None, unused_only=True):
    ret = []
    questions = get_all("question")
    for q in questions:
        if matches(q, text_filter, unused_only):
            ret.append(q)
    return ret


def matches(question, text_filter, unused_only):
    return matches_text_filter(question, text_filter) and matches_unused_only(question, unused_only)


def matches_text_filter(question, text_filter):
    if text_filter is None:
        return True

    for field in [QUESTION, ANSWER, CATEGORY]:
        if text_filter in question[field]:
            return True

    # print("does not match {} '{}': {}".format(TEXT_FILTER, text_filter, question))
    return False


def matches_unused_only(question, unused_only):
    if not unused_only:
        return True

    match = len(question.get(ROUNDS_USED, [])) == 0
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


rmodel = [
    RestField(NAME),
    ListOfIds(QUESTIONS, "question"),
    ListOfType(WAGERS, int)
]


@model(rmodel, CREATE, "round")
def create_round(data):
    qlen = len(data.get(QUESTIONS, []))
    wlen = len(data.get(WAGERS, []))
    if qlen != wlen:
        error = f"{WAGERS} length ({wlen}) does not equal {QUESTIONS} length ({qlen}) (data: {data}))"
        return fail(error)

    for wager in data.get(WAGERS, []):
        if wager <= 0:
            return fail(f"Wager '{wager}' is not positive int")

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
    orig_questions = round_obj.get(QUESTIONS, [])
    success = mongo.update("round", round_id, data)
    if success:
        if set_questions:
            round_obj[QUESTIONS] = data.get(QUESTIONS, orig_questions)
            return set_round_in_questions(round_obj, orig_questions)
        return succeed(round_obj)
    return fail(f"Failed to update round")


@model(rmodel, GET_ONE, "round")
def get_round(round_id, round_obj={}):
    return succeed(round_obj)


def get_rounds():
    return get_all("round")


def delete_round_from_all_games(round_id):
    """
    don't need to validate round_id because this is called
    inside delete_round where round_id is already validated
    """
    games = get_games()
    for game in games:
        game_id = game[ID]
        mongo.pull("game", game_id, ROUNDS, round_id)
    return succeed({})


def get_games():
    return get_all("game")


gmodel = [
    RestField(NAME),
    ListOfIds(ROUNDS, "round")
]


@model(gmodel, GET_ONE, "game")
def get_game(game_id, game={}):
    return succeed(game)


@model(gmodel, CREATE, "game")
def create_game(data):
    created = mongo.create("game", data)
    if not created:
        return fail("Failed to create game")

    return succeed(created)


@model(gmodel, UPDATE, "game")
def update_game(game_id, data, game={}):
    success = mongo.update("game", game_id, data)
    if success:
        game.update(data)
        return succeed(game)
    return fail(f"Failed to update game with data {data}")


@model(gmodel, DELETE, "game")
def delete_game(game_id, game={}):
    mongo.delete("game", game_id)
    return game


if __name__ == "__main__":

    app.run(host="0.0.0.0", port=6000, debug=True)
