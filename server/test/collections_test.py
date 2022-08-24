from pprint import pprint
from random import randint

from server.test.api_calls import create_collection, get_collections, delete_question, get_collection, \
    delete_collection, alt_token, get_token, get_question, import_collection
from server.test.test_helpers import dummy_question, has_errors


def create_and_print(data, token=get_token()):
    created = create_collection(data, token)
    print("created:")
    pprint(created)
    return created


def test_get_collections():
    # assert count > 0
    # assert user_id == provided user_id
    collections = get_collections()
    pprint(collections)

    assert len(collections) > 0

    for collection in collections:
        assert collection["user_id"] == "auth0|5fcbe89df08a4e0076ae5cda"


def test_get_collections_emtpy():
    collections = get_collections(token=alt_token())
    pprint(collections)

    assert len(collections) == 0


def test_get_collection():
    collection_id = "607ed657-ea1e-4d2d-8122-162a3fac080e"
    collection = get_collection(collection_id)

    assert has_errors(collection) is False


def test_crud():
    print("\nTEST: create question")
    question_id = dummy_question()
    collection = {
        "name": f"test collection {randint(1, 100000)}",
        "questions": [question_id]
    }

    created = create_and_print(collection)
    assert has_errors(created) is False

    pprint(collection)
    collection_id = created["id"]

    delete_collection(collection_id)
    delete_question(question_id)


def test_import_collection():
    question_id1 = dummy_question()
    question_id2 = dummy_question()
    collection = {
        "name": f"test collection {randint(1, 100000)}",
        "questions": [question_id1, question_id2]
    }

    created = create_collection(collection)
    assert has_errors(created) is False

    collection_id = created["id"]

    q1 = get_question(question_id1)
    q2 = get_question(question_id2)
    questions_in_collection = [q1, q2]

    resp = import_collection(collection_id, token=alt_token())
    assert has_errors(resp) is False
    imported = resp['questions']

    assert len(imported) == len(questions_in_collection)

    for index, question in enumerate(imported):
        orig = questions_in_collection[index]
        assert question["id"] != orig["id"]

        assert question["question"] == orig["question"]
        assert question["answer"] == orig["answer"]
        assert question["category"] == orig["category"]

        delete_question(question["id"], token=alt_token())

    delete_collection(collection_id)
    delete_question(question_id1)
    delete_question(question_id2)


def test_delete_anothers_collection():
    token = alt_token()

    err = delete_collection("b5c3560059504bbd907c824002cd3a0b", token=token)
    assert has_errors(err) is True


def test_delete_question_update_collection():
    question_id1 = dummy_question()
    question_id2 = dummy_question()
    collection = {
        "name": f"test collection {randint(1, 100000)}",
        "questions": [question_id1, question_id2]
    }

    created = create_collection(collection)
    assert has_errors(created) is False

    collection_id = created["id"]

    delete_question(question_id1)
    collection = get_collection(collection_id)
    pprint(collection)
    assert len(collection["questions"]) == 1

    delete_question(question_id2)


def test_delete_collection_when_becomes_empty():
    question_id1 = dummy_question()
    collection = {
        "name": f"test collection {randint(1, 100000)}",
        "questions": [question_id1]
    }

    created = create_collection(collection)
    assert has_errors(created) is False

    collection_id = created["id"]
    delete_question(question_id1)
    collection = get_collection(collection_id)
    assert has_errors(collection) is True


def test_empty_collection():
    collection = {
        "name": f"test question {randint(1, 100000)}",
        "questions": []
    }

    created = create_and_print(collection)
    assert has_errors(created) is True


def test_invalid_question_id():
    collection = {
        "name": f"test question {randint(1, 100000)}",
        "questions": ["bunk"]
    }

    created = create_and_print(collection)
    assert has_errors(created) is True


def test_question_id_belongs_to_another_user():
    collection = {
        "name": f"test collection {randint(1, 100000)}",
        "questions": ["3283fc5d-9a10-4b82-8d2c-349979aec4e9"]
    }

    created = create_and_print(collection, token=alt_token())
    assert has_errors(created) is True
