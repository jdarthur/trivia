from mongo_manager import MongoManager, fix_id

CREATE = "create"
UPDATE = "update"
GET_ONE = "get one"
DELETE = "delete"
GET_ALL = "get all"
SUBOP = "SUBOP"

SUCCESS = "success"
ERRORS = "errors"
OBJECT = "object"

FIELD = "field"
OPTIONAL = "optional"
TYPE = "type"
ID = "id"


MONGO_HOST = "localhost"
MONGO_DB = "trivia"
mongo = MongoManager(MONGO_HOST, MONGO_DB)


def fail(errors):
    resp = {
        SUCCESS: False
    }

    if isinstance(errors, list):
        resp[ERRORS] = errors
    elif isinstance(errors, str):
        resp[ERRORS] = [errors]
    else:
        raise RuntimeError(f"Bad 'errors' type {type(errors)}... must be {list} or {str}")

    return resp


def succeed(obj):
    return {
        SUCCESS: True,
        OBJECT: obj
    }


class model(object):

    def __init__(self, model, request_type, object_type):
        """
        args:
            model: list of Validation objects
            request_type: [CREATE, UPDATE, GET_ONE, SUBOP, DELETE]
            object_type: data collection name e.g. "session", "player", "question"
        """
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

            elif self.request_type in [UPDATE, SUBOP]:
                object_id = args[0]
                given_data = args[1]

            errors = []

            # validate each field in model for create/update calls
            if self.request_type in [CREATE, UPDATE, SUBOP]:
                for rest_field in self.model:
                    validation = rest_field.validate(given_data, self.request_type)
                    if not validation[SUCCESS]:
                        for error in validation[ERRORS]:
                            errors.append(error)

                # disallow fields that are not in model
                for field in given_data:
                    if field not in self.legal_keys:
                        errors.append(f"Illegal key '{field}'")

                # if we have any errors, short-circuit before hitting DB
                if len(errors) > 0:
                    return fail(errors)

            # make sure the supplied ID is valid for get/update/delete
            if self.request_type in [GET_ONE, UPDATE, SUBOP, DELETE]:
                # object ID must exist on these calls
                validation = id_is_valid(self.object_type, object_id)
                if not validation[SUCCESS]:
                    for error in validation[ERRORS]:
                        errors.append(error)

            # if we have any errors, return failure with error list
            if len(errors) > 0:
                return fail(errors)

            # if no errors, return whatever our call actually does
            if self.request_type in [GET_ONE, UPDATE, SUBOP, DELETE]:
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
            return fail(f"Missing required field '{self.field_name}'")

        if self.has_this_field(data) and not self.is_correct_type(data):
            return fail(f"Field '{self.field_name}' (with value '{data[self.field_name]}') is not type {self.expected_type}")

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
                    return fail(f"{self.object_type}_id is not type {str}")

                if id_list.count(object_id) > 1:
                    return fail(f"{self.object_type}_id {object_id} is used more than once.")

                obj = id_is_valid(self.object_type, object_id)
                if not obj[SUCCESS]:
                    return obj

        return succeed(data)


class DictOfIds(RestField):
    def __init__(self, field_name, object_type, value_type=str, optional=False):
        super().__init__(field_name, dict, optional)
        self.object_type = object_type
        self.value_type = value_type

    def validate(self, data, method):
        validation = super().validate(data, method)
        if not validation[SUCCESS]:
            return validation

        if super().has_this_field(data):
            id_list = list(data[self.field_name].keys())
            for object_id in id_list:
                if not isinstance(object_id, str):
                    return fail(f"{self.object_type}_id is not type {str}")

                if id_list.count(object_id) > 1:
                    return fail(f"{self.object_type}_id {object_id} is used more than once.")

                val = data[self.field_name][object_id]
                if not isinstance(val, self.value_type):
                    return fail(f"{self.object_type}_id value {val} is not type {self.value_type}")

                obj = id_is_valid(self.object_type, object_id)
                if not obj[SUCCESS]:
                    return obj

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
                    return fail(f"Value '{obj}' in field {self.field_name} is not type {self.object_type}")

        return succeed(data)


def id_is_valid(object_type, object_id):
    try:
        obj = mongo.get(object_type, object_id)
        if obj is None:
            return fail(f"{object_type} with id '{object_id}' does not exist")
        return succeed(obj)

    except ValueError:
        return fail(f"{object_type}_id '{object_id}' is not valid")


def get_all(object_type):
    ret = []
    games = mongo.get_all(object_type)
    if games:
        for g in games:
            ret.append(fix_id(g))
    return ret
