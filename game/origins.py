"""Build the game's complete training-word and source indexes."""
import csv
import functools
import json
import lzma
import sys
import unicodedata
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'compiler'))
import compile_phrase as phrase


def fold(text):
    return ''.join(char for char in unicodedata.normalize('NFKD', text).lower()
                   if not unicodedata.category(char).startswith('M'))


def build(model):
    languages = json.loads((ROOT / 'game/languages.json').read_text(encoding='utf-8'))
    split = functools.lru_cache(maxsize=None)(phrase.splitter(model['tokens']))
    allowed = {(-1, token) for token in model['begin']}
    for context, middles, endings in zip(model['contexts'], model['middle'], model['end32']):
        allowed.update((context, token) for token in middles + endings)
    with lzma.open(ROOT / 'models/training-data/phrase-words.txt.xz', 'rt', encoding='utf-8') as stream:
        words = [line.strip() for line in stream]
    word_ids = {word: index for index, word in enumerate(words)}
    examples, word_originals = {}, {}
    path = ROOT / 'models/sources/kaikki-entry-attribution.csv.xz'
    with lzma.open(path, 'rt', encoding='utf-8', newline='') as stream:
        for row in csv.DictReader(stream):
            language, word, original = row['language_code'], row['selected_folded_word'], row['entry_title']
            if fold(original) == word:
                url = 'https://en.wiktionary.org/wiki/' + quote(original, safe="~!*'()")
                if row['entry_url'] != url or row['history_url'] != url + '?action=history':
                    raise ValueError(f'Unexpected Wiktionary URL for {original!r}')
                word_originals.setdefault(str(word_ids[word]), set()).add((row['group'], language, original))
            if language not in languages or row['group'] != language or fold(original) != word:
                continue
            ids = split(word)
            if not ids:
                continue
            offsets = []
            for i, char in enumerate(original):
                offsets.extend([i] * len(fold(char)))
            if len(offsets) != len(word):
                continue
            position = 0
            for i, token in enumerate(ids):
                width = len(phrase.text_of(model['tokens'][token]))
                previous = -1 if i == 0 else ids[i - 1]
                key = (previous, token)
                if key in allowed and key not in examples:
                    start, end = offsets[position], offsets[position + width - 1] + 1
                    while end < len(original) and unicodedata.category(original[end]).startswith('M'):
                        end += 1
                    examples[key] = [word, original, language, row['entry_url'], start, end]
                position += width
    postings = {}
    for index, word in enumerate(words):
        ids = split(word)
        if ids is None:
            continue
        position = 0
        for i, token in enumerate(ids):
            previous = -1 if i == 0 else ids[i - 1]
            if (previous, token) in allowed:
                postings.setdefault(f'{previous},{token}', []).append([index, position])
            position += len(phrase.text_of(model['tokens'][token]))
    inputs_path = ROOT / 'models/sources/inputs.csv'
    with inputs_path.open(encoding='utf-8', newline='') as stream:
        inputs = {(row['family'], row['snapshot']): row for row in csv.DictReader(stream)}
    sources, source_ids = [], {}
    word_sources = [[] for _ in words]
    with lzma.open(ROOT / 'models/sources/contributions.csv.xz', 'rt', encoding='utf-8', newline='') as stream:
        for row in csv.DictReader(stream):
            key = (row['group'], row['member_code'], row['family'], row['input'])
            if key not in source_ids:
                source = inputs[(row['family'], row['input'])]
                source_ids[key] = len(sources)
                sources.append([*key, source['source'], source['license']])
            word_sources[word_ids[row['word']]].append(source_ids[key])
    if any(not matches for matches in word_sources):
        raise ValueError('A training word is missing source matches')
    return {'languages': languages, 'examples': {f'{p},{t}': value for (p, t), value in examples.items()},
            'words': words, 'postings': postings, 'sources': sources, 'word_sources': word_sources,
            'word_originals': {key: sorted(values) for key, values in word_originals.items()}}
