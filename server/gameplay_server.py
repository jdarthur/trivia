"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""

from flask import Flask, request, Response
import random
import time
import uuid

from mongo_manager import MongoManager

from validator import model, succeed, fail, RestField, IdField
from validator import SUCCESS, OBJECT, CREATE, UPDATE, DELETE, GET_ONE, SUBOP
from editor_server import get_game, get_round, get_question, _resp


app = Flask(__name__)

NAME = "name"
GAME_ID = "game_id"
MODERATOR = "mod"
STARTED = "started"
CURRENT_QUESTION = "current_question"
CURRENT_ROUND = "current_round"
SCORED = "scored"

PLAYERS = "players"
TEAM_NAME = "team_name"
REAL_NAME = "real_name"
PLAYER_ID = "player_id"

SESSION_ID = "session_id"
QUESTION_ID = "question_id"
ROUND_ID = "round_id"

ROUNDS = "rounds"
ID = "id"
ROUND = "round"
CATEGORY = "category"
CATEGORIES = "categories"
QUESTION = "question"
ANSWER = "answer"
ANSWERS = "answers"
WAGER = "wager"
QUESTIONS = "questions"
WAGERS = "wagers"
ROUNDS_USED = "rounds_used"
GAME = "game"
SESSION = "session"
CORRECT = "correct"
SCOREBOARD = "scoreboard"

MONGO_HOST = "localhost"
MONGO_DB = "trivia"

URL_BASE = "/gameplay"

mongo = MongoManager(MONGO_HOST, MONGO_DB)

def create_and_respond(endpoint, data):
    """
    try to create some object and return a failure/success resp
    """
    if endpoint == "session":
        return _resp(create_session(data))
    if endpoint == "player":
        return _resp(create_player(data))

    raise Exception(f"unsupported create '{endpoint}'")


def update_and_respond(endpoint, object_id, data):
    if endpoint == "player":
        return _resp(update_player(object_id, data))

    raise Exception(f"unsupported create '{endpoint}'")


def get_and_respond(endpoint, object_id, player_id=None, prune=None):
    if endpoint == "session":
        data = get_session(object_id)
    if endpoint == "player":
        data = get_player(object_id)
    if endpoint == "current_question":
        data = get_current_question(object_id)
    if endpoint == "current_round":
        data = get_current_round(object_id)
        print(data)

    if prune is not None:
        prune(data, player_id)
    return _resp(data)


@app.route(f'{URL_BASE}/session', methods=['POST'])
def create_one_session():
    return create_and_respond("session", request.json)


@app.route(f'{URL_BASE}/session/<session_id>', methods=['GET'])
def get_one_session(session_id):
    player_id = request.args.get(PLAYER_ID, False)
    return get_and_respond("session", session_id, player_id, prune_session)


@app.route(f'{URL_BASE}/session/<session_id>/state', methods=['GET'])
def get_session_state(session_id):
    req_state = request.args.get("current", None)
    if req_state is None:
        time.sleep(10)

    while True:
        state = mongo.get_state(session_id)
        if str(state) != str(req_state):
            return _resp(succeed({"state": state}))
        time.sleep(2)


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
    mod = create_player({TEAM_NAME: "mod", REAL_NAME: "mod"})
    if not mod[SUCCESS]:
        return mod

    mod_id = str(mod[OBJECT][ID])

    # create session with this moderator ID
    data[STARTED] = False
    data[MODERATOR] = mod_id
    created = mongo.create("session", data)
    if not created:
        return fail("Failed to create session")

    success = mongo.create("answer", data)
    if not success:
        return fail("Failed to create session")
    # created = created

    # resp = update_player(mod_id, {SESSION_ID: created[ID]})
    # if not resp[SUCCESS]:
    #     return fail(errors=resp[ERRORS])
    mongo.incr_state(created[ID])

    return succeed(created)


@model(smodel, GET_ONE, "session")
def get_session(session_id, session={}):
    """
    GET /session/:id?player_id=<mod_or_player_id>
    """
    return succeed(session)

def prune_session(data, player_id):
    session = data[OBJECT]
    mod_id = session[MODERATOR]
    if player_id != mod_id:
        del session[MODERATOR]
        del session[GAME_ID]
        del session[PLAYERS]


