from pprint import pprint
import sys
pprint(sys.path)
from .test_helpers import dummy_question, DummyRound
from editor_server import (create_round, delete_round, get_round,
                           update_round, get_rounds,
                           delete_question,
                           get_question, get_questions)


def create_and_print(data):
    created = create_round(data)
    print("created:")
    pprint(created)
    return created


def test_missing_name():
    print("\nTEST: round is missing name attribute")
    data = {}
    create_and_print(data)


def test_name_not_str():
    print("\nTEST: name is not str")
    data = {"name": []}
    create_and_print(data)


def test_missing_questions():
    print("\nTEST: missing attr 'questions'")
    data = {"name": "f"}
    create_and_print(data)


def test_questions_not_list():
    print("\nTEST: attr 'questions' is not list")
    data = {"name": "f", "questions": ""}
    create_and_print(data)


def test_missing_wagers():
    print("\nTEST: missing attr 'wagers'")
    data = {"name": "f", "questions": []}
    create_and_print(data)


def test_wagers_not_list():
    print("\nTEST: attr 'wagers' is not list")
    data = {"name": "f", "questions": [], "wagers": "f"}
    create_and_print(data)


def test_question_id_is_not_str():
    print("\nTEST: question ID is not str")
    data = {"name": "f", "questions": [{}, ""], "wagers": [1, 2]}
    create_and_print(data)


def test_question_id_is_invalid():
    print("\nTEST: question ID is not valid")
    data = {"name": "f", "questions": ["L"], "wagers": [1]}
    create_and_print(data)


def test_question_id_is_valid_but_nonexistent():
    print("\nTEST: question ID is valid but nonexistent")
    data = {"name": "f", "questions": ["5e9c82c83e9f1b817df277aa"],
            "wagers": [1]}
    create_and_print(data)


def test_question_id_is_duplicate():
    print("\nTEST: question ID is duplicated")
    data = {"name": "f", "questions": ["5e9c82c83e9f1b817df277aa",
                                       "5e9c82c83e9f1b817df277aa"],
            "wagers": [1, 2]}
    create_and_print(data)


def test_wager_is_not_int():
    print("\nTEST: wager is not int")
    data = {"name": "f", "questions": [""], "wagers": ["L"]}
    create_and_print(data)


def test_wager_is_negative():
    print("\nTEST: wager is negative")
    question_id = dummy_question()
    data = {"name": "f", "questions": [question_id], "wagers": [-1]}
    create_and_print(data)
    delete_question(question_id)


def test_wager_is_zero():
    print("\nTEST: wager is zero")
    data = {"name": "f", "questions": [""], "wagers": [0]}
    create_and_print(data)


def test_wagers_list_is_not_the_same_length_as_questions_list():
    print("\nTEST: wager/questions lengths are different")
    data = {"name": "f", "questions": [""], "wagers": [1, 2]}
    create_and_print(data)


def test_crud():
    print("\nTEST: successful crud")
    question_id = dummy_question()

    with DummyRound(0) as round_id:
        obj = get_round(round_id)
        print("got:")
        pprint(obj)

        update_round(round_id, {"name": "ffff"})

        rounds = get_rounds()
        print("all rounds:")
        pprint(rounds)

        questions = get_questions()
        print("all questions")
        pprint(questions)

        success = delete_round(round_id)
        print("deleted: {} {}".format(success, round_id))

        rounds = get_rounds()
        print("all rounds: {}".format(rounds))

        delete_question(question_id)


def test_round_used_added_to_question():
    """
    when I add a question to a round,
    the round_id should be stored in the
    questions rounds_used list
    """
    print("\nTEST: rounds_used added to question")
    question_id = dummy_question()
    with DummyRound() as round_id:
        print("   round ID: {}".format(round_id))

        r = update_round(round_id, {"questions": [question_id], "wagers": [1]})

        question = get_question(question_id)
        ru = question['object'].get("rounds_used", [])
        print(f"   rounds_used: {ru} (question: {question})")
        assert ru[0] == round_id
        delete_round(round_id)

        delete_question(question_id)


def test_round_removed_from_question_when_round_deleted():
    """
    when I delete a round, it should be removed from
    the rounds_used list on each question in round
    """
    print("\nTEST: round deleted from question when round deleted")
    with DummyRound(1, True) as round:
        round_id = round.round_id
        question_id = round.questions[0]

        print("round ID: {}".format(round_id))

        question = get_question(question_id)["object"]
        print(f"question after round created:")
        pprint(question)

        delete_round(round_id)

        question = get_question(question_id)
        ru = question['object'].get("rounds_used", [])
        print(f"rounds_used after round delete: {ru}")

        delete_question(question_id)
        assert len(ru) == 0


def test_round_removed_from_question_when_question_removed_from_round():
    """
    when I remove a question from a round, the round
    should be removed from this questions rounds_used list
    """
    print("\nTEST: round deleted from question when question removed from round")
    with DummyRound(1, True) as round:
        round_id = round.round_id
        question_id = round.questions[0]

        question = get_question(question_id)["object"]
        print(f"question after round create:")
        pprint(question)
        ru = question.get("rounds_used", [])
        assert len(ru) == 1

        update_round(round_id, {"questions": []})

        question = get_question(question_id)["object"]
        print(f"question after removal from round:")
        pprint(question)
        ru = question.get("rounds_used", [])
        assert len(ru) == 0

    delete_round(round_id)

    delete_question(question_id)


def test_question_removed_from_round_when_question_is_deleted():
    print("\nTEST: question removed from round when question deleted")
    with DummyRound(1, True) as round:
        round_id = round.round_id
        question_id = round.questions[0]
        print("   round ID: {}".format(round_id))

        round_obj = get_round(round_id)["object"]
        print("round before question delete")
        pprint(round_obj)
        assert len(round_obj['questions']) == 1

        delete_question(question_id)

        round_obj = get_round(round_id)["object"]
        print("round after question delete: ")
        pprint(round_obj)
        assert len(round_obj['questions']) == 0

        delete_round(round_id)

def test_get_rounds_with_exclusion_filter():
    print("\nTEST: get rounds with filtering")
    rounds = get_rounds(unused_only=False)
    all_rounds_len = len(rounds['object'])
    print(f"all rounds ({all_rounds_len}):")
    pprint(rounds)

    rounds = get_rounds(unused_only=True)
    filtered_rounds_len = len(rounds['object'])
    print(f"all rounds ({filtered_rounds_len}):")
    pprint(rounds)

    assert all_rounds_len >= filtered_rounds_len
