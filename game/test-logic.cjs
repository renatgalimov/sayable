const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, 'logic.cjs');
assert.ok(fs.existsSync(file), 'game logic must exist');
const game = require(file);
const model = JSON.parse(fs.readFileSync(path.join(__dirname, '../models/phrase-v8.json')));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../tests/vectors/phrase-v8.json')));

assert.deepEqual(game.layouts(), [
  [2, 2, 2, 4], [2, 2, 3, 3], [2, 2, 4, 2], [2, 3, 2, 3],
  [2, 3, 3, 2], [2, 4, 2, 2], [2, 4, 4], [3, 2, 2, 3],
  [3, 2, 3, 2], [3, 3, 2, 2], [3, 3, 4], [3, 4, 3],
  [4, 2, 2, 2], [4, 2, 4], [4, 3, 3], [4, 4, 2],
]);

for (const vector of fixture.vectors) {
  const value = BigInt('0x' + vector.value_hex);
  let remaining = value >> 4n;
  let state = game.start(model, Number(value & 15n));
  while (!state.complete) {
    const step = game.options(model, state);
    const index = Number(remaining & BigInt(step.choices.length - 1));
    remaining >>= BigInt(step.bits);
    const before = state;
    state = game.pick(model, state, index);
    assert.equal(state.picks.at(-1), index);
    assert.equal(state.picks.length, before.tokens.length + 1);
  }
  assert.equal(remaining, 0n);
  assert.equal(state.phrase, vector.phrase, vector.value_hex);
  assert.equal(state.value, value, vector.value_hex);
  assert.equal(state.bits, 64);
}
assert.throws(() => game.start(model, -1));
assert.throws(() => game.start(model, 16));
assert.throws(() => game.pick(model, game.start(model, 0), 128));
for (const layout of game.layouts()) {
  for (let i = 0; i < layout.length; i++) {
    const prefix = layout.slice(0, i);
    const possible = game.layouts().filter(row => prefix.every((n, j) => row[j] === n));
    const options = game.layoutOptions(prefix);
    assert.equal(options.reduce((sum, option) => sum + option.leaves, 0), possible.length);
    const next = options.find(option => option.value === layout[i]);
    assert.ok(next);
    assert.equal(next.bits, Math.log2(possible.length / next.leaves));
  }
}
assert.deepEqual(game.layoutOptions([2, 2, 2, 4]), []);
console.log(`Game logic: ${fixture.vectors.length} shared vectors passed`);
