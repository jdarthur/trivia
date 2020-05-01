import bson
import inspect
from mongo_manager import GamePlayer

CREATE = "create"
UPDATE = "update"
GET_ONE = "get one"
DELETE = "delete"
GET_ALL = "get all"

SUCCESS = "success"
ERROR = "error"
ERRORS = "errors"
OBJECT = "object"

FIELD = "field"
OPTIONAL = "optional"
TYPE = "type"


MONGO_HOST = "localhost"
MONGO_DB = "trivia"
player = GamePlayer(MONGO_HOST, MONGO_DB)

def fail(**kwargs):
    resp = {
        SUCCESS: False
    }
    for arg in kwargs:
        resp[arg] = kwargs[arg]

    return resp

def succeed(obj):
    return {
        SUCCESS: True,
        OBJECT: obj
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
        if request_type in [GET_ONE, UPDATE, DELETE]:
            self.object_type = object_type

    def __call__(self, f):
        def wrapped_f(*args):

            given_data = {}
            if self.request_type in [GET_ONE, UPDATE, DELETE]:

                object_id = args[0]
                if self.request_type == UPDATE:
                    given_data = args[1]
            else:

                given_data = args[0]

            legal_keys = []
            errors = []
            for item in self.model:
                field = item.get(FIELD, None)
                expected_type = item.get(TYPE, None)
                optional = item.get(OPTIONAL, False)
                legal_keys.append(field)
                if field not in given_data:
                    #all fields are required on a create call only
                    if self.request_type == CREATE and not optional:
                        errors.append(f"Missing required field '{field}'")

                elif not isinstance(given_data[field], expected_type):
                    errors.append(f"Field '{field}' (with value '{given_data[field]}') is not type {expected_type}")


            for field in given_data:
                if field not in legal_keys:
                    errors.append(f"Illegal key '{field}'")

            if self.request_type in [GET_ONE, UPDATE, DELETE]:
                #object ID must exist on these calls
                resp = get(self.object_type, object_id)
                if not resp[SUCCESS]:
                    errors.append(resp[ERRO])

            #if we have any errors, return failure with error list
            if len(errors) > 0:
                return fail(errors=errors)

            #if no errors, return whatever our call actually does
            if self.request_type in [GET_ONE, UPDATE, DELETE]:
                args = args + (resp[OBJECT],)

            return f(*args)

        return wrapped_f
