import requests

base_url = "http://localhost:8080"  # golang
# base_url = "http://localhost:5000" # python
"""
========================
        Questions
========================
"""


def get_token():
    return "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJRWmVZQ0N4WTJZdjF3Nk94c1pmYSJ9.eyJpc3MiOiJodHRwczovL2JvcnR0cml2aWEudXMuYXV0aDAuY29tLyIsInN1YiI6ImF1dGgwfDVmY2JlODlkZjA4YTRlMDA3NmFlNWNkYSIsImF1ZCI6WyJodHRwczovL2JvcnR0cml2aWEuY29tL2VkaXRvciIsImh0dHBzOi8vYm9ydHRyaXZpYS51cy5hdXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNjYxMTkzNTgyLCJleHAiOjE2NjEyNzk5ODIsImF6cCI6IjAzY0x2NjBqTjdoQzc5SzhvVVhIREYxd3NlblJUTXg1Iiwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCJ9.eIQf2O6V-kKkwjrakdu_-vVyjvGLoBmALPKcVvjSKw-gUUjzUczDs6ysYLoFlkzQ9yha6eYHvitcqiV2uGFyOC_1tUYWQvifmcxqkKG3nvdTaIcc5z4TiNkLHtWRN8WTFshI2zA0pxNPQTAMIJMR4M5Wc3SlhoeqN-m4RDavhNHAdGo4yOq2MZ6VVx2K5PdqcnJNsOcODgu1b2PsAu3G-vwFxZNLFbVM726bkJ9iIFyROwUqTxjEJJD7EfRIDECA7e8b1PlKUCWdw2Mmt8S1KxQNOL-2o_koATQYW_YjTfzJrfXurVCR6KxFKu2esMRMX2XFfJyewvXEKXltSuIUoQ"


def alt_token():
    return "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJRWmVZQ0N4WTJZdjF3Nk94c1pmYSJ9.eyJpc3MiOiJodHRwczovL2JvcnR0cml2aWEudXMuYXV0aDAuY29tLyIsInN1YiI6ImF1dGgwfDYxMWVmYzEyNmMyZWEyMDA3MWQ4N2E5OCIsImF1ZCI6WyJodHRwczovL2JvcnR0cml2aWEuY29tL2VkaXRvciIsImh0dHBzOi8vYm9ydHRyaXZpYS51cy5hdXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNjYxMjAwMjMxLCJleHAiOjE2NjEyODY2MzEsImF6cCI6IjAzY0x2NjBqTjdoQzc5SzhvVVhIREYxd3NlblJUTXg1Iiwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCJ9.R4oMK6Rbie8PpYj6dI3w1wD1TQX_yoasRYxCA2fMRnyOD_TTBIsjA36eTuHVJ3BtH6X9bubOV4Ws0KXEF8IE6FR2dLNVvKAVsFtW_wY5A8zwz_sdu8XFl9EXzT5yUySAEjagqGynFrA9P_6JRsPkgyfydnyhVagcYA7B_v5RHWBkvzx1A2vveHwTfw1o45vgR4kYDcoWcbHea3j4J0V2-VLeNZ7Ejk2o_FF7G_0Zdypecf2oNGLDBXywx8MHllcbPKH9Uw_sW5rDi2gJWyGNydGK4bOYP0023B22uRkJHGqsN73WDqLJm7ZsfXiBQeyvYw8VSNLXKLk-BYOxD-UDHQ"


def create_question(data):
    url = f"{base_url}/editor/question"
    r = requests.post(url, json=data, headers={"borttrivia-token": get_token()})
    return r.json()


def get_question(question_id):
    url = f"{base_url}/editor/question/{question_id}"
    r = requests.get(url, headers={"borttrivia-token": get_token()})
    return r.json()


def get_questions(unused_only=True, text_filter=None):
    url = f"{base_url}/editor/questions?unused_only={str(unused_only).lower()}"
    if text_filter is not None:
        url += f"&text_filter={text_filter}"
    r = requests.get(url, headers={"borttrivia-token": get_token()})
    return r.json()["questions"]


def update_question(question_id, data):
    url = f"{base_url}/editor/question/{question_id}"
    r = requests.put(url, json=data, headers={"borttrivia-token": get_token()})
    return r.json()


def delete_question(question_id, token=get_token()):
    url = f"{base_url}/editor/question/{question_id}"
    r = requests.delete(url, headers={"borttrivia-token": token})
    return r.json()


"""
========================
        Rounds
========================
"""


def create_round(data):
    url = f"{base_url}/editor/round"
    r = requests.post(url, json=data, headers={"borttrivia-token": get_token()})
    return r.json()


def get_round(round_id):
    url = f"{base_url}/editor/round/{round_id}"
    r = requests.get(url, headers={"borttrivia-token": get_token()})
    return r.json()


def get_rounds(unused_only=True, text_filter=None):
    url = f"{base_url}/editor/rounds?unused_only={str(unused_only).lower()}"
    if text_filter is not None:
        url += f"&text_filter={text_filter}"
    r = requests.get(url, headers={"borttrivia-token": get_token()})
    return r.json()["rounds"]


def update_round(round_id, data):
    url = f"{base_url}/editor/round/{round_id}"
    r = requests.put(url, json=data, headers={"borttrivia-token": get_token()})
    return r.json()


def delete_round(round_id):
    url = f"{base_url}/editor/round/{round_id}"
    r = requests.delete(url, headers={"borttrivia-token": get_token()})
    return r.json()


"""
========================
        Games
========================
"""


def create_game(data):
    url = f"{base_url}/editor/game"
    r = requests.post(url, json=data, headers={"borttrivia-token": get_token()})
    return r.json()


