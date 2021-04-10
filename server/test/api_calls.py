import requests

base_url = "http://localhost:8080"  # golang
# base_url = "http://localhost:5000" # python
"""
========================
        Questions
========================
"""


def create_question(data):
    url = f"{base_url}/editor/question"
    r = requests.post(url, json=data)
    return r.json()


def get_question(question_id):
    url = f"{base_url}/editor/question/{question_id}"
    r = requests.get(url)
    return r.json()


def get_questions(unused_only=True, text_filter=None):
    url = f"{base_url}/editor/questions?unused_only={str(unused_only).lower()}"
    if text_filter is not None:
        url += f"&text_filter={text_filter}"
    r = requests.get(url)
    return r.json()["questions"]


def update_question(question_id, data):
    url = f"{base_url}/editor/question/{question_id}"
    r = requests.put(url, json=data)
    return r.json()


def delete_question(question_id):
    url = f"{base_url}/editor/question/{question_id}"
    r = requests.delete(url)
    return r.json()


"""
========================
        Rounds
========================
"""


def create_round(data):
    url = f"{base_url}/editor/round"
    r = requests.post(url, json=data)
    return r.json()


def get_round(round_id):
    url = f"{base_url}/editor/round/{round_id}"
    r = requests.get(url)
    return r.json()


def get_rounds(unused_only=True, text_filter=None):
    url = f"{base_url}/editor/rounds?unused_only={str(unused_only).lower()}"
    if text_filter is not None:
        url += f"&text_filter={text_filter}"
    r = requests.get(url)
    return r.json()["rounds"]


def update_round(round_id, data):
    url = f"{base_url}/editor/round/{round_id}"
    r = requests.put(url, json=data)
    return r.json()


def delete_round(round_id):
    url = f"{base_url}/editor/round/{round_id}"
    r = requests.delete(url)
    return r.json()


"""
========================
        Games
========================
"""


def create_game(data):
    url = f"{base_url}/editor/game"
    r = requests.post(url, json=data)
    return r.json()


def get_game(game_id):
    url = f"{base_url}/editor/game/{game_id}"
    r = requests.get(url)
    return r.json()


def get_games(unused_only=True, text_filter=None):
    url = f"{base_url}/editor/games?unused_only={str(unused_only).lower()}"
    if text_filter != None:
        url += f"&text_filter={text_filter}"
    r = requests.get(url)
    return r.json()["games"]


def update_game(game_id, data):
    url = f"{base_url}/editor/game/{game_id}"
    r = requests.put(url, json=data)
    return r.json()


def delete_game(game_id):
    url = f"{base_url}/editor/game/{game_id}"
    r = requests.delete(url)
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