@model(smodel, UPDATE, "session")
def update_session(session_id, data, session={}):
    success = mongo.update("session", session_id, data)
    if success:
        session.update(data)
        return succeed(session)

    mongo.incr_state(session_id)
    return fail(f"Failed to update session with data {data}")


@model(smodel, DELETE, "session")
def delete_session(session_id, session={}):
    mongo.delete("session", session_id)
    return session


def get_sessions():
    ret = []
    sessions = mongo.get_all("session")
    if sessions:
        for s in sessions:
            ret.append(s)
    return succeed(ret)


"""
=====================================
               PLAYER
=====================================
"""

@app.route(f'{URL_BASE}/player', methods=['POST'])
def create_one_player():
    return create_and_respond("player", request.json)

@app.route(f'{URL_BASE}/session/<session_id>/add', methods=['POST'])
def add_player_to_session(session_id):
    return _resp(add_to_session(session_id, request.json))
    # return create_and_respond("player", request.json)

@app.route(f'{URL_BASE}/player/<player_id>', methods=['GET'])
def get_one_player(player_id):
    return get_and_respond("player", player_id)

@app.route(f'{URL_BASE}/player/<player_id>', methods=['PUT'])
def update_one_player(player_id):
    return update_and_respond("player", player_id, request.json)


pmodel = [
    RestField(TEAM_NAME),
    RestField(REAL_NAME),
    IdField(SESSION_ID, "session", optional=True)
]
@model(pmodel, CREATE, "player")
def create_player(data):
    obj = mongo.create("player", data)
    return succeed(obj)


@model(pmodel, UPDATE, "player")
def update_player(player_id, data, player={}):
    success = mongo.update("player", player_id, data)
    if success:
        player.update(data)

        #dirty the session state, so other clients will see this update
        session_id = player.get(SESSION_ID, None)
        if session_id:
            mongo.incr_state(session_id)

        return succeed(player)
    return fail(f"Failed to update player with data {data}")


@model(pmodel, DELETE, "player")
def delete_player(player_id, player={}):
    mongo.delete("player", player_id)
    return succeed(player)


@model(pmodel, GET_ONE, "player")
def get_player(player_id, player={}):
    return succeed(player)


join_model = [
    IdField(PLAYER_ID, "player"),
]
@model(join_model, UPDATE, "session")
def add_to_session(session_id, data, session={}):
    """
    POST /session/:id/join
    """
    if session[STARTED]:
        return fail("Cannot add player to already-started session")

    if data[PLAYER_ID] in session.get(PLAYERS, []):
        return fail(f"Player id {data[PLAYER_ID]} is already in session")

    player_id = data[PLAYER_ID]
    success = mongo.push("session", session_id, PLAYERS, player_id)
    if not success:
        return fail("Failed to add player to session")

    data[SESSION_ID] = session_id

    mongo.incr_state(session_id)
    update = update_player(player_id, {"session_id": session_id})
    if not update:
        return update

    return succeed(data)


@model(join_model, UPDATE, "session")
def remove_from_session(session_id, data, session={}):
    """
    POST /session/:id/remove
    """
    player_id = data[PLAYER_ID]
    success = mongo.pull("session", session_id, PLAYERS, player_id)
    if not success:
        return fail("Failed to remove player from session")

    # delete player?
    data[SESSION_ID] = session_id
    mongo.incr_state(session_id)

    return succeed(data)



@app.route(f'{URL_BASE}/session/<session_id>/players', methods=['GET'])
def get_all_players_in_session(session_id):
    player_id = request.args.get(PLAYER_ID, False)
    data = get_players(session_id)
    if data[SUCCESS]:
        mod = data[MODERATOR]
        print(data)
        if mod != player_id:
            for player in data[OBJECT]:
                if player[ID] != player_id:
                    del player[ID]
    return _resp(data)

def get_players(session_id, player_id=None):
    """
    args: session_id
    returns:
        [
            {player_name: name, player_id: uuid4},
            {player_name: name, player_id: uuid4},
            ...
        ]
    """
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

        resp = succeed(ret)
        resp[MODERATOR] = session[MODERATOR]
        return resp

    return fail("Failed to get session")


@app.route(f'{URL_BASE}/session/<session_id>/start', methods=['POST'])
def start_one_session(session_id):
    player_id = request.json.get(PLAYER_ID, None)
    # get session to make sure you are the mod
    # TODO: refactor this somehow into helper method to avoid double get
    session = get_session(session_id)
    if not session[SUCCESS]:
        return session

    mod = session[OBJECT][MODERATOR]
    if player_id != mod:
        return fail(f"only mod can start session")

    return _resp(start_session(session_id))


