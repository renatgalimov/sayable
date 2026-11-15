# Sayable

A planned reversible encoding from unsigned 64-bit integers to pronounceable phrases.

The goal is a shared format for Rust, Python, JavaScript and Elm. The project will use a word filter to reduce known offensive output, but cannot guarantee that every phrase will be suitable in every language or context.

Sayable is encoding, not encryption. It does not add randomness or a checksum.

See [the plan](PLAN.md). Project code is licensed under the [MIT License](LICENSE). Data and third-party materials may have different terms; their sources and attribution must be reviewed before inclusion.
