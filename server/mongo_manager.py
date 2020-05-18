"""
@author JD
@date 18 Apr 2020
"""
import uuid
from datetime import datetime
from pymongo import MongoClient

ID = "id"
_ID = "_id"
CREATE_DATE = "create_date"


def id_equals(object_id):
    """
    'id == ?' filter
    """
    return {_ID: uuid.UUID(object_id, version=4)}


def add_id(data):
    data[_ID] = uuid.uuid4()
    return data


def fix_id(data):
    if data is None:
        return None

    new = {}
    for key in data:
        if key == _ID:
            new[ID] = str(data[key])
        else:
            new[key] = data[key]
    return new


class MongoManager(object):
    """
    Manages data persistence.
    Interface to mongodb
    """
    def __init__(self, host, database):
        self.db = MongoClient(host)[database]

    def get(self, object_type, object_id):
        """
        find an object by ID

        args:
            object type: type of object (same as mongo collection)
            object id: ID of object in collection (uuid4)
        returns:
            found object
        """
        return self.db[object_type].find_one(id_equals(object_id))

    def create(self, object_type, data):
        """
        create an object.
        This generates a unique id (uuid4)

        args:
            object type: type of object (same as mongo collection)
            object id: ID of object in collection (uuid4)
        returns:
            created object, with new ID
        """
        data[CREATE_DATE] = datetime.utcnow()
        data = add_id(data)
        # print(f"MONGO: create {object_type} {data[_ID]}")
        self.db[object_type].insert_one(data)
        return fix_id(data)

    def update(self, object_type, object_id, data):
        """
        update an object by ID

        args:
            object type: type of object (same as mongo collection)
            object id: ID of object in collection (uuid4)
            data: values to set
        returns:
            modified count
        """
        result = self.db[object_type].update_one(id_equals(object_id),
                                                 {"$set": data})
        return result.modified_count

    def push(self, object_type, object_id, array, value):
        """
        append a value to an array in an object

        args:
            object type: type of object (same as mongo collection)
            object id: ID of object in collection (uuid4)
            array: name of array in object
            value: value to add
        returns:
            modified count
        """
        result = self.db[object_type].update_one(id_equals(object_id),
                                                 {"$push": {array: value}})
        return result.modified_count

    def pull(self, object_type, object_id, array, value):
        """
        remove a value from an array in an object

        args:
            object type: type of object (same as mongo collection)
            object id: ID of object in collection (uuid4)
            array: name of array in object
            value: value to add
        returns:
            modified count
        """
        result = self.db[object_type].update_one(id_equals(object_id),
                                                 {"$pull": {array: value}})
        return result.modified_count

    def increment(self, object_type, object_id, incr_key, incr_value):
        result = self.db[object_type].update_one(id_equals(object_id),
                                                 {"$inc": {incr_key: incr_value}})
        return result.modified_count

    def delete(self, object_type, object_id):
        """
        delete an object by ID

        args:
            object type: type of object (same as mongo collection)
            object id: ID of object in collection (uuid4)
        returns:
            deleted count
        """
        result = self.db[object_type].delete_one(id_equals(object_id))
        return result.deleted_count

    def get_all(self, object_type, filter={}):
        """
        args:
            object type: type of object (same as mongo collection)
        returns:
            list of all objects of type X
        """
        return self.db[object_type].find(filter)
