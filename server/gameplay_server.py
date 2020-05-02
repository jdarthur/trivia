"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""

import bson
from datetime import datetime

from mongo_manager import GamePlayer

from validator import model, succeed, fail, FIELD, OPTIONAL, TYPE, RestField, IdField
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

mongo = GamePlayer(MONGO_HOST, MONGO_DB)

smodel = [
	RestField(NAME),
	IdField(GAME_ID, "game"),
	IdField(MODERATOR, "player", optional=True)
]
@model(smodel, CREATE, "session")
def create_session(data):
	"""
	POST /session
	"""
	mod = create_player({})
	if not mod[SUCCESS]:
		return fail(errors=mod[ERRORS])

	mod_id = str(mod[OBJECT][ID])

	#create session with this moderator ID
	data[MODERATOR] = mod_id
	created = mongo.create("session", data)
	if not created:
		return fail(errors=[f"Failed to create session"])
	created = fix_id(created)

	# resp = update_player(mod_id, {SESSION_ID: created[ID]})
	# if not resp[SUCCESS]:
	# 	return fail(errors=resp[ERRORS])

	return succeed(created)

@model(smodel, GET_ONE, "session")
def get_session(session_id, session={}):
	"""
	GET /session/:id?player_id=<mod_or_player_id>
	"""
	return succeed(fix_id(session))

@model(smodel, UPDATE, "session")
def update_session(session_id, data, session={}):
	success = mongo.update("session", session_id, data)
	if success:
		session.update(data)
		return succeed(session)
	return fail(errors=[f"Failed to update session with data {data}"])

@model(smodel, DELETE, "session")
def delete_session(session_id, session={}):
	mongo.delete("session", session_id)
	return session

def get_sessions():
	ret = []
	sessions = mongo.get_all("session")
	if sessions:
		for s in sessions:
			ret.append(fix_id(s))
	return succeed(ret)

"""
=====================================
               PLAYER
=====================================
"""

pmodel = [
	RestField(PLAYER_NAME, optional=True),
	IdField(SESSION_ID, "session", optional=True)
]
@model(pmodel, CREATE, "player")
def create_player(data):
	data[CREATE_DATE] = datetime.utcnow()
	obj = mongo.create("player", data)
	return succeed(fix_id(obj))

@model(pmodel, UPDATE, "player")
def update_player(player_id, data, player={}):
	success = mongo.update("player", player_id, data)
	if success:
		player.update(data)
		return succeed(player)
	return fail(errors=[f"Failed to update player with data {data}"])

@model(pmodel, DELETE, "player")
def delete_player(player_id, player={}):
	mongo.delete("player", player_id)
	return player


join_model = [
	IdField(PLAYER_ID, "player"),
]

@model(join_model, UPDATE, "session")
def add_to_session(session_id, data, player={}):
	"""
	POST /session/:id/join
	"""
	player_id = data[PLAYER_ID]
	success = mongo.push("session", session_id, PLAYERS, player_id)
	if not success:
		return fail(error="Failed to add player to session")

	data[SESSION_ID] = session_id
	return succeed(data)

def get_players(session_id):
	ret = []
	sessions = mongo.get_all("session")
	if sessions:
		for s in sessions:
			ret.append(fix_id(s))
	return succeed(ret)

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