def start_session(session_id):
    return _start_session(session_id, {STARTED: True})


start_model = [
    RestField(STARTED, bool),
]
@model(start_model, UPDATE, "session")
def _start_session(session_id, data, session={}):
    if session[STARTED]:
        return fail(f"Session {session_id} is already started.")

    start = data[STARTED]
    if start:
        startable = game_has_round_and_question(session)
        if not startable[SUCCESS]:
            return startable

        success = mongo.update("session", session_id, data)
        if success:
            session.update(data)

            # set current round to 0th round ID in game
            # this will also set first question to 0th question in round
            set_round = set_current_round(session_id, 0)
            if not set_round[SUCCESS]:
                return set_round

            mongo.incr_state(session_id)

            return succeed(session)

        return fail(f"Failed to update session with data {data}")

    else:
        fail("Cannot start session with data {data}")


def game_has_round_and_question(session):
    """
    verify that this session has at least one round and question
    """
    game_id = session.get(GAME_ID, None)
    if not game_id:
        return fail(f"Session {session[ID]} does not have a {GAME}_id")

    game = get_game(game_id)  # probably don't need to test validity because setting game_id illegal is prevented
    if not game[SUCCESS]:
        return game

    game = game[OBJECT]

    rounds = game.get(ROUNDS, [])
    if len(rounds) == 0:
        return fail(f"{GAME}_id {game_id} does not have any {ROUNDS}")

    first_round_id = rounds[0]
    round_obj = get_round(first_round_id)
    if not round_obj[SUCCESS]:
        return round_obj
    round_obj = round_obj[OBJECT]

    questions = round_obj.get(QUESTIONS, [])
    if len(questions) == 0:
        return fail(f"{ROUND}_id {first_round_id} does not have any {QUESTIONS}")

    first_question_id = questions[0]

    return succeed({ROUND_ID: first_round_id, QUESTION_ID: first_question_id})



@app.route(f'{URL_BASE}/session/<session_id>/current-question', methods=['GET'])
def get_currq(session_id):
    return get_and_respond("current_question", session_id)


@model(smodel, GET_ONE, "session")
def get_current_question(session_id, session={}):
    """
    return ID of active question
    """
    question_id = session.get(CURRENT_QUESTION, None)
    return get_question_by_index(session_id, question_id)


def set_current_question(session_id, question_id):
    return _set_current_question(session_id, {QUESTION_ID: question_id})


cq_model = [
    RestField(QUESTION_ID, int)
]
@model(cq_model, SUBOP, "session")
def _set_current_question(session_id, data, session={}):
    """
    validate that question ID in round
    set question.open = True
    set session.current_question = question_id
    return new question_id
    """
    qindex = data[QUESTION_ID]

    r = get_current_round(session_id)
    if r[SUCCESS]:
        r = r[OBJECT]

        question_ids = r.get(QUESTIONS, [])

        if qindex > len(question_ids):
            return fail(f"{QUESTION} with index {qindex} is not in current round {r}.")

        question_id = question_ids[qindex]

        question = get_question(question_id)
        if not question[SUCCESS]:
            return question
        question = question[OBJECT]

        data_to_update = {
            f"{QUESTIONS}.q{qindex}.{QUESTION}": question[QUESTION],
            f"{QUESTIONS}.q{qindex}.{ANSWERS}": {},
            CURRENT_QUESTION: qindex
        }
        success = mongo.update("session", session_id, data_to_update)
        if not success:
            return fail(f"Failed to set question for question_id {question_id}")

        mongo.incr_state(session_id)

        return succeed({CURRENT_QUESTION: qindex})

    return fail(f"Failed to get round with ID {session.get(ROUND_ID)}")


def get_question_by_index(session_id, question_id):
    return _get_question_by_index(session_id, {QUESTION_ID: question_id})


@model(cq_model, SUBOP, "session")
def _get_question_by_index(session_id, data, session={}):
    """
    if not open: (i.e. question not in session.answers)
        return category
    if is_current_question and not scored:
        return question, category
    if scored:
        return question category, answer
    """
    index = data[QUESTION_ID]
    qid = f"q{index}"

    questions = session.get(QUESTIONS)
    if qid not in questions:
        return fail(f"{QUESTION} index {index} not found in session {session_id}")
    question = questions[qid]
    return succeed(question)


