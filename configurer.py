#!/usr/bin/env python3.7
import argparse
import secrets
import shutil

from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file", type=Path)
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("-o", "--output", type=Path, required=True)

    args = parser.parse_args()
    in_path = args.file
    out_path = args.output

    file_size = in_path.stat().st_size

    # Skip files greater than 256 KB
    if file_size > 1024 * 256:
        shutil.copyfile(in_path, out_path)
    else:
        version = secrets.token_hex(8).encode('ascii')
        with open(in_path, "rb") as in_file:
            with open(out_path, "wb") as out_file:
                out_file.write(in_file.read().replace(b"$$VER$$", version))



if __name__ == '__main__':
    main()
