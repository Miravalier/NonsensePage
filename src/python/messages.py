from __future__ import annotations

import os
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Deque, List, Optional

from enums import Language
from utils import ctx_open, random_id


MSG_VERSION = 1
MESSAGE_ROOT = Path("/data/messages")
PAGE_HEADER_SIZE = 8
MESSAGE_SIZE = 52
PAGE_MESSAGE_CAPACITY = 128

DELETED_FLAG = 1


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


def open_page(page: int) -> int:
    path = MESSAGE_ROOT / "{:08x}".format(page)
    new_page = not path.exists()
    fd = os.open(str(path), os.O_RDWR|os.O_CREAT, 0o664)
    if new_page:
        os.write(fd, MSG_VERSION.to_bytes(4, 'big', signed=False))
    return fd


def load_page(page: int) -> List[Message]:
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

    @classmethod
    def load(cls):
        MESSAGE_ROOT.mkdir(parents=True, exist_ok=True)
        page_count = len(list(MESSAGE_ROOT.iterdir()))
        messages = cls()

        if page_count >= 2:
            messages.recent.extend(load_page(page_count - 2))

        if page_count >= 1:
            page = load_page(page_count - 1)
            messages.page_number = page_count - 1
            messages.page_index = len(page)
        else:
            page = []
            messages.page_number = 0
            messages.page_index = 0

        messages.recent.extend(page)
        while len(messages.recent) > PAGE_MESSAGE_CAPACITY:
            messages.recent.popleft()
        messages.fd = open_page(messages.page_number)
        return messages

    def create(self, **kwargs) -> Message:
        # Expand to next page if necessary
        if self.page_index == PAGE_MESSAGE_CAPACITY:
            self.page_number += 1
            self.page_index = 0
            os.close(self.fd)
            self.fd = open_page(self.page_number)
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
    id: str = Field(default_factory=random_id)
    character_id: Optional[str]
    timestamp: datetime = Field(default_factory=datetime.now)
    flags: int = 0
    language: Language = Language.COMMON
    speaker: str = ""
    content: str = ""
    page: int
    index: int

    def __setattr__(self, name, value):
        print("Setattr", name, value)
        return super().__setattr__(name, value)

    @staticmethod
    def create(**kwargs):
        return messages.create(**kwargs)

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
            content_offset,
            speaker_offset,
            content_length,
            speaker_length,
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

        # Get offsets at file end
        speaker_offset = max(
            os.lseek(fd, 0, os.SEEK_END),
            PAGE_HEADER_SIZE + (MESSAGE_SIZE * PAGE_MESSAGE_CAPACITY)
        )
        content_offset = speaker_offset + len(speaker)

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

        # Write speaker and content side by side in strings section
        os.lseek(fd, speaker_offset, os.SEEK_SET)
        write_all(fd, speaker + content)


messages = Messages.load()
