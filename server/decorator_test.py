


from pprint import pprint
import inspect

def fail(**kwargs):
    resp = {
        "success": False
    }
    for arg in kwargs:
        resp[arg] = kwargs[arg]

    return resp

def succeed(object):
    return {
        "success": True,
        "object": object
    }

def get(object_type, object_id):

    if not isinstance(object_id, str):
        return fail(error=f"{object_type}_id '{object_id}' is not str")
    try:
        obj = player.get(object_type, object_id)
        if obj is None:
            return fail(error=f"{object_type} with id '{object_id}' does not exist")
        return succeed(obj)

    except bson.errors.InvalidId:
        return fail(error=f"{object_type}_id '{object_id}' is not valid")

class model(object):

    def __init__(self, model, request_type, object_type=None):
        self.model = model
        self.request_type = request_type
        if request_type == UPDATE:
            self.object_type = object_type

    def __call__(self, f):
        def wrapped_f(*args):


            if self.request_type in [GET_ONE, UPDATE, DELETE]:
                object_id = args[0]
                given_data = args[1]
            else:
                given_data = args[0]

            legal_keys = []
            errors = []
            for field, expected_type in self.model:
                legal_keys.append(field)
                if field not in given_data:
                    #all fields are required on a create call only
                    if self.request_type == CREATE:
                        errors.append(f"Missing required field '{field}'")

                elif not isinstance(given_data[field], expected_type):
                    errors.append(f"Field '{field}'' is not type {expected_type}")


            for field in given_data:
                if field not in legal_keys:
                    errors.append(f"Illegal key '{field}'")

            if self.request_type in [GET_ONE, UPDATE, DELETE]:
                #object ID must exist on these calls
                resp = get(self.object_type, object_id)
                if not resp["success"]:
                    errors.append(resp["error"])

            #if we have any errors, return failure with error list
            if len(errors) > 0:
                return fail(errors=errors)

            #if no errors, return whatever our call actually does
            return f(*args)

        return wrapped_f

CREATE = "create"
UPDATE = "update"
GET_ONE = "get one"
DELETE = "delete"

qmodel = [
    ("question", str),
    ("answer", str),
    ("category", str)
]
@model(qmodel, CREATE)
def create_question(data):
    return succeed({"nice": "cool"})

@model(qmodel, UPDATE, "question")
def update_question(question_id, data):
    return succeed({"nice": "cool"})

print("Preparing to call sayHello()")
created = create_question({})
pprint(created)
created = create_question({"question": []})
pprint(created)
created = create_question({"question": "f", "answer": "f"})
pprint(created)
created = create_question({"question": "f", "answer": "f", "category" : "f", "bad": "not good"})
pprint(created)
created = create_question({"question": "f", "answer": "f", "category" : "f"})
pprint(created)
updated = update_question(12345, {"question": "f"})
pprint(updated)
updated = update_question(12345, {"question": "f"})
pprint(updated)
