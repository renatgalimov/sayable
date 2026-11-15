"""Tests use invented pieces and terms, not historical corpus data."""
import copy
import itertools
import json
import random
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "compiler"))
import compile_phrase as phrase


def decode(model, phrase_text):
    """Reference decoder: find the one matching token at each point (rows are prefix-free together)."""
    text = [phrase.text_of(token) for token in model["tokens"]]
    words = phrase_text.split(" ")
    if len(words) not in (3, 4):
        return None
    value, offset, lengths = 0, phrase.layout_bits(), []

    def take(rest, row):
        matches = [(digit, token) for digit, token in enumerate(row) if rest.startswith(text[token])]
        assert len(matches) <= 1
        return matches[0] if matches else None

    for word in words:
        found = take(word, model["begin"])
        if not found:
            return None
        digit, token = found
        rest, middles = word[len(text[token]):], 0
        value, offset = value | digit << offset, offset + phrase.BEGIN_SIZE.bit_length() - 1
        while True:
            found = take(rest, model["end32"][phrase.context(model, token)])
            if found:
                digit, end = found
                rest = rest[len(text[end]):]
                value, offset = value | digit << offset, offset + phrase.END_SIZE.bit_length() - 1
                break
            found = take(rest, model["middle"][phrase.context(model, token)]) if middles < phrase.MAX_WORD - 2 else None
            if not found:
                return None
            digit, token = found
            rest, middles = rest[len(text[token]):], middles + 1
            value, offset = value | digit << offset, offset + phrase.MIDDLE_SIZE.bit_length() - 1
        if rest:
            return None
        lengths.append(middles + 2)
    layouts = phrase.layouts()
    if tuple(lengths) not in layouts:
        return None
    return value | layouts.index(tuple(lengths))


def synthetic_model():
    """Invented fixed-width pieces; not a corpus or a trained model."""
    pairs = [a + b for a, b in itertools.product("abcdefghijklmnopqrstuvwxyz", repeat=2)]
    pieces = lambda prefix: [prefix + pair for pair in pairs if pair != prefix * 2]
    tokens = ["^" + t for t in pieces("b")[:256]] + [t + "$" for t in pieces("d")[:256]]
    tokens += pieces("c")[:512]
    begin = list(range(128))
    rows = phrase.contexts(begin)
    return {"tokens": tokens, "begin": begin, "contexts": rows,
            "middle": [list(range(512, 576)) for _ in rows],
            "end32": [list(range(256, 288)) for _ in rows], "relaxed": {}}


