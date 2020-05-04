from mongo_manager import MongoManager, fix_id

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
ID = "id"


MONGO_HOST = "localhost"
MONGO_DB = "trivia"
mongo = MongoManager(MONGO_HOST, MONGO_DB)


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


class model(object):

    def __init__(self, model, request_type, object_type):
        self.model = model
        self.request_type = request_type
        self.object_type = object_type
        self.legal_keys = []
        self.immutable_keys = []
        for rest_field in model:
            self.legal_keys.append(rest_field.field_name)

    def __call__(self, f):
        def wrapped_f(*args):

            given_data = args[0]
            if self.request_type in [GET_ONE, DELETE]:
                object_id = args[0]
                given_data = None

            elif self.request_type == UPDATE:
                object_id = args[0]
                given_data = args[1]

            errors = []

            #validate each field in model for create/update calls
            if self.request_type in [CREATE, UPDATE]:
                for rest_field in self.model:
                    validation = rest_field.validate(given_data, self.request_type)
                    if not validation[SUCCESS]:
                        errors.append(validation[ERROR])

                #disallow fields that are not in model
                for field in given_data:
                    if field not in self.legal_keys:
                        errors.append(f"Illegal key '{field}'")

                #if we have any errors, short-circuit before hitting DB
                if len(errors) > 0:
                    return fail(errors=errors)

            # make sure the supplied ID is valid for get/update/delete
            if self.request_type in [GET_ONE, UPDATE, DELETE]:
                #object ID must exist on these calls
                validation = id_is_valid(self.object_type, object_id)
                if not validation[SUCCESS]:
                    errors.append(validation[ERROR])

            #if we have any errors, return failure with error list
            if len(errors) > 0:
                return fail(errors=errors)

            #if no errors, return whatever our call actually does
            if self.request_type in [GET_ONE, UPDATE, DELETE]:
                args = args + (fix_id(validation[OBJECT]),)

            return f(*args)

        return wrapped_f

class RestField(object):
    def __init__(self, field_name, expected_type=str, optional=False):
        self.field_name = field_name
        self.expected_type = expected_type
        self.optional = optional

    def is_correct_type(self, data):
        return isinstance(data[self.field_name], self.expected_type)

    def has_this_field(self, data):
        return self.field_name in data

    def validate(self, data, method):
        if not self.has_this_field(data) and not self.optional and method != UPDATE:
            return fail(error=f"Missing required field '{self.field_name}'")

        if self.has_this_field(data) and not self.is_correct_type(data):
            return fail(error=f"Field '{self.field_name}' (with value '{data[self.field_name]}') is not type {self.expected_type}")

        return succeed(data)


class IdField(RestField):
    def __init__(self, field_name, object_type, optional=False):
        super().__init__(field_name, str, optional)
        self.object_type = object_type

    def validate(self, data, method):
        validation = super().validate(data, method)
        if not validation[SUCCESS]:
            return validation

        if super().has_this_field(data):
            return id_is_valid(self.object_type, data[self.field_name])
        return succeed(data)


class ListOfIds(RestField):
    def __init__(self, field_name, object_type, optional=False):
        super().__init__(field_name, list, optional)
        self.object_type = object_type

    def validate(self, data, method):
        validation = super().validate(data, method)
        if not validation[SUCCESS]:
            return validation

        if super().has_this_field(data):
            id_list = data[self.field_name]
            for object_id in id_list:
                if not isinstance(object_id, str):
                    return fail(error=f"{self.object_type}_id is not type {str}")

                if id_list.count(object_id) > 1:
                    return fail(error=f"{self.object_type}_id {object_id} is used more than once.")

                obj = id_is_valid(self.object_type, object_id)
                if not obj[SUCCESS]:
                    return fail(error=obj[ERROR])

        return succeed(data)


class ListOfType(RestField):
    def __init__(self, field_name, object_type, optional=False):
        super().__init__(field_name, list, optional)
        self.object_type = object_type

    def validate(self, data, method):
        validation = super().validate(data, method)
        if not validation[SUCCESS]:
            return validation

        if super().has_this_field(data):
            obj_list = data[self.field_name]
            for obj in obj_list:
                if not isinstance(obj, self.object_type):
                    return fail(error=f"Value '{obj}' in field {self.field_name} is not type {self.object_type}")

        return succeed(data)


def id_is_valid(object_type, object_id):
    try:
        obj = mongo.get(object_type, object_id)
        if obj is None:
            return fail(error=f"{object_type} with id '{object_id}' does not exist")
        return succeed(obj)

    except ValueError:
        return fail(error=f"{object_type}_id '{object_id}' is not valid")


def get_all(object_type):
    ret = []
    games = mongo.get_all(object_type)
    if games:
        for g in games:
            ret.append(fix_id(g))
    return ret
