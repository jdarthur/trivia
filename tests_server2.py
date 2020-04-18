from trivia_server2 import is_valid_game, get_game


def missing_name() :
	print("TEST: missing name")
	data = {"test": "123"}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)
	
def missing_rounds() :
	print("TEST: missing rounds")
	data = {"name": "test"}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)

def rounds_not_list() :
	print("TEST: rounds not list")
	data = {"name": "test", "rounds": "f"}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)

def rounds0_not_dict():
	print("TEST: rounds0 not list")
	data = {"name": "test", "rounds": ["f"]}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)

def missing_rounds():
	print("TEST: missing rounds at rounds.0")
	data = {"name": "test", "rounds": [{"f" : "f"}]}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)

def rounds00_not_dict():
	print("TEST: rounds.0.0 is not dict")
	data = {"name": "test", "rounds": [{"round" : "f"}]}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)

def round0_not_list():
	print("TEST: rounds.0 not list")
	data = {"name": "test", "rounds": [{"round" : {"f" : "f"}}]}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)

def rounds00_missing_question():
	print("TEST: rounds.0.0 missing question")
	data = {"name": "test", "rounds": [{"round" : [{"f" : "f"}]}]}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)

def rounds00_missing_answer():
	print("TEST: rounds.0.0 missing answer")
	data = {"name": "test", "rounds": [{"round" : [{"question" : "f"}]}]}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)

def rounds00_missing_category():
	print("TEST: rounds.0.0 missing category")
	data = {"name": "test", "rounds": [{"round" : [{"question" : "f", "answer": "f"}]}]}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)

def good():
	print("TEST: 1 question 1 round")
	data = {"name": "test", "rounds": [{"round" : [{"question" : "f", "answer": "f", "category" : "f"}]}]}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)

def rounds01_missing_question():
	print("TEST: missing question round.0.1")
	data = {"name": "test", "rounds": [{"round" : [{"question" : "f", "answer": "f", "category" : "f"}, {"question" : "f"}]}]}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)

def rounds10_missing_question():
	print("TEST: missing question round.1.0")
	data = {"name": "test", "rounds": [{"round" : [{"question" : "f", "answer": "f", "category" : "f"}]},
									   {"round" : [{"f" : "f"}]}]}
	valid, error_msg = is_valid_game(data)
	valid_error(valid, error_msg)

def valid_error(valid, error):
	if valid:
		print("   is valid: true")
	else:
   		print("   is valid: {} (error: {})".format(valid, error))


if __name__ == "__main__":
	missing_name()
	missing_rounds()
	rounds_not_list()
	rounds0_not_dict()
	missing_rounds()
	round0_not_list()
	rounds00_missing_question()
	rounds00_missing_answer()
	rounds00_missing_category()
	good()
	rounds01_missing_question()
	rounds10_missing_question()

