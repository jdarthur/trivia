from pprint import pprint
from random import randint
from editor_server import (create_question, delete_question, get_question,
                           update_question, get_questions)


def create_and_print(data):
    created = create_question(data)
    print("created:")
    pprint(created)
    return created


def dummy_question():
    qdata = {
        "question": f"test question {randint(1, 100000)}",
        "answer": "answer",
        "category": "category"
    }

    created = create_question(qdata)
    if created["success"]:
        return created["object"]["id"]
    return None


def missing_question():
    print("\nTEST: question is missing 'question' attr")
    q = {"answer": "a complicated mating dance", "category": "birds"}
    create_and_print(q)


def missing_answer():
    print("\nTEST: question is missing 'answer' attr")
    q = {"question": "what's a computer", "category": "commercials"}
    create_and_print(q)


def missing_category():
    print("\nTEST: question is missing 'category' attr")
    q = {"question": "what's 2+2", "answer": "6"}
    create_and_print(q)


def question_is_dict():
    print("\nTEST: question is dict")
    q = {"question": {"test": "123"}, "answer": "answer", "category": "birds"}
    create_and_print(q)


def crud():
    print("\nTEST: valid question create, read, update, delete")
    question_id = dummy_question()

    obj = get_question(question_id)
    print("   got: {}".format(obj))

    updated = update_question(question_id, {"answer": "ffff"})
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
