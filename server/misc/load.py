from trivia_server2 import create_question, get_questions, delete_question
import random


def random_question():
	return {
		"question" : "question {}".format(random_int()),
		"answer" : str(random_int()),
		"category": "category {}".format(random_int())
	}

def random_int():
	return random.randint(1, 1000000)

def delete_all_questions():
	questions = get_questions()
	print(questions)
	for question in questions:
		question_id = question["id"]
		delete_question(question_id)

if __name__ == "__main__":
	delete_all_questions()
	for i in range (0, 5):
		q = random_question()
		created, obj = create_question(q)
	