"""
@author JD
@date 18 Apr 2020
"""
import os
from pprint import pprint
from pymongo import MongoClient
from bson.objectid import ObjectId

def id_equals(object_id):
    return {"_id" : ObjectId(object_id)}

class GameEditor(object):
    """
    manages creation of games/rounds/questions
    """
    def __init__(self, host, database):
        self.db = MongoClient(host)[database]

    def get_questions(self):
        questions = self.db.question.find()
        if questions:
            return questions
        return None

    def get_question(self, question_id):
        data = self.db.question.find_one(id_equals(question_id))
        if data:
            return data
        return None

    def create_question(self, data):
        status = self.db.question.insert_one(data)
        return data

    def update_question(self, question_id, data):
        result = self.db.question.update_one(id_equals(question_id), {"$set" : data})
        return True

    def delete_question(self, question_id):
        self.db.question.delete_one(id_equals(question_id))
        return True


    """
    ===================
          ROUNDS
    ===================
    """
    def get_rounds(self):
        rounds = self.db.round.find()
        if rounds:
            return rounds
        return None

    def get_round(self, round_id):
        data = self.db.round.find_one(id_equals(round_id))
        if data:
            return data
        return None

    def create_round(self, data):
        self.db.round.insert_one(data)
        return data

    def update_round(self, round_id, data):
        result = self.db.round.update_one(id_equals(round_id), {"$set" : data})
        return True

    def delete_round(self, round_id):
        self.db.round.delete_one(id_equals(round_id))
        return True



    def get_games(self, ):
        return [{}]

    def get_game(self, game_id):
        return {}

    def create_game(self, data):
        return {}

    def update_game(self, game_id, data):
        return True

    def delete_game(self, game_id):
        return


class GamePlayer(object):
    """
    Manages gameplay, scoring
    """
    def __init__(self, host, database):
        self.database = MongoClient(host)[database]

    def start_session(self, data):
        return {}

    def get_session(self, session_id):
        return {}


    def create_team(self, session_id, team_name):
        return {}

    def update_team(self, session_id, team_id, team_name):
        return True

    def delete_team(self, team_id):
        return True


    def get_all_questions(self, session_id):
        return {}

    def get_current_question(self, session_id):
        return {}

    def get_current_question_and_answer(self, session_id):
        return {}

    def set_question(self, session_id, question_id):
        return True

    def answer_question(self, session_id, team_id, question_id, answer, wager):
        return True

    def update_answer(self, session_id, team_id, question_id, answer, wager):
        return True


    def get_question_status_unscored(self, session_id, question_id):
        return {}

    def get_question_status_scored(self, session_id, question_id):
        return {}


    def score_question(self, session_id, question_id, data):

        for team_uuid in data:
            answer_data = data[team_uuid]
            # set answer data in DB
            # update scoreboard

    def get_scoreboard(self, session_id):
        return {}

    def set_score(self, session_id, team_id, points):
        return True


"""
    def get_stock(self, symbol):
        data = self.db.stock.find_one({"symbol" : symbol}, {'_id': False})
        if data:
            return data
        return None

    def create_stock(self, data):
        self.db.stock.insert_one(data)
        del data["_id"]
        return data

    def update_stock(self, data):
        symbol = data['symbol']
        # stock =  self.db.stock.find_one({"symbol" : symbol})

        result = self.db.stock.update_one({"symbol" : symbol}, {"$set" : data})
        return data

    def delete_stock(self, symbol):
        self.db.stock.delete_one({"symbol" : symbol})
"""
