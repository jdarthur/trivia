from trivia_server2 import create_question, delete_question, get_question, update_question, get_questions

def missing_question():
	print("\nTEST: question is missing 'question' attr")
	q = {"answer": "a complicated mating dance", "category" : "birds"}
	created, msg = create_question(q)
	print("   {}".format(msg))

def missing_answer():
	print("\nTEST: question is missing 'answer' attr")
	q = {"question": "what's a computer", "category" : "commercials"}
	created, msg = create_question(q)
	print("   {}".format(msg))

def missing_category():
	print("\nTEST: question is missing 'category' attr")
	q = {"question": "what's 2+2", "answer" : "6"}
	created, msg = create_question(q)
	print("   {}".format(msg))

def question_is_dict():
	print("\nTEST: question is missing 'question' attr")
	q = {"question": {"test": "123"}, "answer": "answer", "category" : "birds"}
	created, msg = create_question(q)
	print("   {}".format(msg))

def crud():
	print("\nTEST: valid question create, read, update, delete")
	q = {"question": "test", "answer": "123", "category" : "birds"}
	created, obj = create_question(q)
	print("   created {}".format(obj))

	if created:
		question_id = obj.get("id")

		obj = get_question(question_id)
		print("   got: {}".format(obj))

		updated = update_question(question_id, {"answer" : "ffff"})
		print("   updated: {}".format(updated))

		questions = get_questions()
		print("   all questions: {}".format(questions))

		success = delete_question(question_id)
		print("   deleted: {}".format(success))

		questions = get_questions()
		print("   all questions: {}".format(questions))



if __name__ == "__main__":
	missing_question()
	missing_answer()
	missing_category()
	question_is_dict()
	crud()