@app.route(f'{URL_BASE}/session/<session_id>/current-round', methods=['GET'])
def get_curr_round(session_id):
    return get_and_respond("current_round", session_id)


@model(smodel, GET_ONE, "session")
def get_current_round(session_id, session={}):
    """
    return round_name, list of questions, list of wagers
    """
    round_id = f"r{session.get(CURRENT_ROUND)}"
    r = session.get(ROUNDS, {}).get(round_id, None)
    r[ID] = round_id
    return succeed(r)


def set_current_round(session_id, round_id):
    return _set_current_round(session_id, {ROUND_ID: round_id})


cr_model = [
    RestField(ROUND_ID, int)
]
@model(cr_model, SUBOP, "session")
def _set_current_round(session_id, data, session={}):
    round_index = data[ROUND_ID]

    # round must be in game.rounds
    game = get_game(session[GAME_ID])
    if game[SUCCESS]:
        game = game[OBJECT]
        round_ids = game.get(ROUNDS)
        if round_index > len(round_ids):
            return fail(f"{ROUND} with index '{round_index}' is not in {GAME} '{game}'")

        round_id = round_ids[round_index]

        # get round from DB and set in session obj
        r = get_round(round_id)
        if r[SUCCESS]:
            r = r[OBJECT]

            categories = get_categories(r[QUESTIONS])

            data_to_update = {
                 f"{ROUNDS}.r{round_index}": {
                     WAGERS: r[WAGERS],
                     QUESTIONS: r[QUESTIONS],
                     CATEGORIES: categories
                     },
                 CURRENT_ROUND: round_index
            }
            success = mongo.update("session", session_id, data_to_update)
            if success:
                # for each question, populate questions.id.category
                questions = r[QUESTIONS]
                for i, question_id in enumerate(questions):
                    question = get_question(question_id)
                    if not question[SUCCESS]:
                        return question
                    question = question[OBJECT]

                    data_to_update = {f"{QUESTIONS}.q{i}": {CATEGORY: question[CATEGORY]}}
                    success = mongo.update("session", session_id, data_to_update)
                    if not success:
                        return fail(f"Failed to add category for question {question_id}")

                set_first_q = set_current_question(session_id, 0)
                if not set_first_q[SUCCESS]:
                    return set_first_q

                mongo.incr_state(session_id)

                return succeed(r)

            fail(f"Failed to update {SESSION}")

        return fail(f"Failed to get {ROUND} with id {round_id}")

    return fail(f"Failed to get game with id '{session[GAME_ID]}'")


def get_categories(list_of_questions):
    categories = []
    for question_id in list_of_questions:
        question = get_question(question_id)
        categories.append(question[OBJECT][CATEGORY])
    return categories


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
    return _get_answers(session_id, {QUESTION_ID: question_id})


@model(cq_model, SUBOP, "session")
def _get_answers(session_id, data, session={}):
    """
    if not is_current_question and not scored:
        return failure

    get map player_id -> [answer_ids]
    compose map
        player_id:
            answer: x
            wager: n
    """
    question_id = data[QUESTION_ID]
    answers = get_question_by_id(session_id, question_id)
    if not answers[SUCCESS]:
        return answers

    answers = answers[OBJECT][ANSWERS]

    composed = {}
    for player_id in answers:
        composed[player_id] = []
        answer_ids = answers[player_id]
        for answer_id in answer_ids:
            answer = get_answer(answer_id)
            if not answer[SUCCESS]:
                return answer
            answer = answer[OBJECT]
            composed[player_id].append({ANSWER: answer[ANSWER], ID: answer[ID],
                                        WAGER: answer[WAGER]})

    return succeed(composed)


score_model = [
    IdField(QUESTION_ID, "question"),
    RestField(PLAYERS, dict)
]


