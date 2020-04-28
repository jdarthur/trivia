"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""

import bson

from mongo_manager import GameEditor
from flask import Flask, jsonify, request
app = Flask(__name__)

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

MONGO_HOST = "localhost"
MONGO_DB = "trivia"

editor = GameEditor(MONGO_HOST, MONGO_DB)

@app.route('/api/question', methods=['POST'])
def create_one_question():
	data = {
		QUESTION: request.json[QUESTION],
		ANSWER: request.json[ANSWER],
		CATEGORY: request.json[CATEGORY]
	}
	success, resp = create_question(data)
	if success:
		return jsonify(resp)

	return jsonify({ERROR : resp})

def create_question(question):
	"""
	returns
		False, error message if question is invalid
		True, created_object if question is valid
	"""

	valid, error = valid_question(question)
	if not valid:
		return False, error

	created = editor.create_question(question)
	if not created:
		return False, "Failed to create question"

	return True, fix_id(created)

@app.route('/api/question/<question_id>', methods=['DELETE'])
def delete_one_question(question_id):
	success, resp = delete_question(question_id)
	if success:
		return jsonify(resp)
	return jsonify({ERROR : resp})



def delete_question(question_id):
	"""
	returns True if deleted
	"""
	exists, resp = get_question(question_id)
	if exists:
		success = editor.delete_question(question_id)
		if success:
			success, err = remove_question_from_all_rounds(resp)
			if not success:
				return False, err
			return True, resp
		return False, "Failed to delete"

	return True, None

def get_question(question_id):
	"""
	returns
	 	question as dict if ID is valid
	 	None if question_id is invalid
	"""
	valid, resp = valid_question_id(question_id, None)
	if valid:
		return True, fix_id(resp)
	return False, resp

@app.route('/api/question/<question_id>', methods=['PUT'])
def update_one_question(question_id):
	data = {
		QUESTION: request.json[QUESTION],
		ANSWER: request.json[ANSWER],
		CATEGORY: request.json[CATEGORY]
	}
	valid, invalid_question_err = valid_question(data)
	if valid:
		success, resp = update_question(question_id, data)
		if success:
			return jsonify(resp)
		return jsonify({ERROR : resp})
	return jsonify({ERROR : invalid_question_err})

def update_question(question_id, data):
	"""
	returns
	 	True/false if update successful
	"""
	exists, resp = get_question(question_id)
	if exists:
		success = editor.update_question(question_id, data)
		if success:
			return True, data
		return False, "unable to update question"

	return False, resp

@app.route('/api/questions', methods=['GET'])
def get_all_questions():
	text_filter = request.args.get(TEXT_FILTER, None)
	unused_only = request.args.get(UNUSED_ONLY, False)

	return jsonify({QUESTIONS : get_questions(text_filter, unused_only)})

def get_questions(text_filter=None, unused_only=True):
	ret = []
	questions = editor.get_questions()
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

def valid_question(q):
	"""
	is this question valid?
	"""
	for attribute_name in [QUESTION, ANSWER, CATEGORY]:
		valid, error = exists_and_type(q, attribute_name, str)
		if not valid:
			return False, error

	return True, None

def exists_and_type(question, attribute, expected_type):
	attr = question.get(attribute, None)

	if attr is None:
		return False, "Missing attribute '{}' (data: {})".format(attribute, question)

	if not isinstance(attr, expected_type):
		return False, "Attribute '{}' is not {}. (data: {})".format(attribute, expected_type, question)

	return True, None


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

def valid_question_id(question_id, data):

	if not isinstance(question_id, str):
		return False, "question_id '{}' is not str (data: {})".format(question_id, data)

	try:
		question = editor.get_question(question_id)
		if question is None:
			return False, "question with ID '{}' does not exist (data: {})".format(question_id, data)

		return True, question

	except bson.errors.InvalidId:
		return False, "question_id '{}' is not valid (data: {})".format(question_id, data)

	return False, None

def add_round_to_question(question_id, round_id):

	exists, question = get_question(question_id)
	if exists:
		rounds_used = question.get(ROUNDS_USED, [])
		if round_id in rounds_used:
		    raise RuntimeError("Round {} is already added to question {}".format(round_id, question_id))

		rounds_used.append(round_id)
		return update_question(question_id, {ROUNDS_USED: rounds_used})
	return False


def remove_round_from_question(question_id, round_id):
	exists, question = get_question(question_id)
	if exists:
		rounds_used = question.get(ROUNDS_USED, [])
		if round_id not in rounds_used:
			raise RuntimeError("Round {} is not added to question {}".format(round_id, question_id))

		rounds_used.remove(round_id)
		return update_question(question_id, {ROUNDS_USED: rounds_used})
	return False

def remove_question_from_all_rounds(question):
	rounds_used = question.get(ROUNDS_USED, [])

	question_id = question.get(ID)
	for round_id in rounds_used:
		questions = get_round(round_id).get(QUESTIONS)
		questions.remove(question_id)
		success, err = update_round(round_id, {QUESTIONS: questions}, False)
		if not success:
			return False, err
	return True, rounds_used

def set_round_in_questions(round_obj, orig_questions=[]):

	round_id = str(round_obj.get("_id"))
	questions = round_obj.get(QUESTIONS, [])

	for question_id in questions:
		if question_id not in orig_questions:
			add_round_to_question(question_id, round_id)

	for question_id in orig_questions:

		if question_id not in questions:
			remove_round_from_question(question_id, round_id)

def create_round(data):
	valid, err = valid_round(data)
	if not valid:
		return False, err

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
