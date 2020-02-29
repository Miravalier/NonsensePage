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
    parser.add_argument("-b", "--build", required=True)
    parser.add_argument("-f", "--fullchain", required=True)
    parser.add_argument("-k", "--keyfile", required=True)

    args = parser.parse_args()
    in_path = args.file
    out_path = args.output

    file_size = in_path.stat().st_size

    # Skip files greater than 256 KB
    if file_size > 1024 * 256:
        shutil.copyfile(in_path, out_path)
    # Run replacements on remaining files
    else:
        version = secrets.token_hex(8).encode('ascii')
        with open(in_path, "rb") as in_file:
            with open(out_path, "wb") as out_file:
                out_file.write(
                    in_file.read().replace(
                        b"$$VER$$", version
                    ).replace(
                        b"$$BUILD$$", args.build.encode('ascii')
                    ).replace(
                        b"$$FULLCHAIN$$", args.fullchain.encode('ascii')
                    ).replace(
                        b"$$KEYFILE$$", args.keyfile.encode('ascii')
                    )
                )


if __name__ == '__main__':
    main()
