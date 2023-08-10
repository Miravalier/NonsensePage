from __future__ import annotations

import os
from collections import deque
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel, Field
from secrets import token_hex
from typing import Any, Deque, Dict, List, Optional

from enums import Language
from errors import JsonError
from utils import ctx_open


MSG_VERSION = 1
MESSAGE_ROOT = Path("/data/messages")
PAGE_HEADER_SIZE = 8
MESSAGE_SIZE = 52
PAGE_MESSAGE_CAPACITY = 128

FLAG_DELETED = 1


def write_all(fd: int, data: bytes):
    data_view = memoryview(data)
    while len(data_view):
        last_write = os.writev(fd, (data_view,))
        if last_write <= 0:
            raise IOError("Failed writev call")
        data_view = data_view[last_write:]


def read_all(fd: int, size: int) -> bytes:
    result = bytearray(size)
    os.readv(fd, (result,))
    return result


def get_page(page: int) -> int:
    path = MESSAGE_ROOT / "{:08x}".format(page)
    new_page = not path.exists()
    fd = os.open(str(path), os.O_RDWR|os.O_CREAT, 0o664)
    if new_page:
        os.write(fd, MSG_VERSION.to_bytes(4, 'big', signed=False))
    return fd


def get_page_messages(page: int) -> List[Message]:
    messages: List[Message] = []
    path = MESSAGE_ROOT / "{:08x}".format(page)
    with ctx_open(str(path), os.O_RDONLY) as fd:
        version = int.from_bytes(read_all(fd, 4), 'big', signed=False)
        if version != MSG_VERSION:
            raise ValueError("Incompatible message file version")
        message_count = int.from_bytes(read_all(fd, 4), 'big', signed=False)
        for i in range(message_count):
            messages.append(Message.read(fd, page, i))
    return messages


@dataclass
class Messages:
    fd: int = -1
    page_number: int = 0
    page_index: int = 0
    recent: Deque[Message] = field(default_factory=deque)
    speaker_cache: Dict[str, int] = field(default_factory=dict)

    @contextmanager
    def open_page(self, page: int):
        if page == self.page_number:
            try:
                yield self.fd
            finally:
                pass
        else:
            fd = get_page(page)
            try:
                yield fd
            finally:
                os.close(fd)

    @classmethod
    def load(cls):
        MESSAGE_ROOT.mkdir(parents=True, exist_ok=True)
        page_count = len(list(MESSAGE_ROOT.iterdir()))
        messages = cls()

        if page_count >= 2:
            messages.recent.extend(get_page_messages(page_count - 2))

        if page_count >= 1:
            page = get_page_messages(page_count - 1)
            messages.page_number = page_count - 1
            messages.page_index = len(page)
        else:
            page = []
            messages.page_number = 0
            messages.page_index = 0

        messages.recent.extend(page)
        while len(messages.recent) > PAGE_MESSAGE_CAPACITY:
            messages.recent.popleft()
        messages.fd = get_page(messages.page_number)
        return messages

    def get(self, page: int, index: int) -> Message:
        # Check recents
        for message in self.recent:
            if message.page == page and message.index == index:
                return message
        # Check previous pages
        if page < self.page_number and index <= PAGE_MESSAGE_CAPACITY:
            with self.open_page(page) as fd:
                return Message.read(fd, page, index)
        else:
            raise JsonError("no message found with the given page and index")

    def create(self, **kwargs) -> Message:
        # Expand to next page if necessary
        if self.page_index == PAGE_MESSAGE_CAPACITY:
            self.page_number += 1
            self.page_index = 0
            os.close(self.fd)
            self.fd = get_page(self.page_number)
            self.speaker_cache = {}
        # Create message
        kwargs["page"] = self.page_number
        kwargs["index"] = self.page_index
        message = Message.parse_obj(kwargs)
        # Add new message to recent
        self.recent.append(message)
        if len(self.recent) > PAGE_MESSAGE_CAPACITY:
            messages.recent.popleft()
        # Write message to page
        message.write(self.fd)
        # Increase message count in page header
        self.page_index += 1
        os.lseek(self.fd, 4, os.SEEK_SET)
        write_all(self.fd, self.page_index.to_bytes(4, 'big', signed=False))
        return message


