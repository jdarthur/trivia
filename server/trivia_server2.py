"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""

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
		valid, error = exists_and_str(q, attribute_name)
		if not valid:
			return False, error

	return True, None

def write_round(round, game_id):
    print("writing round {}".format(round))

def is_valid_game(game_dict):
    """
    @input
     game_dict: game JSON as dict

    return
       (true, None): if game is valid
       (false, error_message): is game is not valid
    """

    #has name
    if not isinstance(game_dict, dict):
        return False, "Data is not dict (given: {})".format(game_dict)

    if not game_dict.get(NAME, None):
        return False, "Missing root attribute '{}'".format(NAME)

    #has rounds
    rounds = game_dict.get(ROUNDS, None)
    if not rounds:
        return False, "Missing root attribute '{}'".format(ROUNDS)

    #rounds is list
    if not isinstance(rounds, list):
        return False, "Attribute '{}' is not a list".format(ROUNDS)

    for round_index, game_round in enumerate(rounds):
        if not isinstance(game_round, dict):
            return False, "item at {}.{} is not a dict".format(ROUNDS, round_index)

        round_round = game_round.get(ROUND)
        if not round_round:
            return False, "Missing attribute '{}' at {}.{}".format(ROUND, ROUNDS, round_index)

        if not isinstance(round_round, list):
            return False, "item at {}.{}.{} is not a list (given: '{}')".format(ROUNDS, round_index, ROUND, game_round)

        for question_index, question in enumerate(game_round.get("round")):

            if not isinstance(question, dict):
                return False, "item at {}.{}.{} is not a dict (given: '{}')".format(ROUNDS, round_index, question_index, question)

            #has question
            if bad_attr(question, round_index, question_index, QUESTION):
                return False, bad_attr(question, round_index, question_index, QUESTION)

            #has answer
            if bad_attr(question, round_index, question_index, ANSWER):
                return False, bad_attr(question, round_index, question_index, ANSWER)

            #has category
            if bad_attr(question, round_index, question_index, CATEGORY):
                return False, bad_attr(question, round_index, question_index, CATEGORY)


    return True, None


def exists_and_str(question, attribute):
	attr = question.get(attribute, None)

	if attr is None:
		return False, "Missing attribute '{}' (data: {})".format(attribute, question)

	if not isinstance(attr, str):
		return False, "Attribute '{}' is not str. (data: {})".format(attribute, question)

	return True, None


def bad_attr(question, round_index, question_index, attr):
    data = question.get(attr, None)
    if not data:
        return "Missing attribute '{}' at {}.{}.{} (question: '{}')".format(attr, ROUND, round_index, question_index, question)

    if not isinstance(data, str):
        return "{}.{}.{}.{} is not str (question: '{}')".format(ROUNDS, round_index, question_index, attr, question)

    return None



def write_game(game_dict):
    """
    dict has a name and a list of lists of questions.
    outer list is a game, inner list is a round
    {
        name: game1234
        rounds: [
            optional_attr: test
            round: [
                {
                    category: math,
                    question: what's 2+2?,
                    answer: allegedy, 2+2 is equal to four
                }
                {
                    category: genius math,
                    question: what's 4*4?,
                    answer: scientists have not yet computed a solution to this problem
                }
            ],
            [
                {
                    category: literature,
                    question: who's anna karenina,
                    answer: anna karenina is the woman from leo tolstoy's novel anna karenina
                }
            ]
        ]
    }

    returns:
          None: if game is not valid
          a game UUID: is game is valid
    """
    if not is_valid_game(game_dict):
        return None
    game_uuid = uuid.uuid4()
    with open(game_uuid, "w+") as f:
        data = yaml.dump(game_dict, default_flow_style=False)
        f.write(data)
        return game_uuid

def get_games():
    """
    get all games in games dir
    """
    games = []
    game_uuids = os.listdir(GAMES_DIR)
    for uuid in game_uuids:
        game = get_game(uuid)
        if game is not None:
            games.append(game)

    return games

def get_game(game_uuid):
    if not is_uuid(game_uuid):
        print("game {} is invalid: invalid uuid".format(game_uuid))
        return None

    filename = "{}/{}".format(GAMES_DIR, game_uuid)
    if not os.path.isfile(filename):
        print("game {} is invalid: file does not exist".format(game_uuid))
        return None

    with open(filename) as f:
        data = f.read()
        try:
            as_dict = yaml.safe_load(data)
            success, error_message = is_valid_game(as_dict)
            if success:
                return as_dict

            print("game {} is invalid: {}".format(game_uuid, error_message))
            return None
        except Exception as e:
            print(e)
            print("game {} is invalid: failed to open file".format(game_uuid))
            return None

def is_uuid(possible_uuid):
    try:
        uuid_obj = uuid.UUID(possible_uuid, version=4)
        return True
    except ValueError:
        return False

# def start_game(game_name):
#     games = get_games()
#     for game in games
#     return uuid.uuid4()


if __name__ == "__main__":
    games = get_games()
    pprint(games)




