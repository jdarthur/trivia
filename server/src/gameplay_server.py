"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""

from flask import Flask, request
import time

from mongo_manager import MongoManager

from validator import model, succeed, fail, RestField, IdField, get_all
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
SCORE_OVERRIDE = "score_override"

PLAYERS = "players"
TEAM_NAME = "team_name"
REAL_NAME = "real_name"
ICON = "icon"
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
POINTS_AWARDED = "points_awarded"
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

    attempts = 0
    while True:
        state = mongo.get_state(session_id)
        if str(state) != str(req_state):
            return _resp(succeed({"state": state}))
        time.sleep(1)
        attempts += 1

    # return _resp(succeed({"state": req_state}))


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
    mod = create_player({TEAM_NAME: "mod", REAL_NAME: "mod", ICON: ""})
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
        session.pop(MODERATOR, None)
        session.pop(GAME_ID, None)
        session.pop(PLAYERS, None)


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
    return succeed(get_all("session"))


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
    RestField(ICON),
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
                return fail(f"Failed to get player {player_id}")

        resp = succeed(ret)
        resp[MODERATOR] = session[MODERATOR]
        return resp

    return fail("Failed to get session")


@app.route(f'{URL_BASE}/session/<session_id>/start', methods=['POST'])
def start_one_session(session_id):
    player_id = request.json.get(PLAYER_ID, None)

    is_mod = verify_mod(session_id, player_id)
    if not is_mod[SUCCESS]:
        return is_mod

    return _resp(start_session(session_id))


def verify_mod(session_id, player_id):
    # get session to make sure you are the mod
    # TODO: refactor this somehow into helper method to avoid double get
    session = get_session(session_id)
    if not session[SUCCESS]:
        return session

    mod = session[OBJECT][MODERATOR]
    if player_id != mod:
        return fail(f"only mod can start session")
    return succeed({})


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

        rounds = startable[OBJECT][ROUNDS]
        for i, round_id in enumerate(rounds):
            success = mongo.push("session", session_id, ROUNDS, {ROUND_ID: round_id})
            if not success:
                fail(f"Failed to add round with index {i} to session")

        success = mongo.update("session", session_id, {STARTED: True})
        if not success:
            return fail("Failed tto start session")
        # set current round to 0th round ID in game
        # this will also set first question to 0th question in round
        set_round = set_current_round(session_id, 0)
        if not set_round[SUCCESS]:
            return set_round

        mongo.incr_state(session_id)
        return succeed(session)

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

    return succeed({ROUND_ID: first_round_id, QUESTION_ID: first_question_id, ROUNDS: rounds})


@app.route(f'{URL_BASE}/session/<session_id>/current-question', methods=['GET'])
def get_currq(session_id):
    return get_and_respond("current_question", session_id)


@model(smodel, GET_ONE, "session")
def get_current_question(session_id, session={}):
    """
    return ID of active question
    """
    question_index = session.get(CURRENT_QUESTION, None)
    round_index = session.get(CURRENT_ROUND, None)
    return get_question_by_index(session_id, round_index, question_index)


@app.route(f'{URL_BASE}/session/<session_id>/current-question', methods=['PUT'])
def set_currq(session_id):
    player_id = request.json.get(PLAYER_ID, None)
    question_id = request.json.get(QUESTION_ID, None)
    round_id = request.json.get(ROUND_ID, None)

    is_mod = verify_mod(session_id, player_id)
    if not is_mod[SUCCESS]:
        return is_mod

    return _resp(set_current_question(session_id, round_id, question_id))


def set_current_question(session_id, round_id, question_id):
    return _set_current_question(session_id, {QUESTION_ID: question_id, ROUND_ID: round_id})


