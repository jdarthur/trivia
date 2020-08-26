from pprint import pprint
from editor_server import (create_question, delete_question, get_question,
                           update_question, get_questions)
from .test_helpers import dummy_question, object_with_id_in_list


def create_and_print(data):
    created = create_question(data)
    print("created:")
    pprint(created)
    return created


def test_missing_question():
    print("\nTEST: question is missing 'question' attr")
    q = {"answer": "a complicated mating dance", "category": "birds"}
    created = create_and_print(q)
    assert created["success"] is False


def test_missing_answer():
    print("\nTEST: question is missing 'answer' attr")
    q = {"question": "what's a computer", "category": "commercials"}
    created = create_and_print(q)
    assert created["success"] is False


def test_missing_category():
    print("\nTEST: question is missing 'category' attr")
    q = {"question": "what's 2+2", "answer": "6"}
    created = create_and_print(q)
    assert created["success"] is False


def test_question_is_dict():
    print("\nTEST: question is dict")
    q = {"question": {"test": "123"}, "answer": "answer", "category": "birds"}
    created = create_and_print(q)
    assert created["success"] is False


def test_crud():
    print("\nTEST: valid question create, read, update, delete")
    question_id = dummy_question()

    obj = get_question(question_id)
    print("   got: {}".format(obj))
    assert obj['object']['id'] == question_id

    updated = update_question(question_id, {"answer": "ffff"})
    print("   updated: {}".format(updated))
    assert updated['object']['answer'] == "ffff"

    questions = get_questions()['object']
    print("   all questions: {}".format(questions))
    assert object_with_id_in_list(questions, question_id, True)

    delete_question(question_id)

    questions = get_questions()['object']
    print("   all questions: {}".format(questions))
    assert object_with_id_in_list(questions, question_id, False)

def test_get_questionss_with_exclusion_filter():
    print("\nTEST: get rounds with filtering")
    questions = get_questions(unused_only=False)
    all_questions_len = len(questions['object'])
    print(f"all rounds ({all_questions_len}):")
    pprint(questions)

    questions = get_questions(unused_only=True)
    filtered_questions_len = len(questions['object'])
    print(f"all rounds ({filtered_questions_len}):")
    pprint(questions)

    assert all_questions_len >= filtered_questions_len