def get_game(game_id):
    url = f"{base_url}/editor/game/{game_id}"
    r = requests.get(url, headers={"borttrivia-token": get_token()})
    return r.json()


def get_games(unused_only=True, text_filter=None):
    url = f"{base_url}/editor/games?unused_only={str(unused_only).lower()}"
    if text_filter != None:
        url += f"&text_filter={text_filter}"
    r = requests.get(url)
    return r.json()["games"]


def update_game(game_id, data):
    url = f"{base_url}/editor/game/{game_id}"
    r = requests.put(url, json=data, headers={"borttrivia-token": get_token()})
    return r.json()


def delete_game(game_id):
    url = f"{base_url}/editor/game/{game_id}"
    r = requests.delete(url, headers={"borttrivia-token": get_token()})
    return r.json()


"""
========================
        Sessions
========================
"""


def create_session(data):
    url = f"{base_url}/gameplay/session"
    r = requests.post(url, json=data)
    return r.json()


def get_session(session_id):
    url = f"{base_url}/gameplay/session/{session_id}"
    r = requests.get(url)
    return r.json()


def get_sessions():
    url = f"{base_url}/gameplay/sessions"
    r = requests.get(url)
    return r.json()["sessions"]


def update_session(session_id, data):
    url = f"{base_url}/gameplay/session/{session_id}"
    r = requests.put(url, json=data)
    return r.json()


def delete_session(session_id, mod_id):
    url = f"{base_url}/gameplay/session/{session_id}?mod={mod_id}"
    r = requests.delete(url)
    return r.json()


def add_to_session(session_id, data):
    url = f"{base_url}/gameplay/session/{session_id}/add"
    r = requests.post(url, json=data)
    return r.json()


def remove_from_session(session_id, data):
    url = f"{base_url}/gameplay/session/{session_id}/remove"
    r = requests.post(url, json=data)
    return r.json()


def start_session(session_id, admin_id):
    url = f"{base_url}/gameplay/session/{session_id}/start"
    data = {"player_id": admin_id}
    r = requests.post(url, json=data)
    return r.json()


def set_current_question(session_id, admin_id, question_id, round_id):
    print(f"set round {round_id}, question {question_id}")
    url = f"{base_url}/gameplay/session/{session_id}/current-question"
    data = {
        "player_id": admin_id,
        "question_id": question_id,
        "round_id": round_id
    }
    r = requests.put(url, json=data)
    return r.json()


def get_current_question(session_id):
    url = f"{base_url}/gameplay/session/{session_id}/current-question"
    r = requests.get(url)
    return r.json()


def get_current_round(session_id):
    url = f"{base_url}/gameplay/session/{session_id}/current-round"
    r = requests.get(url)
    return r.json()


def set_current_round(session_id: str, admin_id: str, round_id: int, question_id=0):
    print(f"set round {round_id}, question {question_id}")
    url = f"{base_url}/gameplay/session/{session_id}/current-round"
    data = {
        "player_id": admin_id,
        "question_id": question_id,
        "round_id": round_id
    }
    r = requests.put(url, json=data)
    return r.json()


def get_scoreboard(session_id, player_id=None):
    url = f"{base_url}/gameplay/session/{session_id}/scoreboard"
    if player_id is not None:
        url += f"?player_id={player_id}"
    r = requests.get(url)
    return r.json()


def score_question(session_id, data):
    url = f"{base_url}/gameplay/session/{session_id}/score"
    r = requests.put(url, json=data)
    return r.json()


"""
========================
        Players
========================
"""


def create_player(data):
    url = f"{base_url}/gameplay/player"
    r = requests.post(url, json=data)
    return r.json()


def get_player(player_id):
    url = f"{base_url}/gameplay/player/{player_id}"
    r = requests.get(url)
    return r.json()


def get_players_in_session(session_id, mod=None):
    url = f"{base_url}/gameplay/session/{session_id}/players"
    if mod is not None:
        url += f"?player_id={mod}"
    r = requests.get(url)
    return r.json()["players"]


def update_player(player_id, data):
    url = f"{base_url}/gameplay/player/{player_id}"
    r = requests.put(url, json=data)
    return r.json()


def delete_player(player_id):
    url = f"{base_url}/gameplay/player/{player_id}"
    r = requests.delete(url)
    return r.json()


"""
========================
        Answers
========================
"""


def answer_question(session_id, data):
    url = f"{base_url}/gameplay/session/{session_id}/answer"
    r = requests.post(url, json=data)
    return r.json()


def get_answers(session_id, round_id, question_id, player_id=None):
    url = f"{base_url}/gameplay/session/{session_id}/answers?question_id={question_id}&round_id={round_id}"
    if player_id is not None:
        url += f"&player_id={player_id}"
    r = requests.get(url)
    print(r.json())
    return r.json()["answers"]

"""
========================
        Collections
========================
"""


def create_collection(data, token=get_token()):
    url = f"{base_url}/editor/collections"
    r = requests.post(url, json=data, headers={"borttrivia-token": token})
    return r.json()


def get_collection(collection_id):
    url = f"{base_url}/editor/collections/{collection_id}"
    r = requests.get(url, headers={"borttrivia-token": get_token()})
    return r.json()


def get_collections(token=get_token()):
    url = f"{base_url}/editor/collections"
    r = requests.get(url, headers={"borttrivia-token": token})
    return r.json()["collections"]


def import_collection(collection_id, token=get_token()):
    url = f"{base_url}/editor/collections/{collection_id}/import"
    r = requests.post(url, headers={"borttrivia-token": token})
    return r.json()


def delete_collection(collection_id, token=get_token()):
    url = f"{base_url}/editor/collections/{collection_id}"
    r = requests.delete(url, headers={"borttrivia-token": token})
    return r.json()
