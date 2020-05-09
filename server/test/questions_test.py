from pprint import pprint
from random import randint
from editor_server import (create_question, delete_question, get_question,
                           update_question, get_questions)


def object_with_id_in_list(list, object_id, is_present):
    """
    Test if object with ID x is found in list

    args:
        list: list of dicts from get_all(object_type)
        object_id: expected object id
        is_present: True if object should be in list, False if not
    """
    found = False
    for item in list:
        item_id = item['id']
        if item_id == object_id:
            found = True
            break
    return found == is_present


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

    questions = get_questions()
    print("   all questions: {}".format(questions))
    assert object_with_id_in_list(questions, question_id, True)

    delete_question(question_id)

    questions = get_questions()
    print("   all questions: {}".format(questions))
    assert object_with_id_in_list(questions, question_id, False)