cq_model = [
    RestField(QUESTION_ID, int),
    RestField(ROUND_ID, int)
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
    rindex = data[ROUND_ID]

    prev = get_question_in_round(session, rindex, qindex)
    if prev[SUCCESS]:
        prev = prev[OBJECT].get(ANSWERS, {})
    else:
        prev = {}

    r = get_current_round(session_id)
    if r[SUCCESS]:
        r = r[OBJECT]
        round_id = r[ROUND_ID]
        round_obj = get_round(round_id)
        if round_obj[SUCCESS]:
            round_obj = round_obj[OBJECT]

        question_ids = round_obj.get(QUESTIONS, [])

        if qindex > len(question_ids):
            return fail(f"{QUESTION} with index {qindex} is not in current round {r}.")

        question_id = question_ids[qindex]

        question = get_question(question_id)
        if not question[SUCCESS]:
            return question
        question = question[OBJECT]

        spot = f"{ROUNDS}.{rindex}.{QUESTIONS}.{qindex}"
        data_to_update = {
            CURRENT_QUESTION: qindex,
            f"{spot}.{QUESTION}": question[QUESTION],
            f"{spot}.{ANSWERS}": prev
        }
        mongo.update("session", session_id, data_to_update)
        # if not success:
        #     return fail(f"Failed to set question for question_id {question_id}")

        mongo.incr_state(session_id)

        return succeed({CURRENT_QUESTION: qindex})

    return fail(f"Failed to get round with ID {session.get(ROUND_ID)}")


def get_question_by_index(session_id, round_index, question_index):
    return _get_question_by_index(session_id, {QUESTION_ID: question_index, ROUND_ID: round_index})


@model(cq_model, SUBOP, "session")
def _get_question_by_index(session_id, data, session={}):
    r_index = data[ROUND_ID]
    q_index = data[QUESTION_ID]

    return get_question_in_round(session, r_index, q_index)


def get_question_in_round(session, round_index, question_index):
    """
    get question at index X in round with index Y
    """
    rounds = session[ROUNDS]
    if round_index >= len(rounds):
        return fail(f"{ROUND} index {round_index} not found in {SESSION} {session}")

    r = rounds[round_index]
    questions = r[QUESTIONS]
    if question_index >= len(questions):
        return fail(f"{QUESTION} index {question_index} not found in round {r}")

    question = questions[question_index]
    question[ID] = question_index
    return succeed(question)


@app.route(f'{URL_BASE}/session/<session_id>/current-round', methods=['GET'])
def get_curr_round(session_id):
    return get_and_respond("current_round", session_id)


@model(smodel, GET_ONE, "session")
def get_current_round(session_id, session={}):
    """
    return round_name, list of questions, list of wagers
    """
    round_index = session.get(CURRENT_ROUND)
    r = session.get(ROUNDS, [])[round_index]
    r[ID] = round_index
    return succeed(r)


@app.route(f'{URL_BASE}/session/<session_id>/current-round', methods=['PUT'])
def set_curr_r(session_id):
    player_id = request.json.get(PLAYER_ID, None)
    round_id = request.json.get(ROUND_ID, None)

    is_mod = verify_mod(session_id, player_id)
    if not is_mod[SUCCESS]:
        return is_mod

    return _resp(set_current_round(session_id, round_id))

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

            data_to_update = {
                f"{ROUNDS}.{round_index}.{WAGERS}":  r[WAGERS],
                ROUND_ID: round_id,
                CURRENT_ROUND: round_index,
            }

            success = mongo.update("session", session_id, data_to_update)
            if not success:
                fail(f"Failed to add update round with index {i} in session")
            if session[ROUNDS][round_index].get(QUESTIONS, None) is None:
                spot = f"{ROUNDS}.{round_index}.{QUESTIONS}"
                questions = r[QUESTIONS]
                for i, question_id in enumerate(questions):
                    question = get_question(question_id)
                    if not question[SUCCESS]:
                        return question
                    category = question[OBJECT][CATEGORY]

                    success = mongo.push("session", session_id, spot, {CATEGORY: category})
                    if not success:
                        fail(f"Failed to add question with index {i} to round")

            set_first_q = set_current_question(session_id, round_index, 0)
            if not set_first_q[SUCCESS]:
                return set_first_q

            mongo.incr_state(session_id)

            return succeed(r)

            fail(f"Failed to update {SESSION}")

        return fail(f"Failed to get {ROUND} with id {round_id}")

    return fail(f"Failed to get game with id '{session[GAME_ID]}'")

@app.route(f'{URL_BASE}/session/<session_id>/answers', methods=['GET'])
def get_answer_status(session_id):
    player_id = request.args.get(PLAYER_ID, None)
    round_id = request.args.get(ROUND_ID, None)
    question_id = request.args.get(QUESTION_ID, None)

    try:
        round_id = int(round_id)
        question_id = int(question_id)
    except:
        return _resp(fail("Bad question/round ID"))

    session = get_session(session_id)[OBJECT]

    question = session[ROUNDS][round_id][QUESTIONS][question_id]
    answers = question.get(ANSWERS, None)
    if answers is None:
        return _resp(fail("Question is not open"))

    mod = session[MODERATOR]
    players = get_players2(session)
    if player_id != mod:
        # scored questions will provide answers and wagers
        if question.get(SCORED, False):
            return _resp(get_answers_scored(players, answers))
        else:
            # unscored questions will provide only answered:true/false
            return _resp(get_answers_unscored(players, answers))

    else:
        # mod always gets complete player_id/answer/wager
        return _resp(get_answers_as_mod(players, answers))


def get_players2(session):
    players = session.get(PLAYERS, [])

    ret = []
    for player_id in players:
        player = get_player(player_id)
        ret.append(player[OBJECT])
    return ret


def get_answers_unscored(players, answers):
    ret = []
    for player in players:
        player_id = player[ID]
        p = {TEAM_NAME: player[TEAM_NAME], ICON: player.get(ICON, None)}
        panswers = answers.get(player_id, None)
        p['answered'] = panswers is not None

        ret.append(p)
    return succeed({SCORED: False, ANSWERS: ret})


def get_answers_scored(players, answers):
    ret = []
    for player in players:
        player_id = player[ID]
        p = {TEAM_NAME: player[TEAM_NAME]}
        panswers = answers.get(player_id, [])
        if len(panswers) > 0:
            answer_id = panswers[-1]
            answer = get_answer(answer_id)[OBJECT]

            p[ANSWER] = answer[ANSWER]
            p[WAGER] = answer[WAGER]
            p[CORRECT] = answer.get(CORRECT, False)
            p[POINTS_AWARDED] = answer.get(POINTS_AWARDED, answer[WAGER])
            ret.append(p)
    return succeed({SCORED: True, ANSWERS: ret})


def get_answers_as_mod(players, answers):
    ret = []
    for player in players:
        player_id = player[ID]
        p = {PLAYER_ID: player_id, TEAM_NAME: player[TEAM_NAME]}
        panswers = answers.get(player_id, None)
        p['answered'] = panswers is not None
        if panswers is not None:
            answer_id = panswers[-1]
            answer = get_answer(answer_id)[OBJECT]
            p[ANSWER] = answer[ANSWER]
            p[WAGER] = answer[WAGER]
            p['answer_id'] = answer[ID]
        ret.append(p)
    return succeed(ret)


def get_answers(session_id, round_id, question_id):
    return _get_answers(session_id, {QUESTION_ID: question_id, ROUND_ID: round_id})


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
    question_index = data[QUESTION_ID]
    round_index = data[ROUND_ID]
    answers = get_question_by_index(session_id, round_index, question_index)
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
    RestField(QUESTION_ID, int),
    RestField(ROUND_ID, int),
    RestField(PLAYERS, dict),
    IdField(PLAYER_ID, "player")
]
@app.route(f'{URL_BASE}/session/<session_id>/score', methods=['PUT'])
def score_one_question(session_id):
    player_id = request.json.get(PLAYER_ID, None)

    is_mod = verify_mod(session_id, player_id)
    if not is_mod[SUCCESS]:
        return is_mod

    return _resp(score_question(session_id, request.json))


