#!/usr/bin/env python3.7
import argparse
import os
import subprocess

from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file", type=Path)
    parser.add_argument("-v", "--verbose", action="store_true")

    args = parser.parse_args()
    file_path = str(args.file)
    file_length = os.stat(file_path).st_size
    version = generate_version()

    try:
        fd = os.open(file_path, os.O_RDWR)
        offset = 0
        while offset < file_length:
            os.lseek(fd, offset, os.SEEK_SET)
            data = os.read(fd, 4096)
            replacement_index = data.find(b"$$VER$$")
            if replacement_index == -1:
                offset += 2048
            else:
                offset += replacement_index
                os.lseek(fd, offset, os.SEEK_SET)
                os.write(fd, version)
    finally:
        os.close(fd)


def generate_version():
    with open(".version", "r+") as fp:
        major, minor = fp.read().strip().split('.')
        minor = int(minor) + 1
        major = int(major)
        if minor > 9999:
            minor = 0
            major += 1
        version = "{:02}.{:04}".format(major, minor)
        fp.seek(0)
        fp.write(version)
    return version.encode('ascii')


if __name__ == '__main__':
    main()
