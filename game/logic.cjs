'use strict';

function layouts() {
  const result = [];
  function visit(words, remaining) {
    if (remaining === 0) {
      result.push(words);
      return;
    }
    if (words.length === 4) return;
    for (let n = 2; n <= 4 && n <= remaining; n++) visit([...words, n], remaining - n);
  }
  visit([], 10);
  return result;
}

function layoutOptions(prefix) {
  const possible = layouts().filter(row => prefix.every((n, i) => row[i] === n));
  if (!possible.length) throw new RangeError('Invalid layout prefix');
  return [2, 3, 4].flatMap(value => {
    const leaves = possible.filter(row => row[prefix.length] === value).length;
    return leaves ? [{value, leaves, bits: Math.log2(possible.length / leaves)}] : [];
  });
}

function start(model, index) {
  const all = layouts();
  if (!Number.isInteger(index) || index < 0 || index >= all.length) throw new RangeError('Invalid layout');
  const steps = all[index].flatMap((length, word) => [
    {kind: 'beginning', word, bits: 7},
    ...Array.from({length: length - 2}, () => ({kind: 'middle', word, bits: 6})),
    {kind: 'ending', word, bits: 5},
  ]);
  return {layout: all[index], index, steps, tokens: [], picks: [], words: [], value: BigInt(index), bits: 4, complete: false, phrase: ''};
}

function options(model, state) {
  if (state.complete) return null;
  const step = state.steps[state.tokens.length];
  if (step.kind === 'beginning') return {...step, choices: model.begin};
  const previous = state.tokens.at(-1);
  const row = previous < 256 ? model.begin.indexOf(previous) : 128 + previous - 512;
  if (row < 0 || row >= model.contexts.length || model.contexts[row] !== previous) throw new Error('Invalid context');
  return {...step, choices: step.kind === 'middle' ? model.middle[row] : model.end32[row]};
}

function pick(model, state, index) {
  const step = options(model, state);
  if (!step || !Number.isInteger(index) || index < 0 || index >= step.choices.length) throw new RangeError('Invalid choice');
  const token = step.choices[index];
  const text = model.tokens[token].replace(/^\^|\$$/g, '');
  const words = [...state.words];
  if (step.kind === 'beginning') words.push(text);
  else words[step.word] += text;
  const tokens = [...state.tokens, token];
  return {...state, tokens, picks: [...state.picks, index], words, phrase: words.join(' '),
    value: state.value | (BigInt(index) << BigInt(state.bits)),
    bits: state.bits + step.bits, complete: tokens.length === state.steps.length};
}

const PhraseGame = {layouts, layoutOptions, start, options, pick};
if (typeof module !== 'undefined') module.exports = PhraseGame;
