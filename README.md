# Sayable

I plan to use Sayable for obfuscation. I needed a way to turn hashes into words that people can read and say, so I'm building a reversible encoding for short phrases.

Other projects, such as [word4num](https://pypi.org/project/word4num/) and [go-words](https://github.com/opencoff/go-words), also turn numbers or bytes into words. What I want from Sayable is pronounceable, constructed words with a strong focus on filtering bad words, a provable filter, and a stable mapping across implementations.

I also wanted the phrases to sound like more than just English. I drew on many spoken languages and made-up languages when building the model.

There will be a game that explains how the system works.

The initial format handles 64-bit values; this repository is at the planning stage, with an implementation to follow. For a longer hash phrase, I can take a stream of bytes from SHAKE and encode it in 64-bit chunks; that is composition by the caller, not a variable-length Sayable format. I don't yet know a reliable way to make shorter words, so I'm experimenting with words of one to five tokens.

Sayable is an encoding, not encryption: anyone can reverse a phrase back into its encoded value. Hashing and obfuscation do not make it a way to protect secrets.

## Contributing

Install Python 3 (with pip) and Git, then run `python -m pip install pre-commit==4.7.0` and `pre-commit install`. Run `pre-commit run --all-files` before opening a pull request; fix any reported issues and rerun it. The first run downloads the pinned hook environments, including a Node.js environment for Markdown linting. The same checks run in GitHub Actions. Python linting and formatting apply when Python files are added.

## Bad words

My main goal is to keep bad words out. I will filter against the online lists I can find. If a bad word isn't in those lists, I can't promise to catch it.

The filter is not yet fully verified. For 1.0.0, I want to prove mathematically that no output contains a listed term, within a clearly defined matching scope. Until I have that proof, it is a goal, not a guarantee. The proof cannot cover words missing from the lists or every possible interpretation of a phrase.

## Stability

I plan to release the current format as 0.9. Its phrases can still change as I experiment and improve the filter; don't rely on the mapping staying the same before 1.0.0.

Starting with 1.0.0, I guarantee that the same 64-bit value will produce the same phrase throughout that major version. If I need to change the mapping, I will use a new major version, such as 2.0.0, with its own import path. Existing versioned mappings will remain available.

I plan compatible Rust, Python, JavaScript and Elm implementations. See [the plan](PLAN.md). Project code is licensed under the [MIT License](LICENSE). Data and third-party materials may have different terms; their sources and attribution must be reviewed before inclusion.
