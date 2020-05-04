"""
@author JD
@date 18 Apr 2020
"""
import uuid
from pymongo import MongoClient

ID = "id"

def id_equals(object_id):
    return {"_id" : uuid.UUID(object_id, version=4)}


def add_id(data):
    data["_id"] = uuid.uuid4()
    return data


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
        games = self.db.game.find()
        if games:
            return games
        return None

    def get_game(self, game_id):
        game = self.db.game.find_one(id_equals(game_id))
        if game:
            return game
        return None

    def create_game(self, data):
        self.db.game.insert_one(data)
        return data

    def update_game(self, game_id, data):
        self.db.game.update_one(id_equals(game_id), {"$set" : data})
        return True

    def delete_game(self, game_id):
        self.db.game.delete_one(id_equals(game_id))
        return True


class MongoManager(object):
    """
    Manages gameplay, scoring
    """
    def __init__(self, host, database):
        self.db = MongoClient(host)[database]

    def get(self, object_type, object_id):
        return self.db[object_type].find_one(id_equals(object_id))

    def create(self, object_type, data):
        data = add_id(data)
        self.db[object_type].insert_one(data)
        return fix_id(data)

    def update(self, object_type, object_id, data):
        self.db[object_type].update_one(id_equals(object_id), {"$set" : data})
        return True

    def push(self, object_type, object_id, array, value):
        self.db[object_type].update_one(id_equals(object_id),
                                        {"$push": {array: value}})
        return True

    def pull(self, object_type, object_id, array, value):
        self.db[object_type].update_one(id_equals(object_id),
                                        {"$pull": {array: value}})
        return True

    def delete(self, object_type, object_id):
        self.db[object_type].delete_one(id_equals(object_id))
        return True

    def get_all(self, object_type):
        return self.db[object_type].find()