@model(score_model, UPDATE, "session")
def score_question(session_id, data, session={}):
    """
    data = {
        question_id: x
        round_id: y
        players:
            team1: {correct: true}
            team2: {correct: false}
            ...
    }

    """
    question_id = data[QUESTION_ID]
    round_id = data[ROUND_ID]

    question = session.get(ROUNDS)[round_id][QUESTIONS][question_id]
    rescore = question.get(SCORED, False)

    answers = question.get(ANSWERS, None)
    if answers is None:
        return fail(f"{QUESTION}_id {question_id} is not open")

    session_players = session.get(PLAYERS, [])
    given_players = data[PLAYERS]

    for player_id in session_players:
        if player_id not in given_players:
            return fail(f"{PLAYER_ID} {player_id} was not scored.")
        is_correct = given_players[player_id].get(CORRECT, None)
        if is_correct is None:
            return fail(f"Did not set correct True/False for {PLAYER_ID} {player_id}")

    players = get_players2(session)
    answers = get_answers_as_mod(players, answers)[OBJECT]
    for answer in answers:
        if answer['answered'] is False:
            return fail(f"{PLAYER_ID} {answer[PLAYER_ID]} has not answered question {question_id}")

        player_id = answer[PLAYER_ID]
        score_override = given_players[player_id].get(SCORE_OVERRIDE, None)
        wager = answer[WAGER] if score_override is None else score_override  # hack here to override

        is_correct = given_players[player_id].get(CORRECT, None)
        points_awarded = wager if is_correct else 0

        mongo.update("answer", answer['answer_id'], {CORRECT: is_correct, POINTS_AWARDED: points_awarded})

        award_points(session_id, player_id, points_awarded, rescore)

    score_flag = f"{ROUNDS}.{round_id}.{QUESTIONS}.{question_id}.{SCORED}"
    answ = f"{ROUNDS}.{round_id}.{QUESTIONS}.{question_id}.{ANSWER}"
    real_answer = get_real_question(session, round_id, question_id)[ANSWER]

    mongo.update("session", session_id, {score_flag: True, answ: real_answer})

    mongo.incr_state(session_id)
    return succeed(data)


