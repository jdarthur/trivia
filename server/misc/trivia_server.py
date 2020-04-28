import pprint
import time
import os

ROUND_FILENAME = "round.txt"
SINGLE_Q_FILENAME = "question.txt"
Q_INDEX = "q-index"
CATEG_FILE = "category.txt"

CATEGORIES = [
	"Geography",
	"Entertainment",
	"History",
	"Arts & Literature",
	"Science & Nature",
	"Sports & Leisure",
]



from flask import Flask, jsonify
app = Flask(__name__)


def load_questions(question_filename):
	with open(question_filename) as f:
		lines = f.readlines()

	return lines

def increment_round(new_round):
	with open(ROUND_FILENAME, "w+") as f:
		f.write(new_round.replace("##", ""))
	incr_index()
	return next_question()

def decrement_round(new_round):

	with open(ROUND_FILENAME, "w+") as f:

		f.write(new_round.replace("##", ""))
	decr_index()
	return prev_question()

def get_index():
	with open(Q_INDEX, "r+") as f:
		value = f.readlines()
		if value == []:
			return 0
		return int(value[-1])

def incr_index():
	current_index = get_index()
	with open(Q_INDEX, "a+") as f:
		val = "{}\n".format(current_index + 1)
		f.write(val)

def write_category(value):
	with open(CATEG_FILE, "w+") as f:
		f.write(value)


def decr_index():
	current_index = get_index()
	# print(current_index + 1)
	with open(Q_INDEX, "a+") as f:
		val = "{}\n".format(current_index - 1)
		f.write(val)

def reset_index():
	with open(Q_INDEX, "a+") as f:
		val = "{}\n".format(-1)
		f.write(val)

@app.route('/next', methods=['GET'])
def next_question():
	q_index = get_index()

	if q_index >= len(question_list):
		print("out of questions")

		return jsonify({"question" : "out of questions"})


	new_question = question_list[q_index + 1]
	if "##" in new_question:
		return increment_round(new_question)
	    
	else:
		with open(SINGLE_Q_FILENAME, "w+") as f:
			f.write(new_question)

		incr_index()


	category = CATEGORIES[get_index() % 7 - 1]
	write_category(category)

	return jsonify({"question" : new_question, "category" : category, "index" : get_index()})

@app.route('/prev', methods=['GET'])
def prev_question():
	q_index = get_index()

	if q_index <= 0:
		print("at first question")

	new_question = question_list[q_index - 1] 

	if "##" in new_question:
		return decrement_round(new_question)
	else:

		with open(SINGLE_Q_FILENAME, "w+") as f:
			f.write(new_question)

		decr_index()

	category = CATEGORIES[(get_index()) % 7 - 1]
	write_category(category)

	return jsonify({"question" : new_question, "category" : category, "index" : get_index()})

@app.route('/reset', methods=['GET'])
def reset():

	reset_index()
	next_question()

	return jsonify({"reset" : True})


if __name__ == "__main__":

	ALL_QUESTIONS = "trivia-15Apr2020"
	question_list = load_questions(ALL_QUESTIONS)

	if not os.path.exists(Q_INDEX):
		with open(Q_INDEX, 'w+'): pass


	app.run(host="0.0.0.0", debug=True)

