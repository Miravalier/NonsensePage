import asyncio
from contextlib import contextmanager
from typing import Any, Set


class UpdateContext:
    def __init__(self):
        self.queues: Set[asyncio.Queue] = set()

    @contextmanager
    def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue()

        self.queues.add(queue)
        try:
            yield queue
        finally:
            self.queues.discard(queue)

    def publish(self, entry: Any):
        for queue in self.queues:
            queue.put_nowait(entry)


"""
Publishes every visible field of a DBEntry and its collection.

input: Any DBEntry
"""
general = UpdateContext()

"""
Publishes message creation or updates.

input: A graphql Message schema
"""
messages = UpdateContext()
