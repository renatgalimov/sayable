'use strict';

const model = JSON.parse(document.getElementById('model-data').textContent);
const originData = JSON.parse(document.getElementById('origin-data').textContent);
const allLayouts = PhraseGame.layouts();
const colors = {layout:'#c34b1d', beginning:'#343e56', middle:'#8794a4', ending:'#5b7180'};
const pale = {layout:'#f9e8df', beginning:'#e0e4eb', middle:'#e9edf0', ending:'#e4eaed'};
const $ = id => document.getElementById(id);
const fmt = n => Number(n.toFixed(3)).toString();
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const text = token => model.tokens[token].replace(/^\^|\$$/g, '');
let prefix = [];
let state = null;
let history = [];
let forced = [];

function node(tag, cls, value) {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (value !== undefined) element.textContent = value;
  return element;
}
function snapshot() { return {prefix: [...prefix], state, forced: [...forced]}; }
function save() { history.push(snapshot()); }
function startLayout() {
  const index = allLayouts.findIndex(row => row.length === prefix.length && row.every((n, i) => n === prefix[i]));
  state = PhraseGame.start(model, index);
}
function settleLayout() {
  forced = [];
  let options = PhraseGame.layoutOptions(prefix);
  while (options.length === 1) {
    prefix.push(options[0].value);
    forced.push(options[0].value);
    options = PhraseGame.layoutOptions(prefix);
  }
  if (!options.length) startLayout();
}
function chooseLength(length) {
  save(); prefix.push(length); settleLayout(); render();
}
function chooseToken(index) {
  save(); state = PhraseGame.pick(model, state, index); forced = []; render();
}
function randomIndex(max) {
  const range = 2 ** 32;
  const ceiling = range - (range % max);
  const sample = new Uint32Array(1);
  do { crypto.getRandomValues(sample); } while (sample[0] >= ceiling);
  return sample[0] % max;
}
function randomFill() {
  save();
  if (!state) {
    const possible = PhraseGame.possibleLayouts(prefix);
    prefix = [...possible[randomIndex(possible.length)]];
    startLayout();
  }
  while (!state.complete) {
    const options = PhraseGame.options(model, state);
    state = PhraseGame.pick(model, state, randomIndex(options.choices.length));
  }
  forced = []; render();
}
function undo() {
  const prior = history.pop();
  if (!prior) return;
  ({prefix, state, forced} = prior); render();
}
function reset() { prefix = []; state = null; history = []; forced = []; render(); }

