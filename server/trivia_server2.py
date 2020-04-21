"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""

import bson
import os


import uuid
import yaml

from pprint import pprint
from mongo_manager import GameEditor
from flask import Flask, jsonify
app = Flask(__name__)

ROUND_FILENAME = "round.txt"
SINGLE_Q_FILENAME = "question.txt"
Q_INDEX = "q-index"
CATEG_FILE = "category.txt"
GAMES_DIR = "games"

NAME = "name"
ROUNDS = "rounds"
ROUND = "round"
CATEGORY = "category"
QUESTION = "question"
ANSWER = "answer"
QUESTIONS = "questions"
WAGERS = "wagers"
ROUNDS_USED = "rounds_used"

MONGO_HOST = "localhost"
MONGO_DB = "trivia"

editor = GameEditor(MONGO_HOST, MONGO_DB)

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

def delete_question(question_id):
	"""
	returns True if deleted
	"""
	return editor.delete_question(question_id)

def get_question(question_id):
	"""
	returns
	 	question as dict if ID is valid
	 	None if question_id is invalid
	"""
	return fix_id(editor.get_question(question_id))

def update_question(question_id, data):
	"""
	returns
	 	True/false if update successful
	"""
	return editor.update_question(question_id, data)
	

def get_questions():
	ret = []
	questions = editor.get_questions()
	for q in questions:
		ret.append(fix_id(q))
	return ret



def fix_id(data):
	if data is None:
		return None

	new = {}
	for key in data:
		if key == "_id":
			new["id"]= str(data[key])
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

	if len(data[QUESTIONS]) !=  len(data[WAGERS]):
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
		if get_question(question_id) is None:
			return False, "question with ID '{}' does not exist (data: {})".format(question_id, data)
	except bson.errors.InvalidId:
		return False, "question_id '{}' is not valid (data: {})".format(question_id, data)

	return True, None

def set_round_in_questions(round_obj):

	round_id = str(round_obj.get("_id"))
	questions = round_obj.get(QUESTIONS, [])
	
	for question_id in questions:

		rounds_used = get_question(question_id).get(ROUNDS_USED, [])
		if round_id not in rounds_used:
			rounds_used.append(round_id)
			update_question(question_id, {ROUNDS_USED: rounds_used})
		else:
			print("Round {} is already added to question {}".format(round_id, question_id))
	

def create_round(data):
	valid, err = valid_round(data)
	if not valid: 
		return False, err

	created = editor.create_round(data)
	if not created:
		return False, "Failed to create round"

	set_round_in_questions(created)

	return True, fix_id(created)

def delete_round(round_id):
	return editor.delete_round(round_id)

def update_round(round_id, data):
	success = editor.update_round(round_id, data)
	if success:
		set_round_in_questions(data)
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

def delete_round_from_question(round_id, question_id):
	pass

def delete_question_from_round(question_id, round_id):
	pass



if __name__ == "__main__":
    games = get_games()
    pprint(games)