def get_real_question(session, round_index, question_index):
    round_id = session[ROUNDS][round_index][ROUND_ID]
    r = get_round(round_id)[OBJECT]

    question_id = r.get(QUESTIONS)[question_index]
    return get_question(question_id)[OBJECT]


def award_points(session_id, player_id, points, rescore):
    # update_scoreboard -> $inc session.points[player_id]: points_awarded
    if rescore:
        mongo.pop("session", session_id, f"{SCOREBOARD}.{player_id}")
    mongo.push("session", session_id, f"{SCOREBOARD}.{player_id}", points)
    return succeed({PLAYER_ID: player_id})


@app.route(f'{URL_BASE}/session/<session_id>/scoreboard', methods=['GET'])
def get_current_scoreboard(session_id):
    print(session_id)
    scores = get_scoreboard(session_id)[OBJECT]
    print(scores)

    ret = []
    for player_id in scores:
        player = get_player(player_id)
        print(player)
        player = player[OBJECT]
        ret.append({
            TEAM_NAME: player[TEAM_NAME],
            "score": scores[player_id]
        })
    print(ret)

    return _resp(succeed(ret))


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
    RestField(QUESTION_ID, int),
    RestField(ROUND_ID, int),
    IdField(PLAYER_ID, "player"),
    RestField(ANSWER),
    RestField(WAGER, int),
)


@app.route(f'{URL_BASE}/session/<session_id>/answer', methods=['POST'])
def answer_one_question(session_id):
    return _resp(answer_question(session_id, request.json))


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
    rindex = data[ROUND_ID]
    qindex = data[QUESTION_ID]

    legal_wagers = get_legal_wagers(session, rindex, player_id)
    wager = data[WAGER]
    if wager not in legal_wagers:
        return fail(f"Wager {wager} is illegal")

    answers = session[ROUNDS][rindex][QUESTIONS][qindex].get(ANSWERS, None)
    if answers is None:
        return fail(f"{QUESTION}_id {qindex} is not open")

    answer = create_answer(data)
    if not answer[SUCCESS]:
        return answer
    answer = answer[OBJECT]

    answer_id = answer[ID]
    array = f"{ROUNDS}.{rindex}.{QUESTIONS}.{qindex}.{ANSWERS}.{player_id}"
    success = mongo.push("session", session_id, array, answer_id)
    if not success:
        return fail(f"Failed to add add {answer_id} for player {player_id}")

    mongo.incr_state(session_id)

    return succeed(answer)


@app.route(f'{URL_BASE}/session/<session_id>/wagers', methods=['GET'])
def legal_wagers_for_player(session_id):
    player_id = request.args.get(PLAYER_ID, None)
    round_id = request.args.get(ROUND_ID, None)
    session = get_session(session_id)[OBJECT]

    try:
        round_id = int(round_id)
    except:
        return _resp(fail("Bad round ID"))

    return _resp(succeed(get_legal_wagers(session, round_id, player_id)))


def get_legal_wagers(session, round_id, player_id):
    """
    must not
    """
    r = session[ROUNDS][round_id]
    all_wagers = r[WAGERS].copy()
    questions = r[QUESTIONS]

    for question in questions:
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
    editor_key = "x12345x"
    app.run(host="0.0.0.0", debug=True, threaded=True)
