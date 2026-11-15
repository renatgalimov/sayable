# Sayable

I plan to use Sayable for obfuscation. I needed a way to turn hashes into words that people can read and say, so I'm building a reversible encoding for short phrases.

Other projects, such as [word4num](https://pypi.org/project/word4num/) and [go-words](https://github.com/opencoff/go-words), also turn numbers or bytes into words. What I want from Sayable is pronounceable, constructed words with a strong focus on filtering bad words, a provable filter, and a stable mapping across implementations.

I also wanted the phrases to sound like more than just English. I drew on many spoken languages and made-up languages when building the model.

There will be a game that explains how the system works.

The initial format handles 64-bit values. The prototype model uses ten tokens per phrase; its mapping is not yet released. For a longer hash phrase, I can take a stream of bytes from SHAKE and encode it in 64-bit chunks; that is composition by the caller, not a variable-length Sayable format.

Sayable is an encoding, not encryption: anyone can reverse a phrase back into its encoded value. Hashing and obfuscation do not make it a way to protect secrets.

## Model compiler

`compiler/compile_phrase.py` ports the project's phrase-v7 prototype. It selects prefix-free beginnings and context-dependent middle and ending tokens, checks joins, and walks reachable words against the supplied blocklist. A phrase has ten tokens across three or four words; its 16 layouts encode 64 bits. This is a model generator and reference encoder, not a runtime package or a released mapping.

The original training corpus, blocklist and their derived tables are **not included**: their provenance and redistribution terms remain unresolved. See [the provenance review](PROVENANCE.md). Do not publish them or outputs derived from them until their sources and licenses have been reviewed. The compiler requires a sufficiently large, suitable corpus to fill all rows; the synthetic test corpus is not training data and does not constitute a production model.

Inputs may be UTF-8 text or `.xz` compressed text. The corpus is read as lowercase ASCII word sequences. The blocklist contains one `term<TAB>source[,source...]` per line; terms must contain only ASCII letters and are lowercased. Source labels are nonempty and use only ASCII letters, digits, `.`, `_`, or `-`. Terms of five or more letters are checked anywhere within each word. Four-letter terms are checked at the start of a word, or anywhere if tagged `dsojevic-en-2`, `dsojevic-en-3`, `dsojevic-en-4` or `dsojevic-en-racial`. Three-letter terms with those labels are checked at word starts; shorter terms and other three-letter terms are ignored. Matches spanning spaces between words are not checked. Supply reviewed inputs and output paths outside the repository:

```sh
python compiler/compile_phrase.py --corpus /private/words.txt.xz \
  --blocklist /private/blocklist.txt.xz --model /private/model.json \
  --report /private/report.json
# Recompute and compare both outputs byte for byte:
python compiler/compile_phrase.py --corpus /private/words.txt.xz \
  --blocklist /private/blocklist.txt.xz --model /private/model.json \
  --report /private/report.json --check
```

The compiler stages both outputs in their destination directories before replacing either one. A staging failure leaves existing outputs unchanged; publication then replaces the model and report separately, not atomically as a pair. If the second replacement fails or the process is interrupted, the files may not match; rerun the compiler and use `--check`. Replacements create new files with restrictive temporary-file permissions and replace output symlinks themselves, rather than their targets. Avoid concurrent changes to input or output paths while compiling.

The compiler fails when it cannot construct or validate the tables; it must run without Python's `-O` flag. Tests use explicitly invented tokens and terms, and exercise segmentation, the reference encoder/decoder, layouts, filtering and validation; they do not assert safety for an unpublished production model. Run them with `python -m unittest discover -s tests -v`.

## Contributing

Install Git, Python 3.11 or newer, and Node.js 22 with npm. Then run:

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
npm ci --ignore-scripts --no-audit --no-fund
pre-commit run --all-files --show-diff-on-failure
```

Optionally run `pre-commit install` to enable checks on commits; the commands above do not install Git hooks. CI runs the same checks. Whitespace and final-newline hooks fix files in place; review and stage their changes.

Hook definitions are local; their executables are installed dependencies. Python dependencies are version-pinned, and npm dependencies are locked. Runtimes are not locked and Python downloads are not hash-verified.

## Bad words

My main goal is to keep bad words out. I will filter against the online lists I can find. If a bad word isn't in those lists, I can't promise to catch it.

The filter is not yet fully verified. For 1.0.0, I want to prove mathematically that no output contains a listed term, within a clearly defined matching scope. Until I have that proof, it is a goal, not a guarantee. The proof cannot cover words missing from the lists or every possible interpretation of a phrase.

## Stability

I plan to release the current format as 0.9. Its phrases can still change as I experiment and improve the filter; don't rely on the mapping staying the same before 1.0.0.

Starting with 1.0.0, I guarantee that the same 64-bit value will produce the same phrase throughout that major version. If I need to change the mapping, I will use a new major version, such as 2.0.0, with its own import path. Existing versioned mappings will remain available.

I plan compatible Rust, Python, JavaScript and Elm implementations. See [the plan](PLAN.md). Project code is licensed under the [MIT License](LICENSE). Data and third-party materials may have different terms; their sources and attribution must be reviewed before inclusion.
