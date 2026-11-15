#!/usr/bin/env python3
"""Small, read-only repository checks; syntax parsing is delegated to libraries."""

import json
import pathlib
import re
import sys
import tomllib

import yaml


CHECK, *FILENAMES = sys.argv[1:]
failed = False
for filename in FILENAMES:
    path = pathlib.Path(filename)
    if path.is_symlink() or not path.is_file():
        continue
    try:
        data = path.read_bytes()
        if CHECK == "size":
            if len(data) > 512000:
                raise ValueError("larger than 500 KiB")
            continue
        text = data.decode("utf-8")
        if CHECK == "yaml":
            list(yaml.safe_load_all(text))
        elif CHECK == "json":
            json.loads(
                text,
                parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)),
            )
        elif CHECK == "toml":
            tomllib.loads(text)
        elif CHECK == "conflict":
            if re.search(r"^(?:<{7} |={7}$|>{7} |\|{7} )", text, re.MULTILINE):
                raise ValueError("merge conflict marker")
        elif CHECK == "eof":
            if data and (
                not data.endswith(b"\n") or re.search(rb"(?:\r?\n){2}$", data)
            ):
                raise ValueError("expected exactly one final newline")
        elif CHECK == "whitespace":
            if any(line.endswith((" ", "\t")) for line in text.splitlines()):
                raise ValueError("trailing whitespace")
        else:
            raise ValueError(f"unknown check: {CHECK}")
    except (OSError, UnicodeError, ValueError, yaml.YAMLError) as error:
        print(f"{filename}: {error}", file=sys.stderr)
        failed = True
sys.exit(1 if failed else 0)
