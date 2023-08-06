#!/usr/bin/env python3
import argparse
import os
import requests
from dotenv import load_dotenv


load_dotenv()


HTTP_PORT = os.environ.get("HTTP_PORT", None)
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")


def add_gm(args):
    if HTTP_PORT is not None:
        url = f"http://127.0.0.1:{HTTP_PORT}/admin/create"
    else:
        url = f"http://127.0.0.1/admin/create"
    response = requests.post(
        url,
        json={
            "admin_token": ADMIN_TOKEN,
            "username": args.username,
            "password": args.password,
        }
    )
    print(response.content)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers()

    add_gm_parser = subparsers.add_parser("add_gm")
    add_gm_parser.add_argument("username")
    add_gm_parser.add_argument("password")
    add_gm_parser.set_defaults(func=add_gm)

    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.error("no command selected")
    args.func(args)
