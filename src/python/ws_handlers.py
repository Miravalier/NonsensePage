import functools
from models import Connection
from typing import Dict, Any


# Collection of handlers for inbound websocket messages
registered_handlers = {}


def register(message_type: str):
    def registration_wrapper(func):
        @functools.wraps(func)
        def handler_wrapper(connection: Connection, request: Dict[str, Any]):
            return func(connection, request)
        registered_handlers[message_type] = handler_wrapper
        return handler_wrapper
    return registration_wrapper
