#!/usr/bin/env python3.7
import argparse
import json
import os
import sys
import shutil
import subprocess
import shlex

from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-t", "--targets", metavar="JSON FILE", default="targets.json", type=Path)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    try:
        with args.targets.open() as fp:
            data = json.load(fp)
            targets = data.get("targets", {})
            options = data.get("options", {})
        if type(targets) != dict or type(options) != dict:
            raise json.JSONDecodeError()
    except json.JSONDecodeError:
        parser.error("JSON syntax error in target file '{}'".format(args.targets))
    except OSError:
        parser.error("failed to open target file '{}'".format(args.targets))

    for key, value in options.items():
        if key == 'require-root':
            if value and os.geteuid() != 0:
                parser.error("require-root is set in '{}', try sudo !!".format(args.targets))
        elif key == 'forbid-root':
            if value and os.geteuid() == 0:
                parser.error("forbid-root is set in '{}', try again as a less privileged user".format(args.targets))
        else:
            parser.error("unknown option '{}' set to '{}' in target file '{}'".format(key, value, args.targets))

    queued = set()
    queue = []

    # Build install order from dependency graph
    previous_length = len(queued)
    while len(queued) < len(targets):
        for target, info in targets.items():
            dependencies = info.get("dependencies", [])
            if type(dependencies) != list:
                parser.error("dependencies for target '{}' in '{}' are not an array".format(target, args.targets))

            destination = info.get("destination", "")
            if not destination:
                parser.error("target '{}' in '{}' is missing a destination")
            elif type(destination) != str:
                parser.error("target '{}'s destination is not a string")

            if target not in queued and all(dependency in queued for dependency in dependencies):
                queued.add(target)
                queue.append(target)

        if len(queued) == previous_length:
            parser.error("unresolved dependency order, cannot resolve '{}'".format("', '".join(
                [target for target in targets.keys() if target not in queued]
            )))

        previous_length = len(queued)

    # Perform installation
    any_changes = False
    for target in queue:
        info = targets[target]
        changes = perform_install(Path(target), Path(info['destination']), args.verbose)
        any_changes |= changes
        if changes:
            commands = info.get("install-commands", [])
            for command in commands:
                result = subprocess.call(shlex.split(command))
                if result != 0:
                    print("error: command '{}' in target '{}' returned '{}'".format(command, target, result))
                    sys.exit(1)
                elif args.verbose:
                    print("info: executed '{}' from target '{}'".format(command, target))
        elif args.verbose:
            print("info: skipping target '{}', no changes".format(target))
    if not any_changes:
        print("No changes, nothing to install.")


def perform_install(source, destination, verbose):
    changes = False

    if source.is_dir():
        for subsource in source.iterdir():
            changes |= perform_install(subsource, destination, verbose)
    else:
        destination /= source
        if not destination.exists() or source.stat().st_mtime > destination.stat().st_mtime:
            if verbose:
                print("info: copying", source, '->', destination)
            os.makedirs(destination.parent, exist_ok=True)
            shutil.copy(str(source), str(destination))
            changes = True
        elif verbose:
            print("info: skipping", source, "->", destination)

    return changes


if __name__ == '__main__':
    main()
