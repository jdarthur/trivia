"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""

import bson
from datetime import datetime

from mongo_manager import GamePlayer

from validator import model, succeed, fail, get, FIELD, OPTIONAL, TYPE
from validator import SUCCESS, ERROR, ERRORS, OBJECT, CREATE, UPDATE, DELETE, GET_ONE, GET_ALL

from flask import Flask, jsonify, request


app = Flask(__name__)

NAME = "name"
GAME_ID = "game_id"
MODERATOR = "mod"

PLAYERS = "players"
PLAYER_NAME = "player_name"
PLAYER_ID = "player_id"

SESSION_ID = "session_id"
CREATE_DATE = "create_date"

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

smodel = [
	{ FIELD: NAME, TYPE: str },
	{ FIELD: GAME_ID, TYPE: str },
	{ FIELD: MODERATOR, TYPE: str, OPTIONAL: True},
]
@model(smodel, CREATE)
def create_session(data):
	"""
	POST /session
	"""
	#game ID must be legit
	resp = get("game", data[GAME_ID])
	if not resp[SUCCESS]:
		return fail(errors=[resp[ERROR]])


	session = player.create("session", data)
	session_id = str(session["_id"])

	mod = create_player_in_session(session_id)
	if not mod[SUCCESS]:
		return fail(errors=mod[ERRORS])

	resp = set_mod(session_id, mod[OBJECT][ID])
	if not resp[SUCCESS]:
		return fail(errors=resp[ERRORS])

	return succeed(fix_id(resp[OBJECT]))

@model(smodel, GET_ONE, "session")
def get_session(session_id, session={}):
	"""
	GET /session/:id?player_id=<mod_or_player_id>
	"""
	return succeed(fix_id(session))

@model(smodel, UPDATE, "session")
def update_session(session_id, data, session={}):
	success = player.update_session(session_id, data)
	if success:
		session.update(data)
		return succeed(session)
	return fail(errors=[f"Failed to update session with data {data}"])

@model(smodel, DELETE, "session")
def delete_session(session_id, session={}):
	player.delete("session", session_id)
	return session

def get_sessions():
	ret = []
	sessions = player.get_all("session")
	if sessions:
		for s in sessions:
			ret.append(fix_id(s))
	return succeed(ret)

def set_mod(session_id, mod_id):
	resp = get("player", mod_id)
	if not resp[SUCCESS]:
		return fail(errors=[resp[ERROR]])

	return update_session(session_id, {MODERATOR: mod_id})

"""
=====================================
               PLAYER
=====================================
"""

pmodel = [
	{ FIELD: SESSION_ID, TYPE: str },
	{ FIELD: CREATE_DATE, TYPE: datetime },
]

def create_player_in_session(session_id):
	timestamp = datetime.utcnow()
	obj = create_player({SESSION_ID: session_id, CREATE_DATE: timestamp})
	return obj

@model(pmodel, CREATE)
def create_player(data):
	obj = player.create("player", data)
	return succeed(fix_id(obj))

@model(pmodel, UPDATE, "player")
def update_player(player_id, data):

	resp = get("session", data[GAME_ID])
	if not resp[SUCCESS]:
		return fail(errors=[resp[ERROR]])

	session_id = data.get(session_id, None)
	if session_id in data:
		resp = get("session", session_id)
		if not resp[SUCCESS]:
			return fail(errors=[resp[ERROR]])


	success = player.update("session", session_id, data)
	if success:
		session.update(data)
		return succeed(session)

	return fail(errors=[f"Failed to update session with data {data}"])

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


if __name__ == "__main__":

	app.run(host="0.0.0.0", debug=True)
