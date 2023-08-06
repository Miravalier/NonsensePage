#!/usr/bin/env python3
import argparse
import os
import requests
from dotenv import load_dotenv


load_dotenv()


HTTP_PORT = os.environ.get("HTTP_PORT", None)
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")

if HTTP_PORT is not None:
    BASE_URL = f"http://127.0.0.1:{HTTP_PORT}"
else:
    BASE_URL = f"http://127.0.0.1"


def add_gm(args):
    response = requests.post(
        f"{BASE_URL}/admin/create",
        json={
            "admin_token": ADMIN_TOKEN,
            "username": args.username,
            "password": args.password,
        }
    )
    print(response.content)


def list_users(args):
    response = requests.post(
        f"{BASE_URL}/admin/list-users",
        json={
            "admin_token": ADMIN_TOKEN,
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

    list_users_parser = subparsers.add_parser("list_users")
    list_users_parser.set_defaults(func=list_users)

    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.error("no command selected")
    args.func(args)
