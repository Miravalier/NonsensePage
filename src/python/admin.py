import argparse

from database import db, User
from security import hash_password


def add_gm(args):
    User.create(name=args.username, hashed_password=hash_password(args.password), is_gm=True)
    db.save()


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