function renderGauge() {
  const possible = state ? 1 : PhraseGame.possibleLayouts(prefix).length;
  const layoutBits = Math.log2(allLayouts.length / possible);
  const count = state ? state.bits : layoutBits;
  $('count').textContent = fmt(count);
  $('remaining').textContent = count === 64 ? 'complete' : `${fmt(64 - count)} to go`;
  $('gauge').setAttribute('aria-valuenow', fmt(count));
  $('gauge').setAttribute('aria-valuetext', `${fmt(count)} of 64 bits chosen`);
  const bits = [];
  for (let i = 0; i < 4; i++) {
    const fill = Math.max(0, Math.min(1, layoutBits - i));
    bits.push(fill === 0 ? '' : fill === 1 ? colors.layout : `linear-gradient(to right, ${colors.layout} ${fill * 100}%, white ${fill * 100}%)`);
  }
  if (state) for (const [i, step] of state.steps.entries()) {
    const color = i < state.tokens.length ? colors[step.kind] : pale[step.kind];
    bits.push(...Array(step.bits).fill(color));
  }
  while (bits.length < 64) bits.push('');
  $('gauge').replaceChildren(...bits.map((color) => {
    const square = node('span', 'bit');
    if (color) { square.style.background = color; square.style.borderColor = 'transparent'; }
    return square;
  }));
}
function renderPhrase() {
  const phrase = $('phrase');
  phrase.replaceChildren();
  const layout = state ? state.layout : prefix;
  let position = 0;
  for (const [wordIndex, length] of layout.entries()) {
    const word = node('span', 'word');
    for (let slot = 0; slot < length; slot++) {
      const kind = slot === 0 ? 'b' : slot === length - 1 ? 'e' : 'c';
      const token = state && state.tokens[position] !== undefined ? text(state.tokens[position]) : '·';
      word.append(node('span', `slot ${kind} ${token === '·' ? 'placeholder' : 'filled'}`, token));
      position++;
    }
    word.setAttribute('aria-label', state && state.words[wordIndex] ? state.words[wordIndex] : `word ${wordIndex + 1}, not filled`);
    phrase.append(word);
  }
  if (!layout.length) phrase.append(node('span', 'placeholder', 'Your phrase will appear here.'));
}
function layoutPanel() {
  const options = PhraseGame.layoutOptions(prefix);
  const possible = options.reduce((sum, option) => sum + option.leaves, 0);
  const ordinal = ['first', 'second', 'third', 'fourth'][prefix.length];
  $('step').textContent = '1 / Choose a layout';
  $('heading').textContent = `How long is the ${ordinal} word?`;
  const used = prefix.reduce((a, b) => a + b, 0);
  $('prompt').textContent = prefix.length
    ? `${used} of 10 tokens are placed. ${plural(10 - used, 'token')} remain; ${plural(possible, 'layout')} still fit.`
    : 'Split 10 tokens into words of 2 to 4 tokens. There are 16 layouts; choosing one carries 4 bits.';
  if (prefix.length && history.length) {
    const previous = history.at(-1);
    if (!previous.state && previous.prefix.length < prefix.length) {
      const choices = PhraseGame.layoutOptions(previous.prefix);
      const last = choices.find(item => item.value === prefix[previous.prefix.length]);
      if (last) $('prompt').textContent += ` Your last choice kept ${last.leaves} of ${choices.reduce((sum, item) => sum + item.leaves, 0)} layouts and carried ${fmt(last.bits)} bits.`;
    }
  }
  const grid = node('div', 'choices layout-choices');
  for (const length of [2, 3, 4]) {
    const option = options.find(item => item.value === length);
    const button = node('button', 'choice'); button.type = 'button'; button.dataset.layout = length;
    button.append(node('b', '', `${length} tokens`));
    if (option) {
      button.append(node('small', '', `Keeps ${option.leaves} of ${possible} · ${fmt(option.bits)} bits`));
      button.addEventListener('click', event => { chooseLength(length); if (event.detail === 0) $('heading').focus(); });
    } else {
      button.disabled = true;
      const left = 10 - used - length;
      const reason = left < 0 ? 'More tokens than remain' : left === 1 ? 'Would leave one token' : 'No valid layout would remain';
      button.append(node('small', '', reason));
    }
    grid.append(button);
  }
  const why = node('details', 'why');
  why.append(node('summary', '', 'Why ten tokens?'));
  const nine = (function count(left, words) {
    if (!left) return 1;
    if (words === 4) return 0;
    return [2,3,4].filter(n => n <= left).reduce((sum, n) => sum + count(left - n, words + 1), 0);
  })(9, 0);
  const layoutBits = Math.floor(Math.log2(nine));
  why.append(node('p', '', `With 9 tokens there are ${nine} layouts, but only ${2 ** layoutBits} fit in ${layoutBits} layout bits. The tokens carry ${9 * 6} more, giving ${layoutBits + 9 * 6} bits. With 10 tokens there are ${allLayouts.length} layouts (4 bits) and the tokens carry ${10 * 6}: exactly 64 bits.`));
  $('panel').replaceChildren(grid, why);
}
function excludedDetails(step) {
  const previous = state.tokens.at(-1);
  const start = step.kind === 'beginning' ? 0 : step.kind === 'middle' ? 512 : 256;
  const end = step.kind === 'beginning' ? 256 : step.kind === 'middle' ? 1024 : 512;
  const labels = {
    blocked: 'Blocked by the word-list filter',
    vowel: 'Needs a vowel',
    triple: 'Three vowels or repeated letters',
    join: 'Rare letter joins',
    conflict: 'Conflicts with a selected token',
    unselected: 'Not selected for this list'
  };
  const explanations = {
    blocked: 'The compiler restricted this transition using its word-list checks. The restriction applies even when the triggering word is not in your current prefix.',
    vowel: 'This beginning and token together have no vowel. For this check, y counts as a vowel.',
    triple: 'This combination contains three consecutive vowels or three of the same letter.',
    join: 'At least one three-letter join occurs in too few distinct training words. This includes unlikely consonant combinations.',
    conflict: 'This token has a prefix relationship with a token in the final middle or ending list.',
    unselected: 'The compiler did not select this token for this list. Ranking, conflicts and list capacity can affect selection.'
  };
  const groups = Object.fromEntries(Object.keys(labels).map(key => [key, []]));
  for (let token = start; token < end; token++) {
    const reason = PhraseGame.exclusion(model, originData, step.kind, previous, token);
    if (reason) groups[reason].push(token);
  }
  const container = node('div');
  container.append(node('p', 'note', 'These checks compare candidates with the final model; they do not record the exact order in which candidates were rejected.'));
  for (const [reason, tokens] of Object.entries(groups)) {
    if (!tokens.length) continue;
    const group = node('details');
    group.dataset.reason = reason;
    group.append(node('summary', '', `${labels[reason]} (${tokens.length})`));
    group.append(node('p', 'note', explanations[reason]));
    const chips = node('div', 'muted-chips');
    for (const token of tokens) chips.append(node('span', '', text(token)));
    group.append(chips); container.append(group);
  }
  return container;
}
function wordInfo(container, index) {
  const word = originData.words[index];
  container.replaceChildren(node('strong', '', word));
  const originals = originData.word_originals[String(index)] || [];
  container.append(node('p', '', originals.length ? 'Indexed original spellings:' : 'No exact original spelling is available in the Wiktionary entry index.'));
  for (const [group, language, spelling] of originals) {
    const row = node('p');
    const title = originData.languages[group]?.name || group;
    const entry = node('a', '', spelling);
    entry.href = 'https://en.wiktionary.org/wiki/' + encodeURIComponent(spelling);
    entry.target = '_blank'; entry.rel = 'noopener noreferrer';
    const history = node('a', '', 'contributors');
    history.href = entry.href + '?action=history'; history.target = '_blank'; history.rel = 'noopener noreferrer';
    row.append(entry, document.createTextNode(` — ${title}${language === group ? '' : ` (${language})`} · `), history);
    container.append(row);
  }
  container.append(node('p', '', 'Matching inputs (sources can overlap):'));
  const list = node('ul');
  for (const sourceId of originData.word_sources[index]) {
    const [group, member, family, snapshot, url, license] = originData.sources[sourceId];
    const title = originData.languages[group]?.name || group;
    const item = node('li');
    const link = node('a', '', `${family}: ${snapshot}`); link.href = url;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    item.append(document.createTextNode(`${title}${member === group ? '' : ` (${member})`}: `), link,
      document.createTextNode(` — ${license}`));
    list.append(item);
  }
  container.append(list);
  container.scrollIntoView({block: 'nearest'});
}
function showOrigin(line, previous, token) {
  const key = `${previous},${token}`;
  const example = originData.examples[key];
  const matches = originData.postings[key] || [];
  line.replaceChildren();
  const label = previous === -1 ? `“${text(token)}”` : `“${text(previous)}” → “${text(token)}”`;
  line.append(node('p', '', matches.length
    ? `${label}: ${plural(matches.length, 'occurrence')} in the normalized training dictionary, using the compiler’s token boundaries.`
    : `${label}: not found in the compiler’s segmentation of the training dictionary.`));
  function languageLink(code) {
    const language = originData.languages[code];
    const [article, section] = language.article.split('#');
    const link = node('a', '', language.name); link.dataset.languageGroup = code;
    link.href = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(article) + (section ? '#' + encodeURIComponent(section) : '');
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    return link;
  }
  if (example) {
    const [, original, code, url, start, end] = example;
    const chars = Array.from(original);
    const word = node('a'); word.href = url; word.target = '_blank'; word.rel = 'noopener noreferrer';
    word.append(document.createTextNode(chars.slice(0, start).join('')),
      node('b', '', chars.slice(start, end).join('')), document.createTextNode(chars.slice(end).join('')));
    const originalLine = node('p');
    originalLine.append(document.createTextNode('A recorded original spelling: '), word,
      document.createTextNode(' ('), languageLink(code), document.createTextNode(').'));
    line.append(originalLine);
  }
  if (matches.length) {
    const counts = new Map();
    for (const word of new Set(matches.map(([word]) => word))) {
      const groups = new Set(originData.word_sources[word].map(source => originData.sources[source][0]));
      for (const code of groups) counts.set(code, (counts.get(code) || 0) + 1);
    }
    const codes = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) ||
      originData.languages[a].name.localeCompare(originData.languages[b].name));
    const languages = node('p', 'origin-languages');
    languages.append(document.createTextNode(`Recorded source language groups for matching training words (${codes.length}): `));
    codes.slice(0, 3).forEach((code, index) => {
      if (index) languages.append(document.createTextNode(', '));
      languages.append(languageLink(code));
    });
    if (codes.length > 3) languages.append(document.createTextNode(` and ${codes.length - 3} more`));
    languages.append(document.createTextNode('.'));
    line.append(languages);
    if (codes.length > 3) {
      const all = node('details', 'origin-all-languages');
      all.append(node('summary', '', `Show all ${codes.length} language groups`));
      const list = node('p');
      codes.forEach((code, index) => {
        if (index) list.append(document.createTextNode(', '));
        list.append(languageLink(code));
      });
      all.append(list); line.append(all);
    }
    const details = node('details');
    details.append(node('summary', '', `Browse all ${matches.length.toLocaleString('en-US')} matching occurrences`));
    const list = node('div', 'origin-list');
    const info = node('div', 'word-info'); info.setAttribute('aria-live', 'polite');
    const more = node('button', '', 'Show more'); more.type = 'button'; more.dataset.moreMatches = '';
    let shown = 0;
    function appendBatch() {
      for (const [wordIndex, position] of matches.slice(shown, shown + 50)) {
        const word = originData.words[wordIndex], item = node('button');
        item.type = 'button'; item.dataset.wordIndex = wordIndex;
        item.append(document.createTextNode(word.slice(0, position)), node('b', '', word.slice(position, position + text(token).length)),
          document.createTextNode(word.slice(position + text(token).length)));
        item.addEventListener('click', () => wordInfo(info, wordIndex));
        list.append(item);
      }
      shown = Math.min(shown + 50, matches.length);
      more.hidden = shown === matches.length;
    }
    more.addEventListener('click', appendBatch); appendBatch();
    details.append(info, list, more); line.append(details);
  }
}
function tokenPanel() {
  const step = PhraseGame.options(model, state);
  const number = state.tokens.length + 1;
  const ordinal = ['first', 'second', 'third', 'fourth'][step.word];
  $('step').textContent = `2 / Pick tokens · ${number} of 10`;
  $('heading').textContent = `Pick ${step.kind === 'ending' ? 'an' : 'a'} ${step.kind}.`;
  const context = step.kind === 'beginning' ? `Start the ${ordinal} word.` : `Continue the ${ordinal} word after “${text(state.tokens.at(-1))}”.`;
  $('prompt').textContent = (state.tokens.length === 0 ? `Your layout ${state.layout.join(' + ')} is one of 16, worth 4 bits. ` : '')
    + `${context} Pick one of ${step.choices.length}; this choice carries ${step.bits} bits.`
    + (forced.length ? ` The remaining word length${forced.length === 1 ? ' was' : 's were'} forced, so ${forced.length === 1 ? 'it adds' : 'they add'} 0 bits.` : '');
  const origin = node('div', 'origin', 'Focus or select a token to see its matches in the training dictionary.');
  if (state.tokens.length) {
    const last = state.tokens.length - 1;
    const previous = state.steps[last].kind === 'beginning' ? -1 : state.tokens[last - 1];
    showOrigin(origin, previous, state.tokens[last]);
  }
  let previewing = false;
  const grid = node('div', 'token-grid'); grid.setAttribute('aria-label', `${step.kind} choices`);
  step.choices.forEach((id, index) => {
    const button = node('button', 'token', text(id)); button.type = 'button';
    button.dataset.choice = index; button.setAttribute('aria-label', `${text(id)}, choice ${index} of ${step.choices.length - 1}`);
    const previous = step.kind === 'beginning' ? -1 : state.tokens.at(-1);
    let touched = false;
    button.addEventListener('pointerdown', event => { touched = event.pointerType === 'touch'; });
    button.addEventListener('pointercancel', () => { touched = false; });
    button.addEventListener('pointermove', event => {
      if (previewing && event.pointerType === 'mouse') { previewing = false; showOrigin(origin, previous, id); }
    });
    button.addEventListener('mouseenter', () => { if (!previewing) showOrigin(origin, previous, id); });
    button.addEventListener('focus', () => {
      if (!touched) { previewing = false; showOrigin(origin, previous, id); }
    });
    button.addEventListener('click', event => {
      const touch = event.pointerType === 'touch' || (event.detail > 0 && touched);
      touched = false;
      if (touch) {
        previewing = true;
        showOrigin(origin, previous, id);
        const confirm = node('button', '', `Choose “${text(id)}”`); confirm.type = 'button';
        confirm.dataset.confirmChoice = index;
        confirm.addEventListener('click', confirmEvent => { chooseToken(index); if (confirmEvent.detail === 0) $('heading').focus(); });
        origin.prepend(confirm);
        confirm.focus({preventScroll:true});
        origin.scrollIntoView({block:'nearest'});
      } else {
        chooseToken(index); if (event.detail === 0) $('heading').focus();
      }
    }); grid.append(button);
  });
  const note = node('p', 'context', step.kind === 'beginning'
    ? 'Every word starts with one of these beginnings. Scroll the list to see them all.'
    : 'The choices depend on the previous token. Scroll the list to see them all.');
  const last = state.tokens.length - 1;
  const picked = last < 0 ? null : node('p', 'context', `You picked “${text(state.tokens[last])}”: choice ${state.picks[last]}, or ${state.picks[last].toString(2).padStart(state.steps[last].bits, '0')} in binary. It carries ${state.steps[last].bits} bits.`);
  $('panel').replaceChildren(...[picked, grid, note, origin, excludedDetails(step)].filter(Boolean));
}
function resultPanel() {
  $('step').textContent = '3 / Complete'; $('heading').textContent = 'You filled 64 bits.';
  $('prompt').textContent = 'The phrase and number describe the same choices. The layout is stored in the lowest four bits.';
  const box = node('div', 'result');
  box.append(node('div', 'result-label', 'Your phrase'), node('div', 'result-phrase', state.phrase),
    node('div', 'result-label', '64-bit value · hexadecimal'), node('div', 'hex', '0x' + state.value.toString(16).padStart(16, '0')),
    node('div', 'result-label bits-label', 'Binary · most significant bit on the left'));
  const binary = state.value.toString(2).padStart(64, '0').match(/.{8}/g).join(' ');
  box.append(node('div', 'binary', binary));
  const note = node('p', 'security', 'This is reversible: the phrase reveals the number. It does not hide secrets.');
  const last = state.tokens.length - 1;
  const origin = node('div', 'origin result-origin');
  showOrigin(origin, state.steps[last].kind === 'beginning' ? -1 : state.tokens[last - 1], state.tokens[last]);
  $('panel').replaceChildren(box, node('p', 'context', `Your final token: “${text(state.tokens[last])}”.`), origin, note);
}
function render() {
  renderGauge(); renderPhrase();
  $('stage').dataset.phase = !state ? 'layout' : state.complete ? 'complete' : 'token';
  $('stage').dataset.prefix = prefix.join(',');
  $('undo').disabled = !history.length;
  $('random').disabled = !!state && state.complete;
  if (!state) layoutPanel(); else if (state.complete) resultPanel(); else tokenPanel();
  $('announcer').textContent = `${$('heading').textContent} ${$('count').textContent} of 64 bits chosen.`;
}
let dictionaryMatches = originData.words.map((_, index) => index);
let dictionaryShown = 0;
function moreDictionary() {
  for (const index of dictionaryMatches.slice(dictionaryShown, dictionaryShown + 50)) {
    const item = node('button', '', originData.words[index]); item.type = 'button'; item.dataset.wordIndex = index;
    item.addEventListener('click', () => wordInfo($('dictionary-info'), index));
    $('dictionary-results').append(item);
  }
  dictionaryShown = Math.min(dictionaryShown + 50, dictionaryMatches.length);
  $('dictionary-more').hidden = dictionaryShown === dictionaryMatches.length;
}
function searchDictionary() {
  const query = $('dictionary-search').value.trim().normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '');
  dictionaryMatches = [];
  for (let index = 0; index < originData.words.length; index++) {
    if (originData.words[index].includes(query)) dictionaryMatches.push(index);
  }
  dictionaryShown = 0;
  $('dictionary-results').replaceChildren(); $('dictionary-info').replaceChildren();
  $('dictionary-count').textContent = `${dictionaryMatches.length.toLocaleString('en-US')} of ${originData.words.length.toLocaleString('en-US')} normalized training words`;
  moreDictionary();
}
$('dictionary-search').addEventListener('input', searchDictionary);
$('dictionary-more').addEventListener('click', moreDictionary);
searchDictionary();
for (const [id, action] of [['random', randomFill], ['undo', undo], ['reset', reset]]) {
  $(id).addEventListener('click', event => { action(); if (event.detail === 0) $('heading').focus(); });
}
render();
