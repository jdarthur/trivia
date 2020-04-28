"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""

import bson
from datetime import datetime

from mongo_manager import GamePlayer
from editor_server import get_game
from flask import Flask, jsonify, request


app = Flask(__name__)

NAME = "name"
GAME_ID = "game_id"
MODERATOR = "mod"

PLAYERS = "players"
PLAYER_NAME = "player_name"
PLAYER_ID = "player_id"

ROUNDS = "rounds"
ID = "id"
ROUND = "round"
CATEGORY = "category"
QUESTION = "question"
ANSWER = "answer"
QUESTIONS = "questions"
WAGERS = "wagers"
ROUNDS_USED = "rounds_used"

MONGO_HOST = "localhost"
MONGO_DB = "trivia"

player = GamePlayer(MONGO_HOST, MONGO_DB)

@app.route('/api/question', methods=['POST'])
def create_one_question():
	data = {
		QUESTION: request.json['question'],
		ANSWER: request.json["answer"],
		CATEGORY: request.json["category"]
	}
	success, resp = create_question(data)
	if success:
		return jsonify(resp)

	return jsonify({"error" : resp})

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

def create_session(data):
	"""
	POST /session
	"""
	valid, err = session_is_valid(data)
	if not valid:
		return False, err

	session = player.create_session(data)
	if session:
		session_id = str(session["_id"])
		mod = create_player(session_id)
		session[MODERATOR] = mod[ID]

	return True, fix_id(session)

def session_is_valid(session):

	valid, err = exists_and_type(session, NAME, str)
	if not valid:
		return False, err

	valid, err = exists_and_type(session, GAME_ID, str)
	if not valid:
		return False, err

	valid, resp = get_game(session[GAME_ID])
	if not valid:
		return False, resp

	return True, None

def get_session(session_id, player_id=None):
	"""
	GET /session/:id?player_id=<mod_or_player_id>
	"""
	valid, resp = valid_session_id(session_id)
	if not valid:
		return False, resp

	print(resp)
	if player_id != resp[MODERATOR]:
		for player in resp.get(PLAYERS, []):
			del player[PLAYER_ID]

	return True, resp

def valid_session_id(session_id):
	if not isinstance(session_id, str):
		return False, "session_id '{}' is not str".format(session_id)
	try:
		game = player.get_session(session_id)
		if game is None:
			return False, "session with ID '{}' does not exist".format(session_id)
		return True, game

	except bson.errors.InvalidId:
		return False, "session_id '{}' is not valid".format(session_id)


def delete_session(session_id):
	exists, err = get_session(session_id)
	if exists:
		return player.delete_session(session_id)


def create_player(session_id):
	timestamp = datetime.utcnow()
	return fix_id(player.create_player(session_id, {"create_date": timestamp}))

def join_session(session_id):
	"""
	POST /session/:id/player
	"""


def update_player(session_id, player_id):
	"""
	PUT /session/:id/player/:id
	"""

def remove_player(session_id, player_id):
	"""
	DELETE /session/:id/player/:id
	"""

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

def exists_and_type(question, attribute, expected_type):
	attr = question.get(attribute, None)

	if attr is None:
		return False, "Missing attribute '{}' (data: {})".format(attribute, question)

	if not isinstance(attr, expected_type):
		return False, "Attribute '{}' is not {}. (data: {})".format(attribute, expected_type, question)

	return True, None


if __name__ == "__main__":

	app.run(host="0.0.0.0", debug=True)