class Message(BaseModel):
    id: str = Field(default_factory=token_hex)
    character_id: Optional[str]
    timestamp: datetime = Field(default_factory=datetime.now)
    flags: int = Field(default=0, exclude=True)
    language: Language = Language.COMMON
    speaker: str = ""
    content: str = ""
    page: int
    index: int

    def foreign_dict(self) -> Dict[str, Any]:
        result = self.dict(exclude={"content": True})
        result["length"] = len(self.content)
        return result

    @staticmethod
    def create(**kwargs):
        return messages.create(**kwargs)

    @staticmethod
    def get(page: int, index: int):
        return messages.get(page, index)

    def __hash__(self):
        return hash(self.id)

    @classmethod
    def read(cls, fd: int, page: int, index: int) -> Message:
        os.lseek(fd, PAGE_HEADER_SIZE + (MESSAGE_SIZE * index), os.SEEK_SET)

        message_id = bytearray(16)
        character_id = bytearray(16)
        timestamp = bytearray(4)
        speaker_offset = bytearray(4)
        content_offset = bytearray(4)
        speaker_length = bytearray(2)
        content_length = bytearray(2)
        language = bytearray(2)
        flags = bytearray(2)

        os.readv(fd, (
            message_id,
            character_id,
            timestamp,
            speaker_offset,
            content_offset,
            speaker_length,
            content_length,
            language,
            flags,
        ))

        if character_id[0] != 0:
            character_id = character_id.decode('ascii')
        else:
            character_id = None

        os.lseek(fd, int.from_bytes(speaker_offset, 'big', signed=False), os.SEEK_SET)
        speaker = read_all(
            fd,
            int.from_bytes(speaker_length, 'big', signed=False)
        )
        os.lseek(fd, int.from_bytes(content_offset, 'big', signed=False), os.SEEK_SET)
        content = read_all(
            fd,
            int.from_bytes(content_length, 'big', signed=False)
        )

        return cls.parse_obj({
            "id": message_id.decode('ascii'),
            "timestamp": datetime.fromtimestamp(
                int.from_bytes(timestamp, 'big', signed=False)
            ),
            "flags": int.from_bytes(flags, 'big', signed=False),
            "language": Language(int.from_bytes(language, 'big', signed=False)),
            "character_id": character_id,
            "speaker": speaker.decode('utf-8'),
            "content": content.decode('utf-8'),
            "page": page,
            "index": index,
        })

    def write(self, fd: int):
        # Get variable length strings
        speaker = self.speaker.encode('utf-8')
        content = self.content.encode('utf-8')

        file_end = max(
            os.lseek(fd, 0, os.SEEK_END),
            PAGE_HEADER_SIZE + (MESSAGE_SIZE * PAGE_MESSAGE_CAPACITY)
        )

        # Try cache finds
        speaker_hit = True
        speaker_offset = messages.speaker_cache.get(self.speaker, None)

        # If cache missed, get offset at file end
        if speaker_offset is None:
            speaker_offset = file_end
            file_end += len(speaker)
            speaker_hit = False
            messages.speaker_cache[self.speaker] = speaker_offset
        content_offset = file_end

        result = bytearray(MESSAGE_SIZE)
        result[0:16] = self.id.encode('ascii')
        if self.character_id:
            result[16:32] = self.character_id.encode('ascii')
        result[32:36] = int(self.timestamp.timestamp()).to_bytes(4, 'big', signed=False)
        result[36:40] = speaker_offset.to_bytes(4, 'big', signed=False)
        result[40:44] = content_offset.to_bytes(4, 'big', signed=False)
        result[44:46] = len(speaker).to_bytes(2, 'big', signed=False)
        result[46:48] = len(content).to_bytes(2, 'big', signed=False)
        result[48:50] = int(self.language).to_bytes(2, 'big', signed=False)
        result[50:52] = self.flags.to_bytes(2, 'big', signed=False)

        # Write message header in header table
        os.lseek(fd, PAGE_HEADER_SIZE + (MESSAGE_SIZE * self.index), os.SEEK_SET)
        write_all(fd, result)

        # Write speaker and content in strings section
        if not speaker_hit:
            os.lseek(fd, speaker_offset, os.SEEK_SET)
            write_all(fd, speaker)
        os.lseek(fd, content_offset, os.SEEK_SET)
        write_all(fd, content)

    def swap(self, other: Message):
        with messages.open_page(self.page) as fd:
            if self.page == other.page:
                os.lseek(fd, PAGE_HEADER_SIZE + (MESSAGE_SIZE * self.index), os.SEEK_SET)
                msg_a = read_all(fd, MESSAGE_SIZE)
                os.lseek(fd, PAGE_HEADER_SIZE + (MESSAGE_SIZE * other.index), os.SEEK_SET)
                msg_b = read_all(fd, MESSAGE_SIZE)
                os.lseek(fd, PAGE_HEADER_SIZE + (MESSAGE_SIZE * self.index), os.SEEK_SET)
                write_all(fd, msg_b)
                os.lseek(fd, PAGE_HEADER_SIZE + (MESSAGE_SIZE * other.index), os.SEEK_SET)
                write_all(fd, msg_a)
                self.index, other.index = other.index, self.index
            else:
                with messages.open_page(other.page) as other_fd:
                    self.page, other.page = other.page, self.page
                    self.index, other.index = other.index, self.index
                    self.write(other_fd)
                    other.write(fd)

    def edit(self, content: str):
        self.content = content
        binary_content = content.encode('utf-8')
        with messages.open_page(self.page) as fd:
            # Find the message header in memory
            message_base = PAGE_HEADER_SIZE + (MESSAGE_SIZE * self.index)
            # Read the old content offset
            os.lseek(fd, message_base + 40, os.SEEK_SET)
            old_content_offset = int.from_bytes(read_all(fd, 4), 'big', signed=False)
            # Read the old content length
            os.lseek(fd, message_base + 46, os.SEEK_SET)
            old_content_length = int.from_bytes(read_all(fd, 2), 'big', signed=False)
            # If the new content is longer than the old, find a new content offset spot
            # and write the content offset to file
            if len(binary_content) > old_content_length:
                content_offset = max(
                    os.lseek(fd, 0, os.SEEK_END),
                    PAGE_HEADER_SIZE + (MESSAGE_SIZE * PAGE_MESSAGE_CAPACITY)
                )
                os.lseek(fd, message_base + 40, os.SEEK_SET)
                write_all(fd, content_offset.to_bytes(4, 'big', signed=False))
            # If the new content is less than or equal the old, just keep the old offset
            else:
                content_offset = old_content_offset
            # Write the new content to the file
            os.lseek(fd, content_offset, os.SEEK_SET)
            write_all(fd, binary_content)
            # If the content length changed, write the new content length to file
            if len(binary_content) != old_content_length:
                os.lseek(fd, message_base + 46, os.SEEK_SET)
                write_all(fd, len(binary_content).to_bytes(2, 'big', signed=False))

    def delete(self):
        self.flags |= FLAG_DELETED
        with messages.open_page(self.page) as fd:
            # Find the message header in memory
            message_base = PAGE_HEADER_SIZE + (MESSAGE_SIZE * self.index)
            # Write new flags
            os.lseek(fd, message_base + 50, os.SEEK_SET)
            write_all(fd, self.flags.to_bytes(2, 'big', signed=False))

    @property
    def is_deleted(self):
        return self.flags & FLAG_DELETED


messages = Messages.load()
