"""Tests for the shared model and vectors."""
import csv
import hashlib
import json
import lzma
import random
import unittest
from pathlib import Path

from test_phrase import decode, phrase

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / 'models' / 'phrase-v8.json'
VECTORS = ROOT / 'tests' / 'vectors' / 'phrase-v8.json'


class ReleasedModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = json.loads(MODEL.read_bytes())
        cls.vectors = json.loads(VECTORS.read_bytes())

    def test_version_and_golden_vectors(self):
        self.assertEqual(self.model['version'], 'phrase-v8')
        self.assertEqual(self.vectors['model_version'], 'phrase-v8')
        self.assertEqual(self.vectors['model_sha256'], hashlib.sha256(MODEL.read_bytes()).hexdigest())
        self.assertEqual(len(self.vectors['vectors']), 18)
        covered = set()
        for vector in self.vectors['vectors']:
            value = int(vector['value_hex'], 16)
            covered.add(value & 15)
            self.assertEqual(phrase.encode(self.model, value), vector['phrase'])
            self.assertEqual(decode(self.model, vector['phrase']), value)
        self.assertEqual(covered, set(range(16)))

    def test_seeded_reference_roundtrips_and_distinct_phrases(self):
        rng = random.Random(0x51a7ab1e)
        values = [rng.getrandbits(64) for _ in range(20000)]
        self.assertEqual(len(values), len(set(values)))
        outputs = [phrase.encode(self.model, value) for value in values]
        self.assertEqual(len(outputs), len(set(outputs)))
        for value, output in zip(values, outputs):
            self.assertEqual(decode(self.model, output), value)

    def test_source_contributions_cover_corpus(self):
        sources = ROOT / 'models' / 'sources'
        with (sources / 'inputs.csv').open(encoding='utf-8', newline='') as stream:
            inputs = {(row['family'], row['snapshot']) for row in csv.DictReader(stream)}
        words, unknown = set(), set()
        with lzma.open(sources / 'contributions.csv.xz', 'rt', encoding='utf-8', newline='') as stream:
            for row in csv.DictReader(stream):
                source = (row['family'], row['input'])
                if source not in inputs:
                    unknown.add(source)
                words.add(row['word'])
        self.assertFalse(unknown)
        corpus = phrase.corpus_words(ROOT / 'models' / 'training-data' / 'phrase-words.txt.xz')
        self.assertEqual(words, set(corpus))

    def test_reject_noncanonical_vectors(self):
        original = self.vectors['vectors'][0]['phrase']
        for bad in ('', ' ' + original, original + ' ', original.replace(' ', '  ', 1),
                    original.replace(' ', '\t', 1), original.upper(), original + '!',
                    original + ' ' + original.split()[0], original.replace(' ', '', 1)):
            with self.subTest(bad=bad):
                self.assertIsNone(decode(self.model, bad))


if __name__ == '__main__':
    unittest.main()
