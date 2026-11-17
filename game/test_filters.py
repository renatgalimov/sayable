"""Check every displayed filter explanation against the compiler's predicates."""

import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'compiler'))
import compile_phrase as phrase  # noqa: E402


class FilterTest(unittest.TestCase):
    def test_all_contexts_and_candidates(self):
        model = json.loads((ROOT / 'models/phrase-v8.json').read_text())
        words = phrase.read_text(ROOT / 'models/training-data/phrase-words.txt.xz').splitlines()
        counts = phrase.trigram_counts(words)
        trigram_sets = {}
        js = r'''
const fs = require('fs');
const model = JSON.parse(fs.readFileSync('models/phrase-v8.json', 'utf8'));
const html = fs.readFileSync('game/space-game.html', 'utf8');
const data = JSON.parse(html.match(/<script id="origin-data" type="application\/json">(.*?)<\/script>/s)[1]);
const game = require('./game/logic.cjs');
const codes = {blocked:'b', vowel:'v', triple:'t', join:'j', conflict:'c', unselected:'u'};
let output = '';
for (const previous of model.contexts) {
  for (let token = 256; token < 1024; token++) {
    const reason = game.exclusion(model, data, token < 512 ? 'ending' : 'middle', previous, token);
    output += reason === null ? 'a' : codes[reason];
  }
}
process.stdout.write(output);
'''
        actual = subprocess.run(['node', '-e', js], cwd=ROOT, check=True, capture_output=True, text=True).stdout
        self.assertEqual(len(actual), len(model['contexts']) * 768)
        def bare(token):
            return model['tokens'][token].removeprefix('^').removesuffix('$')

        for row, previous in enumerate(model['contexts']):
            before = bare(previous)
            minimum = model['relaxed'].get(str(previous), phrase.MIN_TRIGRAM_WORDS)
            if minimum not in trigram_sets:
                trigram_sets[minimum] = {key for key, count in counts.items() if count >= minimum}
            selected = set(model['middle'][row] + model['end32'][row])
            selected_texts = [bare(token) for token in selected]
            blocked = set(model['banned'].get(str(previous), []))
            for token in range(256, 1024):
                after = bare(token)
                options = model['end32'][row] if token < 512 else model['middle'][row]
                if token in options:
                    reason = 'a'
                elif token in blocked:
                    reason = 'b'
                elif previous < phrase.NUM_BEGIN and not phrase.has_vowel(before) and not phrase.has_vowel(after):
                    reason = 'v'
                elif not phrase.triple_free(before, after):
                    reason = 't'
                elif not phrase.joins_well(before, after, trigram_sets[minimum]):
                    reason = 'j'
                elif any(phrase.conflicts(after, chosen) for chosen in selected_texts):
                    reason = 'c'
                else:
                    reason = 'u'
                got = actual[row * 768 + token - 256]
                if got != reason:
                    self.fail(f'{previous=} {token=} {before=} {after=}: expected {reason}, got {got}')


if __name__ == '__main__':
    unittest.main()
