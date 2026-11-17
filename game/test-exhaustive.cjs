'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const game = require(process.env.GAME_LOGIC || './logic.cjs');
const model = JSON.parse(fs.readFileSync(path.join(__dirname, '../models/phrase-v8.json')));
const html = fs.readFileSync(path.join(__dirname, 'space-game.html'), 'utf8');
const embedded = html.match(/<script id="model-data" type="application\/json">(.*?)<\/script>/s);
assert.ok(embedded, 'generated game must embed the real model');
assert.deepEqual(JSON.parse(embedded[1]), model, 'generated game model must match phrase-v8 exactly');

function checkChoices(state, expected, bits) {
  const options = game.options(model, state);
  assert.deepEqual(options.choices, expected);
  assert.equal(options.bits, bits);
  expected.forEach((token, digit) => {
    const result = game.pick(model, state, digit);
    assert.equal(result.tokens.at(-1), token);
    assert.equal(result.picks.at(-1), digit);
    assert.equal(result.value, state.value | (BigInt(digit) << BigInt(state.bits)));
    assert.equal(result.bits, state.bits + bits);
    assert.equal(result.words.at(-1), (state.words.at(-1) || '') + model.tokens[token].replace(/^\^|\$$/g, ''));
  });
}

checkChoices(game.start(model, 0), model.begin, 7);
model.contexts.forEach((context, row) => {
  for (const [kind, table, bits] of [['middle', model.middle, 6], ['ending', model.end32, 5]]) {
    const state = {complete: false, steps: [null, {kind, bits, word: 0}], tokens: [context],
      picks: [0], words: ['prefix'], value: 0n, bits: 11};
    checkChoices(state, table[row], bits);
  }
});
const data = JSON.parse(html.match(/<script id="origin-data" type="application\/json">(.*?)<\/script>/s)[1]);
function token(value) { return model.tokens.indexOf(value); }
assert.equal(game.exclusion(model, data, 'ending', token('^ma'), token('de$')), 'blocked');
assert.equal(game.exclusion(model, data, 'ending', token('^pr'), token('nd$')), 'vowel');
assert.equal(game.exclusion(model, data, 'ending', token('^ma'), token('aa$')), 'triple');
assert.equal(game.exclusion(model, data, 'middle', token('^ma'), token('ey')), 'join');
assert.equal(game.exclusion(model, data, 'middle', token('^ma'), token('ar')), 'conflict');
assert.equal(game.exclusion(model, data, 'middle', token('^ma'), token('at')), 'unselected');
console.log(`All ${model.begin.length} beginnings and ${model.contexts.length} context rows match the model at every choice index`);
