"""
Trivia server mark II

@author jdarthur
@date 12 Apr 2020
"""

from datetime import datetime

from mongo_manager import MongoManager

from validator import model, succeed, fail, RestField, IdField
from validator import SUCCESS, OBJECT, CREATE, UPDATE, DELETE, GET_ONE, SUBCREATE
from editor_server import get_game, get_round, get_question

from flask import Flask


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
CORRECT = "correct"

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
        return mod

    mod_id = str(mod[OBJECT][ID])

    # create session with this moderator ID
    data[STARTED] = False
    data[MODERATOR] = mod_id
    created = mongo.create("session", data)
    if not created:
        return fail("Failed to create session")
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
    return fail(f"Failed to update player with data {data}")


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
        return fail("Cannot add player to already-started session")

    player_id = data[PLAYER_ID]
    success = mongo.push("session", session_id, PLAYERS, player_id)
    if not success:
        return fail("Failed to add player to session")

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
        return fail("Failed to remove player from session")

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

        first_round = startable[OBJECT][ROUND_ID]

        success = mongo.update("session", session_id, data)
        if success:
            session.update(data)

            set_round = set_current_round(session_id, first_round)
            if not set_round[SUCCESS]:
                return set_round

            # set_question = set_current_question(session_id, first_question)
            # if not set_question[SUCCESS]:
            #     return set_question

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
    return get_question_by_id(session_id, question_id)


def set_current_question(session_id, question_id):
    return _set_current_question(session_id, {QUESTION_ID: question_id})


cq_model = [
    IdField(QUESTION_ID, "question")
]
@model(cq_model, SUBCREATE, "session")
def _set_current_question(session_id, data, session={}):
    """
    validate that question ID in round
    set question.open = True
    set session.current_question = question_id
    return new question_id
    """
    # session_mod = session[MODERATOR]
    # if data[MODERATOR] != session_mod:
    #     return fail(f"Cannot set mod using ID {data[MODERATOR]}")

    r = get_current_round(session_id)
    if r[SUCCESS]:
        r = r[OBJECT]
        question_id = data[QUESTION_ID]
        if question_id not in r.get(QUESTIONS, []):
            return fail(f"{QUESTION} with id {question_id} is not in current round {r}.")

        question = get_question(question_id)
        if not question[SUCCESS]:
            return question
        question = question[OBJECT]

        data_to_update = {
            f"{QUESTIONS}.{question_id}.{QUESTION}": question[QUESTION],
            f"{QUESTIONS}.{question_id}.{ANSWERS}": {},
            CURRENT_QUESTION: question_id
        }
        success = mongo.update("session", session_id, data_to_update)
        if not success:
            return fail(f"Failed to set question for question_id {question_id}")

        return succeed({CURRENT_QUESTION: question_id})

    return fail(f"Failed to get round with ID {session.get(ROUND_ID)}")


def get_question_by_id(session_id,  question_id):
    return _get_question_by_id(session_id, {QUESTION_ID: question_id})


@model(cq_model, UPDATE, "session")
def _get_question_by_id(session_id, data, session={}):
    """
    if not open: (i.e. question not in session.answers)
        return category
    if is_current_question and not scored:
        return question, category
    if scored:
        return question category, answer
    """
    question_id = data[QUESTION_ID]
    questions = session.get(QUESTIONS)
    if question_id not in questions:
        return fail(f"{QUESTION}_id {question_id} not found in session {session_id}")
    question = questions[question_id]
    question[ID] = question_id
    return succeed(question)


@model(smodel, GET_ONE, "session")
def get_current_round(session_id, session={}):
    """
    return round_name, list of questions, list of wagers
    """
    round_id = session.get(CURRENT_ROUND)
    r = session.get(ROUNDS, {}).get(round_id, None)
    r[ID] = round_id
    return succeed(r)


def set_current_round(session_id, round_id):
    return _set_current_round(session_id, {ROUND_ID: round_id})


cr_model = [
    IdField(ROUND_ID, "round")
]
@model(cr_model, SUBCREATE, "session")
def _set_current_round(session_id, data, session={}):
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
            r = r[OBJECT]
            data_to_update = {
                 f"{ROUNDS}.{round_id}": {WAGERS: r[WAGERS], QUESTIONS: r[QUESTIONS]},
                 CURRENT_ROUND: round_id
            }
            success = mongo.update("session", session_id, data_to_update)
            if success:
                # for each question, populate questions.id.category
                questions = r[QUESTIONS]
                for question_id in questions:
                    question = get_question(question_id)
                    if not question[SUCCESS]:
                        return question
                    question = question[OBJECT]

                    data_to_update = {f"{QUESTIONS}.{question_id}": {CATEGORY: question[CATEGORY]}}
                    success = mongo.update("session", session_id, data_to_update)
                    if not success:
                        return fail(f"Failed to add category for question {question_id}")

                set_first_q = set_current_question(session_id, questions[0])
                if not set_first_q[SUCCESS]:
                    return set_first_q

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


@model(cq_model, UPDATE, "session")
def get_answers(session_id, question_id, session={}):
    """
    if not is_current_question and not scored:
        return failure

    get map player_id -> [answer_ids]
    compose map
        player_id:
            answer: x
            wager: n
    """
    answers = session.get(QUESTIONS).get(question_id, {}).get(ANSWERS, None)
    if answers is None:
        return fail(f"{QUESTION}_id {question_id} is not open")

    for player_id in answers:
        answer_ids = answers[player_id]
        for answer in answer_ids:
            pass


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
    for team in teams:
        get_wager(question_id)
        if team.correct:
            $inc: { scoreboard.team_id.score : wager }

    set question.scored = true
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

    for player_id in given_players:
        answer_ids = answers.get(player_id, [])
        if len(answer_ids) == 0:
            return fail(f"{PLAYER_ID} {player_id} has not answered question {question_id}")

        # last answer is the one scored
        answer = get_answer(answer_ids[-1])
        if not answer[SUCCESS]:
            return answer

        answer = answer[OBJECT]
        wager = answer[WAGER]

        is_correct = given_players[player_id].get(CORRECT, None)
        if is_correct is None:
            return fail(f"Did not set correct True/False for {PLAYER_ID} {player_id}")

        points_awarded = wager if is_correct else 0
        award_points(session_id, player_id, points_awarded)


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


def award_points(session_id, player_id, points):
    # update_scoreboard -> $inc session.points[player_id]: points_awarded
    pass


answer_model = (
    IdField(QUESTION_ID, "question"),
    IdField(ROUND_ID, "round"),
    IdField(PLAYER_ID, "player"),
    RestField(ANSWER),
    RestField(WAGER, int),
)


@model(answer_model, SUBCREATE, "session")
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

    return succeed(answer)


def create_answer(data):
    success = mongo.create("answer", data)
    if not success:
        return fail("Failed to create answer")
    return succeed(success)


@model(answer_model, GET_ONE, "answer")
def get_answer(answer_id, answer={}):
    return succeed(answer)


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
