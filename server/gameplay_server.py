"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""

from datetime import datetime

from mongo_manager import MongoManager

from validator import model, succeed, fail, RestField, IdField
from validator import SUCCESS, ERROR, ERRORS, OBJECT, CREATE, UPDATE, DELETE, GET_ONE, GET_ALL
from editor_server import get_game, get_round, get_question

from flask import Flask, jsonify, request


app = Flask(__name__)

NAME = "name"
GAME_ID = "game_id"
MODERATOR = "mod"
STARTED = "started"
CURRENT_QUESTION = "current_question"
CURRENT_ROUND = "current_round"
SCORED = "scored"

PLAYERS = "players"
PLAYER_NAME = "player_name"
PLAYER_ID = "player_id"

SESSION_ID = "session_id"
CREATE_DATE = "create_date"
QUESTION_ID = "question_id"
ROUND_ID = "round_id"

ROUNDS = "rounds"
ID = "id"
ROUND = "round"
CATEGORY = "category"
QUESTION = "question"
ANSWER = "answer"
ANSWERS = "answers"
WAGER = "wager"
QUESTIONS = "questions"
WAGERS = "wagers"
ROUNDS_USED = "rounds_used"
GAME = "game"
SESSION = "session"

MONGO_HOST = "localhost"
MONGO_DB = "trivia"

mongo = MongoManager(MONGO_HOST, MONGO_DB)

