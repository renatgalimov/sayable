import csv
import json
import lzma
import sys
import unittest
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'game'))
sys.path.insert(0, str(ROOT / 'compiler'))


class OriginsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import origins
        cls.model = json.loads((ROOT / 'models/phrase-v8.json').read_text(encoding='utf-8'))
        cls.data = origins.build(cls.model)

    def test_fold_matches_compiler_normalization_order(self):
        import origins
        self.assertEqual(origins.fold('𝐀'), 'a')
        self.assertEqual(origins.fold('café'), 'cafe')

    def test_game_contains_the_whole_training_dictionary(self):
        data = self.data
        with lzma.open(ROOT / 'models/training-data/phrase-words.txt.xz', 'rt', encoding='utf-8') as stream:
            expected = [line.strip() for line in stream]
        self.assertEqual(data.get('words'), expected, 'the game must include the exact training dictionary')

    def test_pair_index_contains_every_corpus_token_occurrence(self):
        import compile_phrase as phrase

        model = self.model
        data = self.data
        split = phrase.splitter(model['tokens'])
        allowed = {(-1, token) for token in model['begin']}
        for context, middle, ending in zip(model['contexts'], model['middle'], model['end32']):
            allowed.update((context, token) for token in middle + ending)
        expected = {}
        for index, word in enumerate(data['words']):
            ids = split(word)
            if ids is None:
                continue
            position = 0
            for i, token in enumerate(ids):
                previous = -1 if i == 0 else ids[i - 1]
                if (previous, token) in allowed:
                    expected.setdefault(f'{previous},{token}', []).append([index, position])
                position += len(phrase.text_of(model['tokens'][token]))
        self.assertEqual(data['postings'], expected)
        self.assertIn('dolu', [data['words'][i] for i, _ in data['postings']['58,361']])

    def test_source_matches_cover_all_training_words(self):
        data = self.data
        word_ids = {word: index for index, word in enumerate(data['words'])}
        expected = [[] for _ in data['words']]
        with lzma.open(ROOT / 'models/sources/contributions.csv.xz', 'rt', encoding='utf-8', newline='') as stream:
            for row in csv.DictReader(stream):
                expected[word_ids[row['word']]].append((row['group'], row['member_code'], row['family'], row['input']))
        actual = [[tuple(data['sources'][source][:4]) for source in ids] for ids in data['word_sources']]
        self.assertEqual(actual, expected)
        with (ROOT / 'models/sources/inputs.csv').open(encoding='utf-8', newline='') as stream:
            inputs = {(row['family'], row['snapshot']): (row['source'], row['license']) for row in csv.DictReader(stream)}
        for group, member, family, snapshot, url, license in data['sources']:
            self.assertEqual((url, license), inputs[(family, snapshot)])
            self.assertTrue(url.startswith('https://'))
        self.assertEqual({source[0] for source in data['sources']}, set(data['languages']))
        self.assertTrue(all(actual), 'every corpus word has at least one indexed source match')
        self.assertIn(('hu', 'hu', 'subtitles', 'hu_full.txt.xz'), actual[word_ids['amennyire']])

    def test_all_indexed_original_spellings_are_available(self):
        import origins

        data = self.data
        word_ids = {word: index for index, word in enumerate(data['words'])}
        expected = {}
        with lzma.open(ROOT / 'models/sources/kaikki-entry-attribution.csv.xz', 'rt', encoding='utf-8', newline='') as stream:
            for row in csv.DictReader(stream):
                if origins.fold(row['entry_title']) == row['selected_folded_word']:
                    key = str(word_ids[row['selected_folded_word']])
                    expected.setdefault(key, set()).add((row['group'], row['language_code'], row['entry_title'], row['entry_url']))
        actual = {key: {(group, language, title, 'https://en.wiktionary.org/wiki/' + quote(title, safe="~!*'()"))
                        for group, language, title in values}
                  for key, values in data['word_originals'].items()}
        self.assertEqual(actual, expected)
        self.assertIn(('ca', 'ca', 'cafè', 'https://en.wiktionary.org/wiki/caf%C3%A8'), actual[str(word_ids['cafe'])])

    def test_examples_match_real_token_paths(self):
        import compile_phrase as phrase
        import origins

        model = self.model
        data = self.data
        split = phrase.splitter(model['tokens'])
        self.assertGreater(len(data['examples']), 1000)
        for key, item in data['examples'].items():
            previous, current = map(int, key.split(','))
            word, original, language, url, start, end = item
            self.assertIn(language, data['languages'])
            self.assertTrue(url.startswith('https://en.wiktionary.org/wiki/'))
            self.assertTrue(0 <= start < end <= len(original))
            self.assertEqual(origins.fold(original), word)
            self.assertEqual(origins.fold(original[start:end]), phrase.text_of(model['tokens'][current]))
            ids = split(word)
            self.assertIsNotNone(ids)
            pairs = [(-1, ids[0]), *zip(ids, ids[1:])]
            self.assertIn((previous, current), pairs)


if __name__ == '__main__':
    unittest.main()
