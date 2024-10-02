import os
from contextlib import contextmanager
from datetime import datetime

from .errors import AuthError, JsonError


def pluralize(s: str) -> str:
    if s.endswith("y"):
        return s[:-1] + "ies"
    elif s.endswith("s"):
        return s + "es"
    else:
        return s + "s"


def current_timestamp() -> int:
    return int(datetime.now().timestamp())


@contextmanager
def ctx_open(path: str, flags: int, mode: int = None):
    if mode is None:
        fd = os.open(path, flags)
    else:
        fd = os.open(path, flags, mode)
    try:
        yield fd
    finally:
        os.close(fd)


def auth_require(expr: bool, message: str = "insufficient permission"):
    if not expr:
        raise AuthError(message)
    return expr


def require(expr, message: str = "unknown error"):
    if not expr:
        raise JsonError(message)
    return expr


def assert_no_mongo_operators(obj):
    objects_to_scan = [obj]
    while objects_to_scan:
        current_object = objects_to_scan.pop()
        if isinstance(current_object, dict):
            for key, value in current_object.items():
                if key.startswith("$"):
                    raise JsonError("Invalid changes - contains $ operator")
                objects_to_scan.append(value)
        elif isinstance(current_object, list):
            objects_to_scan.extend(current_object)
    return obj
