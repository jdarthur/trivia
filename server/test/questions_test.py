from pprint import pprint
# from editor_server import (delete_question, get_question,
                           # update_question, get_questions)
from .test_helpers import dummy_question, object_with_id_in_list, has_errors, DummyQuestion
from .api_calls import create_question, get_question, get_questions, update_question, delete_question, create_round, delete_round


def create_and_print(data):
    created = create_question(data)
    print("created:")
    pprint(created)
    return created


# def test_missing_question():
#     print("\nTEST: question is missing 'question' attr")
#     q = {"answer": "a complicated mating dance", "category": "birds"}
#     created = create_and_print(q)
#     assert has_errors(created) == True


# def test_missing_answer():
#     print("\nTEST: question is missing 'answer' attr")
#     q = {"question": "what's a computer", "category": "commercials"}
#     created = create_and_print(q)
#     assert has_errors(created) == True


# def test_missing_category():
#     print("\nTEST: question is missing 'category' attr")
#     q = {"question": "what's 2+2", "answer": "6"}
#     created = create_and_print(q)
#     assert has_errors(created) == True


def test_question_is_dict():
    print("\nTEST: question is dict")
    q = {"question": {"test": "123"}, "answer": "answer", "category": "birds"}
    created = create_and_print(q)
    assert has_errors(created) == True


def test_crud():
    print("\nTEST: valid question create, read, update, delete")
    question_id = dummy_question()

    obj = get_question(question_id)
    print("   got: {}".format(obj))
    assert obj['id'] == question_id

    updated = update_question(question_id, {"answer": "ffff"})
    print("   updated: {}".format(updated))
    assert updated['answer'] == "ffff"

    questions = get_questions()
    print("   all questions: {}".format(questions))
    assert object_with_id_in_list(questions, question_id, True)

    delete_question(question_id)

    questions = get_questions()
    print("   all questions: {}".format(questions))
    assert object_with_id_in_list(questions, question_id, False)


def test_update_with_invalid_value():
    print("\nTEST: update a question with an invalid value")
    with DummyQuestion() as question_id:

        updated = update_question(question_id, {"answer": 3})
        print("   updated: {}".format(updated))
        assert has_errors(updated) == True

        obj = get_question(question_id)
        print("   got: {}".format(obj))
        assert obj["answer"] != 3

def test_update_rounds_used():
    print("\nTEST: update a question's 'rounds_used' field")
    with DummyQuestion() as question_id:

        updated = update_question(question_id, {"rounds_used": ["test1234"]})
        print("   updated: {}".format(updated))
        assert has_errors(updated) == True

        obj = get_question(question_id)
        print("   got: {}".format(obj))
        assert len(obj["rounds_used"]) == 0

def test_create_with_rounds_used():
    print("\nTEST: create a question with 'rounds_used' field filled out")
    q = {"question": "test1234", "answer": "answer", "category": "birds", "rounds_used": ["test1234"]}
    created = create_and_print(q)
    assert has_errors(created) == True

def test_create_with_extra_fields():
    print("\nTEST: create a question with extra fields and make sure they are ignored")
    q = {"question": "test1234", "answer": "answer", "category": "birds", "extra1": "something"}
    created = create_and_print(q)
    assert has_errors(created) == False

    delete_question(created["id"])


def test_get_questionss_with_exclusion_filter():
    q = {"question": "test1234", "answer": "answer", "category": "birds", "extra1": "something"}
    created_q = create_question(q)

    r = {"name": "f", "questions": [created_q["id"]], "wagers": [1]}
    created_r = create_round(r)

    print("\nTEST: get rounds with filtering")
    questions = get_questions(unused_only=False)
    all_questions_len = len(questions)
    print(f"all rounds ({all_questions_len}):")
    pprint(questions)

    questions = get_questions(unused_only=True)
    filtered_questions_len = len(questions)
    print(f"all rounds ({filtered_questions_len}):")
    pprint(questions)

    delete_question(created_q["id"])
    delete_round(created_r["id"])

    assert all_questions_len > filtered_questions_len