class PhraseTests(unittest.TestCase):
    def test_corpus_folds_accents_before_extracting_words(self):
        with tempfile.TemporaryDirectory() as tmp:
            corpus = Path(tmp) / "corpus"
            corpus.write_text("naïve café NAI\u0308VE CAFE\u0301", encoding="utf-8")
            self.assertEqual(phrase.corpus_words(corpus), ["naive", "cafe", "naive", "cafe"])

    def test_corpus_folds_compatibility_capitals_without_fragments(self):
        with tempfile.TemporaryDirectory() as tmp:
            corpus = Path(tmp) / "corpus"
            corpus.write_text("foo𝐀bar", encoding="utf-8")
            self.assertEqual(phrase.corpus_words(corpus), ["fooabar"])

    def test_corpus_rejects_letters_that_cannot_be_ascii_folded(self):
        with tempfile.TemporaryDirectory() as tmp:
            corpus = Path(tmp) / "corpus"
            corpus.write_text("smørrebrød", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "cannot be ASCII-folded"):
                phrase.corpus_words(corpus)

    def test_invented_corpus_compiles_and_roundtrips(self):
        # Random letter strings and the arbitrary blocked pattern are invented for this test.
        rng = random.Random(20261115)
        words = set()
        while len(words) < 100000:
            word = "".join(rng.choices("abcdefghijklmnopqrstuvwxyz", k=10))
            if not re.search(r"(.)\1\1|[aeiou]{3}", word):
                words.add(word)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            corpus, blocked = root / "corpus", root / "blocked"
            model_path, report_path = root / "model.json", root / "report.json"
            corpus.write_text("\n".join(sorted(words)) + "\n", encoding="ascii")
            blocked.write_text("liyqc\tsynthetic\n", encoding="ascii")
            command = [sys.executable, str(Path(__file__).resolve().parents[1] / "compiler" / "compile_phrase.py"), "--corpus", str(corpus),
                       "--blocklist", str(blocked), "--model", str(model_path),
                       "--report", str(report_path)]
            subprocess.run(command, check=True, capture_output=True, text=True)
            before = (model_path.read_bytes(), report_path.read_bytes())
            subprocess.run(command + ["--check"], check=True, capture_output=True, text=True)
            self.assertEqual((model_path.read_bytes(), report_path.read_bytes()), before)
            model = json.loads(before[0])
            stats = json.loads(before[1])["statistics"]
            self.assertEqual(len(model["tokens"]), 1024)
            self.assertGreater(stats["segmented_words"], 0)
            self.assertGreater(stats["banned_pairs"], 0)
            terms = phrase.Terms([], ["liyqc"])
            self.assertEqual(phrase.violations(model, terms), set())
            # Reintroducing a banned transition must make the forbidden pattern reachable.
            unsafe = copy.deepcopy(model)
            ctx, banned = next(iter(unsafe["banned"].items()))
            token = banned[0]
            row = phrase.context(unsafe, int(ctx))
            kind = "middle" if token >= 512 else "end32"
            self.assertNotIn(token, unsafe[kind][row])
            unsafe[kind][row][0] = token
            self.assertIn((int(ctx), token), phrase.violations(unsafe, terms))
            for value in (0, 1, 2**64 - 1, 0x243F6A8885A308D3):
                self.assertEqual(decode(model, phrase.encode(model, value)), value)

    def test_inputs_are_explicit_and_support_plain_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            corpus, blocked = Path(tmp) / "words.txt", Path(tmp) / "blocked.txt"
            corpus.write_text("Baba beda\n", encoding="utf-8")
            blocked.write_text("zebra\tsynthetic\n", encoding="utf-8")
            self.assertEqual(phrase.corpus_words(corpus), ["baba", "beda"])
            self.assertEqual(phrase.blocklist(blocked), ([], ["zebra"]))

    def test_blocklist_normalizes_ascii_case(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "blocks"
            path.write_text("ZeBrA\tsynthetic\n", encoding="utf-8")
            self.assertEqual(phrase.blocklist(path), ([], ["zebra"]))

    def test_blocklist_rejects_non_ascii_terms(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "blocks"
            path.write_text("bädword\tsynthetic\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "ASCII"):
                phrase.blocklist(path)

    def test_blocklist_rejects_invalid_source_labels(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "blocks"
            for label in ("dsojevic-en-4 ", "", "synthetic,,other"):
                with self.subTest(label=label):
                    path.write_text(f"word\t{label}\n", encoding="utf-8")
                    with self.assertRaisesRegex(ValueError, "source"):
                        phrase.blocklist(path)

    def test_cli_rejects_hardlinked_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            corpus = root / "corpus"
            corpus.write_text("preserve me")
            model = root / "model"
            model.hardlink_to(corpus)
            args = ["--corpus", str(corpus), "--blocklist", str(root / "blocks"),
                    "--model", str(model), "--report", str(root / "report")]
            with patch.object(phrase, "compile_model", return_value=({}, {"statistics": {}})):
                with self.assertRaises(SystemExit):
                    phrase.main(args)
            self.assertEqual(corpus.read_text(), "preserve me")

    def test_blocklist_length_and_source_rules(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "blocks"
            path.write_text("abc\tsynthetic\ndef\tdsojevic-en-3\nword\tsynthetic\n"
                            "term\tdsojevic-en-4\nzebra\tsynthetic\n", encoding="utf-8")
            start, anywhere = phrase.blocklist(path)
            self.assertEqual(start, ["def", "word"])
            self.assertEqual(anywhere, ["term", "zebra"])
            terms = phrase.Terms(start, anywhere)
            self.assertTrue(terms.feed(0, "^wording")[1])
            self.assertFalse(terms.feed(0, "^sword")[1])
            self.assertTrue(terms.feed(0, "^interm")[1])
            self.assertFalse(terms.feed(0, "^wor")[1])
            self.assertFalse(terms.feed(0, "^d")[1])

    def test_cli_writes_and_checks_requested_outputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            args = ["--corpus", str(root / "words"), "--blocklist", str(root / "blocks"),
                    "--model", str(root / "model.json"), "--report", str(root / "report.json")]
            with patch.object(phrase, "compile_model", return_value=({"synthetic": 1}, {"statistics": {}})):
                phrase.main(args)
                self.assertEqual(json.loads((root / "model.json").read_text()), {"synthetic": 1})
                self.assertEqual(json.loads((root / "report.json").read_text()), {"statistics": {}})
                self.assertEqual({p.name for p in root.iterdir()}, {"model.json", "report.json"})
                before = {p: p.read_bytes() for p in root.iterdir()}
                phrase.main(args + ["--check"])
                self.assertEqual({p: p.read_bytes() for p in root.iterdir()}, before)
                report_path = root / "report.json"
                original = report_path.read_bytes()
                report_path.write_bytes(original.replace(b"\n", b"\r\n"))
                with self.assertRaises(SystemExit):
                    phrase.main(args + ["--check"])
                report_path.write_bytes(original)
                (root / "model.json").write_text("{}")
                with self.assertRaises(SystemExit):
                    phrase.main(args + ["--check"])

    def test_cli_missing_report_directory_preserves_model(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            model = root / "model.json"
            model.write_text("old model")
            args = ["--corpus", str(root / "words"), "--blocklist", str(root / "blocks"),
                    "--model", str(model), "--report", str(root / "missing" / "report")]
            with patch.object(phrase, "compile_model", return_value=({"new": 1}, {"statistics": {}})):
                with self.assertRaises(FileNotFoundError):
                    phrase.main(args)
            self.assertEqual(model.read_text(), "old model")
            self.assertEqual({p.name for p in root.iterdir()}, {"model.json"})

    def test_cli_staging_failure_preserves_existing_outputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            model, report = root / "model.json", root / "report.json"
            model.write_text("old model")
            report.write_text("old report")
            args = ["--corpus", str(root / "words"), "--blocklist", str(root / "blocks"),
                    "--model", str(model), "--report", str(report)]
            # The first staged file can be written; the second staging attempt fails.
            with patch.object(phrase, "compile_model", return_value=({"new": 1}, {"statistics": {}})):
                with patch("tempfile.mkstemp", wraps=tempfile.mkstemp) as create:
                    def fail_second(*args, **kwargs):
                        if create.call_count == 2:
                            raise PermissionError("report directory unwritable")
                        return create._mock_wraps(*args, **kwargs)
                    create.side_effect = fail_second
                    with self.assertRaises(PermissionError):
                        phrase.main(args)
            self.assertEqual(model.read_text(), "old model")
            self.assertEqual(report.read_text(), "old report")
            self.assertEqual({p.name for p in root.iterdir()}, {"model.json", "report.json"})

    def test_cli_second_replacement_failure_reports_partial_publication(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            model, report = root / "model", root / "report"
            model.write_text("old model")
            report.write_text("old report")
            args = ["--corpus", str(root / "words"), "--blocklist", str(root / "blocks"),
                    "--model", str(model), "--report", str(report)]
            replace = phrase.os.replace
            def fail_report(source, destination):
                if destination == report:
                    raise PermissionError("cannot replace report")
                return replace(source, destination)
            with patch.object(phrase, "compile_model", return_value=({"new": 1}, {"statistics": {}})):
                with patch.object(phrase.os, "replace", side_effect=fail_report), patch("sys.stderr") as error:
                    with self.assertRaises(PermissionError):
                        phrase.main(args)
            self.assertIn("publication failed", "".join(call.args[0] for call in error.write.call_args_list))
            self.assertEqual(json.loads(model.read_text()), {"new": 1})
            self.assertEqual(report.read_text(), "old report")
            self.assertEqual({p.name for p in root.iterdir()}, {"model", "report"})

    def test_layouts_have_exactly_64_bits(self):
        layouts = phrase.layouts()
        self.assertEqual(len(layouts), 16)
        for layout in layouts:
            self.assertEqual(phrase.layout_bits() + sum(7 + 6 * (n - 2) + 5 for n in layout), 64)

    def test_synthetic_reference_roundtrip_and_vector(self):
        model = synthetic_model()
        self.assertEqual(phrase.encode(model, 0), "baadaa baadaa baadaa baacaacaadaa")
        for value in [0, 1, 15, 16, 2**64 - 1, 0x243F6A8885A308D3]:
            text = phrase.encode(model, value)
            self.assertEqual(decode(model, text), value)
        self.assertIsNone(decode(model, "bad input"))

    def test_blocklist_walk_across_four_tokens(self):
        tokens = [f"t{i}" for i in range(1024)]
        tokens[0], tokens[256], tokens[512], tokens[513] = "^ba", "ds$", "dw", "or"
        rows = phrase.contexts([0])
        model = {"tokens": tokens, "begin": [0], "middle": [[] for _ in rows], "end32": [[] for _ in rows]}
        model["middle"][phrase.context(model, 0)] = [512]
        model["middle"][phrase.context(model, 512)] = [513]
        model["end32"][phrase.context(model, 513)] = [256]
        self.assertEqual(phrase.violations(model, phrase.Terms([], ["adword", "badwordz"])), {(513, 256)})
        self.assertEqual(phrase.violations(model, phrase.Terms([], ["adwordx"])), set())

    def test_validation_rejects_invalid_beginning(self):
        model = synthetic_model()
        model["begin"][1] = model["begin"][0]
        with self.assertRaisesRegex(AssertionError, "beginnings must be prefix-free"):
            phrase.validate(model, [], [], [])

    def test_cli_rejects_colliding_input_and_output_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            words = root / "words"
            words.write_text("preserve me", encoding="utf-8")
            args = ["--corpus", str(words), "--blocklist", str(root / "blocks"),
                    "--model", str(words), "--report", str(root / "report")]
            with patch.object(phrase, "compile_model", return_value=({}, {"statistics": {}})):
                with self.assertRaises(SystemExit):
                    phrase.main(args)
            self.assertEqual(words.read_text(), "preserve me")

    def test_segmentation_prefers_fewer_tokens(self):
        frequency = {0: 3, 256: 3, 257: 3, 512: 3}
        self.assertEqual(
            phrase.segment("babeda", {"ba": 0}, {"be": 512},
                           {"da": 256, "beda": 257}, frequency),
            [0, 257],
        )


if __name__ == "__main__":
    unittest.main()