smodel = [
    RestField(NAME),
    IdField(GAME_ID, "game"),
    IdField(MODERATOR, "player", optional=True),
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

    # create session with this moderator ID
    data[STARTED] = False
    data[MODERATOR] = mod_id
    created = mongo.create("session", data)
    if not created:
        return fail(errors=["Failed to create session"])
    created = fix_id(created)

    # resp = update_player(mod_id, {SESSION_ID: created[ID]})
    # if not resp[SUCCESS]:
    #     return fail(errors=resp[ERRORS])

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
    return succeed(player)


@model(pmodel, GET_ONE, "player")
def get_player(player_id, player={}):
    return succeed(fix_id(player))


join_model = [
    IdField(PLAYER_ID, "player"),
]
@model(join_model, UPDATE, "session")
def add_to_session(session_id, data, session={}):
    """
    POST /session/:id/join
    """
    if session[STARTED]:
        return fail(error="Cannot add player to already-started session")

    player_id = data[PLAYER_ID]
    success = mongo.push("session", session_id, PLAYERS, player_id)
    if not success:
        return fail(error="Failed to add player to session")

    data[SESSION_ID] = session_id
    return succeed(data)


@model(join_model, UPDATE, "session")
def remove_from_session(session_id, data, session={}):
    """
    POST /session/:id/remove
    """
    player_id = data[PLAYER_ID]
    success = mongo.pull("session", session_id, PLAYERS, player_id)
    if not success:
        return fail(error="Failed to remove player from session")

    # delete player?
    data[SESSION_ID] = session_id
    return succeed(data)


def get_players(session_id):
    session = get_session(session_id)
    if session[SUCCESS]:
        session = session[OBJECT]
        players = session.get(PLAYERS, [])

        ret = []
        for player_id in players:
            player = get_player(player_id)
            if player[SUCCESS]:
                player = player[OBJECT]
                ret.append(player)
            else:
                print(f"Failed to get player {player_id}")

        return succeed(ret)

    return fail("Failed to get session")


start_model = [
    RestField(STARTED, bool),
]
@model(start_model, UPDATE, "session")
def start_session(session_id, data, session={}):
    start = data[STARTED]
    if start:
        data[QUESTIONS] = {}
        data[ROUNDS] = {}
        success = mongo.update("session", session_id, data)
        if success:
            session.update(data)
            game = get_game(session[GAME_ID])
            first_round = set_current_round(game[ROUND_ID])
            if not first_round[SUCCESS]:
                return fail(f"Failed to set first {ROUND}")

            first_round = first_round[OBJECT]
            question_id = first_round.get(QUESTIONS, [])[0]

            first_question = set_current_question(question_id)
            if not first_question[SUCCESS]:
                return fail(f"Failed to set first {QUESTION}")

            return succeed(session)

        return fail(errors=[f"Failed to update session with data {data}"])
    else:
        fail(errors=[f"Cannot start session with data {data}"])


def get_scoreboard(session_id):
    """
    return map player_name -> score
    """
    pass


@model(smodel, GET_ONE, "session")
def get_current_question(session_id, session={}):
    """
    return ID of active question
    """
    question_id = session.get(CURRENT_QUESTION, None)
    return session.get(QUESTIONS).get(question_id)


cq_model = [
    IdField(QUESTION_ID, "question"),
    IdField(MODERATOR, "player")
]
@model(cq_model, UPDATE, "session")
def set_current_question(session_id, data, session={}):
    """
    validate that mod = session.mod_id
    validate that question ID in round
    set question.open = True
    set session.current_question = question_id
    return new question_id
    """
    session_mod = session[MODERATOR]
    if data[MODERATOR] != session_mod:
        return fail(f"Cannot set mod using ID {data[MODERATOR]}")

    r = get_current_round(session_id)
    if r[SUCCESS]:
        question_id = data[QUESTION_ID]
        if question_id not in r.get(QUESTIONS, []):
            return fail(f"{QUESTION} with id {question_id} is not in current round {r}.")

        # set session.answers.question_id = {}
        data_to_update = { f"{QUESTIONS}.{question_id}": {ANSWERS: {}}, CURRENT_QUESTION: question_id}
        success = mongo.update("session", session_id, data_to_update)
        if success:
            return succeed({CURRENT_QUESTION: question_id})
        return fail(f"Failed to set current {QUESTION} to {question_id}")

    return fail(f"Failed to get round with ID {session.get(ROUND_ID)}")


def get_question_by_id(session_id, question_id):
    """
    if not open: (i.e. question not in session.answers)
        return category
    if is_current_question and not scored:
        return question, category
    if scored:
        return question category, answer
    """
    pass


@model(smodel, GET_ONE, "session")
def get_current_round(session_id, session={}):
    """
    return round_name, list of questions, list of wagers
    """
    round_id = session.get(CURRENT_ROUND)
    return session.get(ROUNDS, {}).get(round_id, None)


cq_model = [
    IdField(ROUND_ID, "round"),
    IdField(MODERATOR, "player")
]
@model(cq_model, UPDATE, "session")
def set_current_round(session_id, data, session={}):
    round_id = data[ROUND_ID]

    # round must be in game.rounds
    game = get_game(session[GAME_ID])
    if game[SUCCESS]:
        game = game[OBJECT]
        round_ids = game.get(ROUNDS)
        if round_id not in round_ids:
            return fail(f"{ROUND} with id '{round_id}' is not in {GAME} '{game}'")

        # get round from DB and set in session obj
        r = get_round(round_id)
        if r[SUCCESS]:
            data_to_update = {
                 f"{ROUNDS}.{round_id}": {WAGERS: r.wagers, QUESTIONS: r.questions},
                 CURRENT_ROUND: round_id
            }
            success = mongo.update("session", session_id, data_to_update)
            if success:
                return succeed(r)

            fail(f"Failed to update {SESSION}")

        return fail(f"Failed to get {ROUND} with id {round_id}")

    return fail(f"Failed to get game with id '{session[GAME_ID]}'")


def get_answer_status(session_id, question_id):
    """
    if not open:
        return failure
    if open and not scored:
        return map team_name -> answered:bool
    if scored:
        return map
            team_name:
                answers: similar form as get_answers()
                correct: true/false
                points_awarded: n
    """
    pass


def get_answers(session_id, question_id):
    """
    if not is_current_question and not scored:
        return failure

    get map player_id -> [answer_ids]
    compose map
        player_id:
            answer: x
            wager: n
    """
    pass


def score_question(session_id, data):
    """
    data = {
        question_id: x
        teams:
            team1: {correct: true}
            team2: {correct: false}
            ...
    }
    for team in teams:
        get_wager(question_id)
        if team.correct:
            $inc: { scoreboard.team_id.score : wager }

    set question.scored = true
    """

answer_model = (
    IdField(SESSION_ID, "session"),
    IdField(QUESTION_ID, "question"),
    IdField(ROUND_ID, "round"),
    RestField(ANSWER),
    RestField(WAGER, int),
)
def answer_question(data):
    """
    validate wager is legal
    validate question is answerable
    create answer record
    push answer ID to
        session.question_id.player_id.answers
    return success: true
    """
    pass


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