@model(score_model, UPDATE, "session")
def score_question(session_id, data, session={}):
    """
    data = {
        question_id: x
        teams:
            team1: {correct: true}
            team2: {correct: false}
            ...
    }

    """
    question_id = data[QUESTION_ID]

    answers = session.get(QUESTIONS).get(question_id, {}).get(ANSWERS, None)
    if answers is None:
        return fail(f"{QUESTION}_id {question_id} is not open")

    session_players = session.get(PLAYERS, [])
    given_players = data[PLAYERS]

    for player_id in session_players:
        if player_id not in given_players:
            return fail(f"{PLAYER_ID} {player_id} was not scored.")

    answers = get_answers(session_id, question_id)
    if not answers[SUCCESS]:
        return answers
    answers = answers[OBJECT]

    for player_id in given_players:
        player_answers = answers.get(player_id, None)
        if not player_answers:
            return fail(f"{PLAYER_ID} {player_id} has not answered question {question_id}")

        # last answer is the one scored
        answer = player_answers[-1]
        is_correct = given_players[player_id].get(CORRECT, None)
        if is_correct is None:
            return fail(f"Did not set correct True/False for {PLAYER_ID} {player_id}")

        points_awarded = answer[WAGER] if is_correct else 0
        awarded = award_points(session_id, player_id, points_awarded)
        if not awarded[SUCCESS]:
            return awarded

    success = mongo.update("session", session_id, {f"{QUESTIONS}.{question_id}.{SCORED}": True})
    if not success:
        return fail("Failed to mark question as scored")

    mongo.incr_state(session_id)
    return succeed(data)


def award_points(session_id, player_id, points):
    # update_scoreboard -> $inc session.points[player_id]: points_awarded
    success = mongo.increment("session", session_id, f"{SCOREBOARD}.{player_id}", points)
    if not success:
        return fail(f"Failed to award {points} points for player {player_id}")
    return succeed({PLAYER_ID: player_id})


@model([], GET_ONE, "session")
def get_scoreboard(session_id, session={}):
    scoreboard = session.get(SCOREBOARD, None)
    if scoreboard is None:
        scoreboard = {}
        players = get_players(session_id)
        if not players[SUCCESS]:
            return players
        players = players[OBJECT]
        for player in players:
            player_id = player[ID]
            scoreboard[player_id] = 0

    return succeed(scoreboard)


answer_model = (
    IdField(QUESTION_ID, "question"),
    IdField(ROUND_ID, "round"),
    IdField(PLAYER_ID, "player"),
    RestField(ANSWER),
    RestField(WAGER, int),
)


@model(answer_model, SUBOP, "session")
def answer_question(session_id, data, session={}):
    """
    validate wager is legal
    validate question is answerable
    create answer record
    push answer ID to
        session.question_id.player_id.answers
    return success: true
    """
    player_id = data[PLAYER_ID]
    round_id = data[ROUND_ID]
    question_id = data[QUESTION_ID]

    legal_wagers = get_legal_wagers(session, round_id, player_id)
    wager = data[WAGER]
    if wager not in legal_wagers:
        return fail(f"Wager {wager} is illegal")

    answers = session.get(QUESTIONS).get(question_id, {}).get(ANSWERS, None)
    if answers is None:
        return fail(f"{QUESTION}_id {question_id} is not open")

    answer = create_answer(data)
    if not answer[SUCCESS]:
        return answer
    answer = answer[OBJECT]

    answer_id = answer[ID]
    array = f"{QUESTIONS}.{question_id}.{ANSWERS}.{player_id}"
    success = mongo.push("session", session_id, array, answer_id)
    if not success:
        return fail(f"Failed to add add {answer_id} for player {player_id}")

    mongo.incr_state(session_id)

    return succeed(answer)


def get_legal_wagers(session, round_id, player_id):
    """
    must not
    """
    r = session[ROUNDS][round_id]
    all_wagers = r[WAGERS].copy()
    questions_in_round = r[QUESTIONS]

    for question_id in questions_in_round:
        question = session[QUESTIONS][question_id]
        if question.get(SCORED, False):
            answer_id = question[ANSWERS][player_id][-1]
            answer = get_answer(answer_id)
            if not answer[SUCCESS]:
                raise RuntimeError("failed to get answer")
            answer = answer[OBJECT]
            wager = answer[WAGER]
            all_wagers.remove(wager)

    return all_wagers


def create_answer(data):
    success = mongo.create("answer", data)
    if not success:
        return fail("Failed to create answer")
    return succeed(success)


@model(answer_model, GET_ONE, "answer")
def get_answer(answer_id, answer={}):
    return succeed(answer)


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, threaded=True)
