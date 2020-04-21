from trivia_server2 import create_round, delete_round, get_round, update_round, get_rounds
from trivia_server2 import create_question, delete_question, get_question

def missing_name():
	print("\nTEST: round is missing name attribute")
	data = {}
	created, msg = create_round(data)
	print("   {}".format(msg))

def name_not_str():
	print("\nTEST: name is not str")
	data = {"name": []}
	created, msg = create_round(data)
	print("   {}".format(msg))

def missing_questions():
	print("\nTEST: missing attr 'questions'")
	data = {"name": "f"}
	created, msg = create_round(data)
	print("   {}".format(msg))

def questions_not_list():
	print("\nTEST: attr 'questions' is not list")
	data = {"name": "f", "questions": ""}
	created, msg = create_round(data)
	print("   {}".format(msg))

def missing_wagers():
	print("\nTEST: missing attr 'wagers'")
	data = {"name": "f", "questions": []}
	created, msg = create_round(data)
	print("   {}".format(msg))

def wagers_not_list():
	print("\nTEST: attr 'wagers' is not list")
	data = {"name": "f", "questions": [], "wagers" : "f"}
	created, msg = create_round(data)
	print("   {}".format(msg))

def question_id_is_not_str():
	print("\nTEST: question ID is not str")
	data = {"name": "f", "questions": [{}, ""], "wagers" : [1, 2]}
	created, msg = create_round(data)
	print("   {}".format(msg))

def question_id_is_invalid():
	print("\nTEST: question ID is not valid")
	data = {"name": "f", "questions": ["L"], "wagers" : [1]}
	created, msg = create_round(data)
	print("   {}".format(msg))

def question_id_is_valid_but_nonexistent():
	print("\nTEST: question ID is valid but nonexistent")
	data = {"name": "f", "questions": ["5e9c82c83e9f1b817df277aa"], "wagers" : [1]}
	created, msg = create_round(data)
	print("   {}".format(msg))

def question_id_is_duplicate():
	print("\nTEST: question ID is duplicated")
	data = {"name": "f", "questions": ["5e9c82c83e9f1b817df277aa", "5e9c82c83e9f1b817df277aa"], "wagers" : [1, 2]}
	created, msg = create_round(data)
	print("   {}".format(msg))

def wager_is_not_int():
	print("\nTEST: wager is not int")
	data = {"name": "f", "questions": [""], "wagers" : ["L"]}
	created, msg = create_round(data)
	print("   {}".format(msg))

def wager_is_negative():
	print("\nTEST: wager is negative")
	data = {"name": "f", "questions": [""], "wagers" : [-1]}
	created, msg = create_round(data)
	print("   {}".format(msg))

def wager_is_zero():
	print("\nTEST: wager is zero")
	data = {"name": "f", "questions": [""], "wagers" : [0]}
	created, msg = create_round(data)
	print("   {}".format(msg))

def wagers_list_is_not_the_same_length_as_questions_list():
	print("\nTEST: wager/questions lengths are different")
	data = {"name": "f", "questions": [""], "wagers" : [1, 2]}
	created, msg = create_round(data)
	print("   {}".format(msg))

def crud():
	print("\nTEST: successful crud")
	created, question = create_question({"question":"a", "answer":"b", "category":"c"})
	if created:
		question_id = question.get("id")

		data = {
			"name": "test round",
			"questions": [question_id],
			"wagers": [3]
		}
		created, obj = create_round(data)
		print("   created {}".format(obj))

		if created:
			round_id = obj.get("id")

			obj  = get_round(round_id)
			print("   got: {}".format(obj))

			updated = update_round(round_id, {"name" : "ffff"})

			rounds =  get_rounds()
			print("all rounds: {}".format(rounds))

			success = delete_round(round_id)
			print("   deleted: {} {}".format(success, round_id))

			rounds =  get_rounds()
			print("all rounds: {}".format(rounds))

		delete_question(question_id)

def round_used_added_to_question():
	"""
	when I add a question to a round, 
	the round_id should be stored in the
	questions rounds_used list
	"""
	print("\nTEST: rounds_used added to question")
	qdata = {
		"question": "a",
		"answer": "b",
		"category" : "c"
	}
	created, obj = create_question(qdata)
	if created:
		question_id = obj.get("id")
		rdata = {
			"name": "test round",
			"questions": [question_id],
			"wagers": [3]
		}
		created, obj = create_round(rdata)
		if created:
			round_id = obj.get("id")
			print("   round ID: {}".format(round_id))

			question = get_question(question_id)
			print("   rounds_used: {} (question: {})".format(question.get("rounds_used", []), question))

			delete_round(round_id)

		delete_question(question_id)


def round_removed_from_question_when_round_deleted():
	"""
	when I delete a round, it should be removed from 
	the rounds_used list on each question in round
	"""
	pass

def question_removed_from_round_when_question_is_deleted():
	"""
	when I delete a question, it should be deleted from
	each round that it is used in
	"""
	pass

def round_removed_from_question_when_question_removed_from_round():
	"""
	when I remove a question from a round, the round
	should be removed from this questions rounds_used list
	"""
	pass



if __name__ == "__main__":
	# missing_name()
	# name_not_str()
	# missing_questions()
	# questions_not_list()
	# missing_wagers()
	# wagers_not_list()
	# question_id_is_not_str()
	# question_id_is_invalid()
	# question_id_is_valid_but_nonexistent()
	# question_id_is_duplicate()
	# wager_is_not_int()
	# wager_is_negative()
	# wager_is_zero()
	# wagers_list_is_not_the_same_length_as_questions_list()
	# crud()
	round_used_added_to_question()

