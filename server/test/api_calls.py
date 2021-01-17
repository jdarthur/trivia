import requests

base_url = "http://localhost:8080/editor" # golang
#base_url = "http://localhost:6000/editor" # python
"""
========================
        Questions
========================
"""
def create_question(data):
    url = f"{base_url}/question"
    r = requests.post(url, json=data)
    return r.json()

def get_question(question_id):
    url = f"{base_url}/question/{question_id}"
    r = requests.get(url)
    return r.json()

def get_questions(unused_only=True, text_filter=None):
    url = f"{base_url}/questions?unused_only={str(unused_only).lower()}"
    if text_filter != None:
    	url += f"&text_filter={text_filter}"
    r = requests.get(url)
    return r.json()["questions"]

def update_question(question_id, data):
    url = f"{base_url}/question/{question_id}"
    r = requests.put(url, json=data)
    return r.json()

def delete_question(question_id):
    url = f"{base_url}/question/{question_id}"
    r = requests.delete(url)
    return r.json()


"""
========================
        Rounds
========================
"""
def create_round(data):
    url = f"{base_url}/round"
    r = requests.post(url, json=data)
    return r.json()

def get_round(round_id):
    url = f"{base_url}/round/{round_id}"
    r = requests.get(url)
    return r.json()

def get_rounds(unused_only=True, text_filter=None):
    url = f"{base_url}/rounds?unused_only={str(unused_only).lower()}"
    if text_filter != None:
    	url += f"&text_filter={text_filter}"
    r = requests.get(url)
    return r.json()["rounds"]

def update_round(round_id, data):
    url = f"{base_url}/round/{round_id}"
    r = requests.put(url, json=data)
    return r.json()

def delete_round(round_id):
    url = f"{base_url}/round/{round_id}"
    r = requests.delete(url)
    return r.json()

"""
========================
        Games
========================
"""
def create_game(data):
    url = f"{base_url}/game"
    r = requests.post(url, json=data)
    return r.json()

def get_game(game_id):
    url = f"{base_url}/game/{game_id}"
    r = requests.get(url)
    return r.json()

def get_games(unused_only=True, text_filter=None):
    url = f"{base_url}/games?unused_only={str(unused_only).lower()}"
    if text_filter != None:
    	url += f"&text_filter={text_filter}"
    r = requests.get(url)
    return r.json()["games"]

def update_game(game_id, data):
    url = f"{base_url}/game/{game_id}"
    r = requests.put(url, json=data)
    return r.json()

def delete_game(game_id):
    url = f"{base_url}/game/{game_id}"
    r = requests.delete(url)
    return r.json()

