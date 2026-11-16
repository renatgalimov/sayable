import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = path.join(here, 'space-game.html');
assert.ok(fs.existsSync(page), 'the playable game must be built');
const output = process.env.OUT_DIR || path.join(process.env.TMPDIR || os.tmpdir(), 'sayable-game-check');
fs.mkdirSync(output, {recursive: true});
const profile = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'sayable-chrome-'));
const chrome = spawn(process.env.CHROME_BIN || 'chromium', ['--headless=new', '--remote-debugging-port=0', '--remote-allow-origins=*',
  `--user-data-dir=${profile}`, '--no-proxy-server', 'about:blank'], {stdio:'ignore', detached:true});
chrome.unref();
process.on('exit', () => {
  try { process.kill(-chrome.pid, 'SIGKILL'); } catch {}
  try { fs.rmSync(profile, {recursive:true, force:true, maxRetries:5}); } catch {}
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const portFile = path.join(profile, 'DevToolsActivePort');
for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleep(100);
assert.ok(fs.existsSync(portFile), 'Chromium did not start');
const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const tab = pages.find(item => item.type === 'page');
assert.ok(tab, 'Chromium did not open a page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, {once:true}); ws.addEventListener('error', reject, {once:true}); });
let id = 0;
const pending = new Map(), errors = [];
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(JSON.stringify(msg.params.args));
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const request = ++id; pending.set(request, msg => msg.error ? reject(Error(JSON.stringify(msg.error))) : resolve(msg.result));
  ws.send(JSON.stringify({id:request, method, params}));
});
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function click(selector) {
  const box = await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); element.scrollIntoView({block:'center'}); const r = element.getBoundingClientRect(); return {x:r.x + r.width / 2, y:r.y + r.height / 2}; })()`);
  await send('Input.dispatchMouseEvent', {type:'mouseMoved', ...box});
  await send('Input.dispatchMouseEvent', {type:'mousePressed', button:'left', clickCount:1, ...box});
  await send('Input.dispatchMouseEvent', {type:'mouseReleased', button:'left', clickCount:1, ...box});
}
async function hover(selector) {
  const box = await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); element.scrollIntoView({block:'center'}); const r = element.getBoundingClientRect(); return {x:r.x + r.width / 2, y:r.y + r.height / 2}; })()`);
  await send('Input.dispatchMouseEvent', {type:'mouseMoved', ...box});
}
async function tap(selector) {
  const box = await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); element.scrollIntoView({block:'center'}); const r = element.getBoundingClientRect(); return {x:r.x + r.width / 2, y:r.y + r.height / 2}; })()`);
  await send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[box]});
  await send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
}
async function shot(name, captureBeyondViewport = true) {
  const result = await send('Page.captureScreenshot', {format:'png', captureBeyondViewport});
  const dest = path.join(output, name); fs.writeFileSync(dest, Buffer.from(result.data, 'base64'));
  console.log('Screenshot:', dest);
}
async function width(w, h) {
  await send('Emulation.setDeviceMetricsOverride', {width:w, height:h, deviceScaleFactor:1, mobile:w < 600});
}
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setFocusEmulationEnabled', {enabled:true});
await width(390, 844); await send('Page.navigate', {url:pathToFileURL(page).href});
for (let i = 0; i < 100 && !(await evaluate(`document.querySelectorAll('#gauge .bit').length === 64`)); i++) await sleep(50);
assert.equal(await evaluate(`document.querySelectorAll('#gauge .bit').length`), 64);
assert.equal(await evaluate(`document.querySelector('#stage').dataset.phase`), 'layout');
for (let i = 0; i < 100 && !(await evaluate(`document.querySelector('#dictionary-count')?.textContent.includes('250,584')`)); i++) await sleep(50);
assert.ok(await evaluate(`document.querySelector('#dictionary-count')?.textContent.includes('250,584')`), 'full training dictionary must load');
await click('.dictionary > summary');
assert.equal(await evaluate(`document.querySelector('.dictionary').open`), true, 'pointer opens the dictionary');
const stickyPhrase = await evaluate(`(() => {
  const phrase = document.getElementById('phrase');
  window.scrollTo(0, 0);
  const original = phrase.getBoundingClientRect().top;
  window.scrollTo(0, original - 30);
  const above = phrase.getBoundingClientRect().top;
  window.scrollTo(0, document.documentElement.scrollHeight);
  const below = phrase.getBoundingClientRect().top;
  window.scrollTo(0, 0);
  return {original, above, below};
})()`);
assert.ok(stickyPhrase.original > 40 && Math.abs(stickyPhrase.above - 30) < 2,
  'the phrase scrolls normally before reaching the top');
assert.ok(Math.abs(stickyPhrase.below) < 2, 'the phrase stays at the top while scrolling through the dictionary');
await click('#dictionary-search');
await send('Input.insertText', {text:'dolu'});
assert.ok((await evaluate(`document.getElementById('dictionary-results').textContent`)).includes('dolu'), 'dictionary search finds a real indexed word');
await shot('mobile-dictionary.png');
await evaluate(`(() => { const input = document.getElementById('dictionary-search'); input.value = 'café'; input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
assert.ok((await evaluate(`document.getElementById('dictionary-results').textContent`)).includes('cafe'), 'accented query follows the corpus folding rules');
await evaluate(`document.querySelector('#dictionary-results [data-word-index="' + originData.words.indexOf('cafe') + '"]').click()`);
const cafeInfo = await evaluate(`document.getElementById('dictionary-info').textContent`);
assert.ok(cafeInfo.includes('Catalan') && cafeInfo.includes('cafè'), 'dictionary exposes indexed source and original spelling');
await shot('mobile-source.png');
await click('.dictionary > summary');
await evaluate(`window.scrollTo(0, 0)`);
await evaluate(`document.querySelector('[data-layout="2"]').focus()`);
await send('Input.dispatchKeyEvent', {type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, text:'\r', unmodifiedText:'\r'});
await send('Input.dispatchKeyEvent', {type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13});
assert.equal(await evaluate(`document.activeElement.id`), 'heading', 'keyboard choice retains visible focus');
await evaluate(`document.getElementById('reset').click()`);
const dictionaryExample = await evaluate(`(() => { const line = document.createElement('div'); showOrigin(line, 58, 361); return line.textContent; })()`);
assert.ok(dictionaryExample.includes('dolu'), 'token matches include the full training dictionary');
const filterGroups = await evaluate(`(() => {
  const saved = state;
  try {
    state = {tokens:[0]};
    const panel = excludedDetails({kind:'middle', choices:model.middle[0]});
    return [...panel.querySelectorAll('[data-reason]')].map(group => group.dataset.reason).sort();
  } finally { state = saved; }
})()`);
assert.deepEqual(filterGroups, ['blocked', 'conflict', 'join', 'triple', 'unselected'].sort(),
  'excluded tokens show the real phrase-v8 filter categories');
const pairLanguages = await evaluate(`(() => {
  const line = document.createElement('div'); showOrigin(line, 58, 361);
  const expected = new Set((originData.postings['58,361'] || []).flatMap(([word]) =>
    originData.word_sources[word].map(source => originData.sources[source][0])));
  const shown = [...line.querySelectorAll('[data-language-group]')].map(link => link.dataset.languageGroup);
  return {expected:[...expected].sort(), shown:[...new Set(shown)].sort()};
})()`);
assert.ok(pairLanguages.expected.length > 1, 'test pair should appear in more than one source group');
assert.deepEqual(pairLanguages.shown, pairLanguages.expected, 'show every recorded language group for a token pair');
const linkedExample = await evaluate(`(() => {
  const line = document.createElement('div'); showOrigin(line, 58, 361);
  const code = originData.examples['58,361'][2];
  const sample = line.querySelector('p:nth-child(2) a:nth-of-type(2)');
  const group = line.querySelector('.origin-languages [data-language-group="' + code + '"], .origin-all-languages [data-language-group="' + code + '"]');
  return {sample:sample.href, group:group.href, name:sample.textContent};
})()`);
assert.equal(linkedExample.sample, linkedExample.group, 'example and group link to the same language page');
assert.ok(linkedExample.name, 'example language name remains visible');
const examplePair = await evaluate(`(() => {
  const line = document.createElement('div');
  showOrigin(line, model.tokens.indexOf('^ab'), model.tokens.indexOf('an'));
  return {text: line.textContent, groups: [...new Set([...line.querySelectorAll('[data-language-group]')].map(link => link.dataset.languageGroup))]};
})()`);
assert.ok(examplePair.text.includes('abantu'), 'ab → an includes its indexed original example');
assert.ok(examplePair.groups.includes('rw') && examplePair.groups.length === 12,
  'ab → an includes Kinyarwanda and all other recorded source groups');
const matchInfo = await evaluate(`(() => {
  const line = document.createElement('div'); showOrigin(line, 58, 361);
  line.querySelector('[data-word-index="' + originData.words.indexOf('dolu') + '"]').click();
  return line.querySelector('.word-info').textContent;
})()`);
assert.ok(matchInfo.includes('Azerbaijani') && matchInfo.includes('dolu'), 'token matches expose the selected word sources');
const missingOriginal = await evaluate(`(() => { const line = document.createElement('div'); wordInfo(line, originData.words.indexOf('amennyire')); return line.textContent; })()`);
assert.ok(missingOriginal.includes('No exact original spelling') && missingOriginal.includes('Hungarian'),
  'unavailable originals are distinguished from known source matches');
const paging = await evaluate(`(() => {
  const line = document.createElement('div'); showOrigin(line, -1, model.begin[0]);
  const before = line.querySelectorAll('.origin-list button').length;
  line.querySelector('[data-more-matches]').click();
  return [before, line.querySelectorAll('.origin-list button').length];
})()`);
assert.deepEqual(paging, [50, 100], 'full token matches can be browsed beyond the first page');
const displayedRows = await evaluate(`(() => {
  const saved = {state, history, forced, render}; let checked = 0, clicks = 0;
  function verifyClicks(buttons, choices, base) {
    render = () => {};
    try {
      for (let i = 0; i < buttons.length; i++) {
        state = base; history = []; buttons[i].click(); clicks++;
        if (state.tokens.at(-1) !== choices[i] || state.picks.at(-1) !== i ||
            state.value !== (base.value | (BigInt(i) << BigInt(base.bits)))) return i;
      }
      return -1;
    } finally { render = saved.render; }
  }
  try {
    state = PhraseGame.start(model, 0); tokenPanel();
    const beginnings = [...document.querySelectorAll('#panel .token')];
    if (beginnings.length !== model.begin.length || beginnings.some((button, i) =>
      button.dataset.choice !== String(i) || button.textContent !== text(model.begin[i]))) return {kind:'beginning'};
    const firstFailure = verifyClicks(beginnings, model.begin, state);
    if (firstFailure >= 0) return {kind:'beginning', digit:firstFailure};
    for (let row = 0; row < model.contexts.length; row++) {
      for (const [kind, table, bits] of [['middle', model.middle, 6], ['ending', model.end32, 5]]) {
        state = {complete:false, layout:[2,4,4], tokens:[model.contexts[row]], picks:[0], words:['word'], value:0n, bits:11,
          steps:[{kind:'beginning',word:0,bits:7},{kind,word:0,bits}]};
        tokenPanel();
        const buttons = [...document.querySelectorAll('#panel .token')];
        if (buttons.length !== table[row].length || buttons.some((button, i) =>
          button.dataset.choice !== String(i) || button.textContent !== text(table[row][i]))) return {row,kind};
        const failure = verifyClicks(buttons, table[row], state);
        if (failure >= 0) return {row,kind,digit:failure};
        checked++;
      }
    }
    return {checked, clicks};
  } finally { ({state, history, forced, render} = saved); render(); }
})()`);
assert.deepEqual(displayedRows, {checked: (await evaluate('model.contexts.length')) * 2, clicks: 61568},
  'all displayed token choices must select the corresponding real-model token and bits');
assert.deepEqual(await evaluate(`(() => {
  const original = crypto.getRandomValues, samples = [4294967295, 2]; let calls = 0;
  try {
    crypto.getRandomValues = array => { array[0] = samples[calls++]; return array; };
    return {value:randomIndex(3), calls};
  } finally { crypto.getRandomValues = original; }
})()`), {value:2, calls:2}, 'random choice must reject modulo bias');
assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'mobile overflow at start');
await shot('mobile-start.png');

const vectors = JSON.parse(fs.readFileSync(path.join(here, '../tests/vectors/phrase-v8.json'))).vectors.slice(0, 16);
const result = await evaluate(`(() => {
  const values = ${JSON.stringify(vectors)};
  const layouts = PhraseGame.layouts();
  const out = [];
  for (let i = 0; i < layouts.length; i++) {
    document.getElementById('reset').click();
    let guard = 0;
    while (document.getElementById('stage').dataset.phase === 'layout' && guard++ < 8) {
      const prefix = document.getElementById('stage').dataset.prefix;
      const count = prefix ? prefix.split(',').length : 0;
      const button = document.querySelector('[data-layout="' + layouts[i][count] + '"]');
      if (!button || button.disabled) throw Error('missing layout ' + i + ' prefix ' + prefix);
      button.click();
    }
    if (document.getElementById('stage').dataset.phase !== 'token') throw Error('no token page ' + i);
    while (document.getElementById('stage').dataset.phase === 'token') {
      const button = document.querySelector('[data-choice="0"]');
      if (!button) throw Error('missing token choice');
      button.click();
    }
    out.push({i, phrase:document.querySelector('.result-phrase').textContent,
      hex:document.querySelector('.hex').textContent, count:document.getElementById('count').textContent,
      overflow:document.documentElement.scrollWidth > innerWidth});
    if (out[i].phrase !== values[i].phrase || out[i].hex !== '0x' + values[i].value_hex || out[i].count !== '64')
      throw Error('wrong output ' + JSON.stringify(out[i]));
  }
  return out;
})()`);
assert.equal(result.length,16); assert.ok(result.every(x => !x.overflow));
assert.ok(await evaluate(`document.querySelector('#panel .result-origin')`), 'final token provenance remains visible on the result screen');
console.log('All 16 layouts match the shared zero-choice vectors');
await shot('mobile-complete.png');
await width(320, 568);
await evaluate(`document.querySelector('.dictionary').open = true; window.scrollTo(0, document.documentElement.scrollHeight)`);
const stickyCompleted = await evaluate(`({top:document.getElementById('phrase').getBoundingClientRect().top,
  words:[...document.querySelectorAll('#phrase .word')].map(word => word.textContent).join(' '),
  overflow:document.documentElement.scrollWidth > innerWidth})`);
assert.ok(Math.abs(stickyCompleted.top) < 2 && !stickyCompleted.overflow, 'completed phrase stays visible on a small phone');
assert.equal(stickyCompleted.words, vectors[15].phrase, 'sticky phrase matches the completed result');
await shot('mobile-sticky.png', false);
await width(320, 320);
await evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`);
assert.ok(Math.abs(await evaluate(`document.getElementById('phrase').getBoundingClientRect().top`)) < 2,
  'phrase stays at the top in a short mobile viewport');
await width(390, 844);
await evaluate(`document.querySelector('.dictionary').open = false; window.scrollTo(0, 0)`);
await evaluate(`document.getElementById('reset').click(); document.querySelector('[data-layout="2"]').click(); document.querySelector('[data-layout="4"]').click(); document.querySelector('[data-layout="4"]').click()`);
assert.equal(await evaluate(`document.getElementById('stage').dataset.phase`), 'token');
assert.equal(await evaluate(`document.getElementById('inspect-choice')`), null, 'preview has no user-facing toggle');
await send('Emulation.setTouchEmulationEnabled', {enabled:true, maxTouchPoints:1});
await tap('[data-choice="1"]');
assert.equal(await evaluate(`state.tokens.length`), 0, 'touching a token previews it rather than selecting it');
assert.ok(await evaluate(`document.querySelector('.origin [data-confirm-choice]')`), 'touched token has a confirm button');
await hover('[data-choice="2"]');
assert.equal(await evaluate(`document.querySelector('.origin a b')?.textContent`), await evaluate(`document.querySelector('[data-choice="2"]').textContent`),
  'mouse hover after touch previews the hovered token');
assert.equal(await evaluate(`document.querySelector('.origin [data-confirm-choice]')`), null, 'mouse hover clears the old touch confirmation');
await tap('[data-choice="1"]');
await evaluate(`document.querySelector('[data-choice="2"]').focus()`);
assert.equal(await evaluate(`document.querySelector('.origin a b')?.textContent`), await evaluate(`document.querySelector('[data-choice="2"]').textContent`),
  'keyboard focus after touch previews the focused token');
assert.equal(await evaluate(`document.querySelector('.origin [data-confirm-choice]')`), null, 'keyboard focus clears the old touch confirmation');
await tap('[data-choice="2"]');
assert.equal(await evaluate(`state.tokens.length`), 0, 'touching another token only changes the preview');
assert.equal(await evaluate(`document.querySelector('.origin [data-confirm-choice]').dataset.confirmChoice`), '2');
await shot('mobile-inspect.png');
await tap('.origin [data-confirm-choice]');
assert.equal(await evaluate(`state.tokens[0]`), await evaluate(`model.begin[2]`), 'confirm selects the touched real-model token');
await evaluate(`document.getElementById('undo').click()`);
await click('[data-choice="3"]');
assert.equal(await evaluate(`state.tokens[0]`), await evaluate(`model.begin[3]`), 'a mouse still chooses immediately on a touch-capable device');
await evaluate(`document.getElementById('undo').click()`);
await send('Emulation.setTouchEmulationEnabled', {enabled:false});
assert.equal(await evaluate(`document.querySelectorAll('[data-choice]').length`), 128);
assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'mobile token page overflow');
await shot('mobile-tokens.png');
await evaluate(`document.querySelector('[data-choice="1"]').focus()`);
assert.equal(await evaluate(`document.querySelector('.origin a b')?.textContent`), await evaluate(`document.querySelector('[data-choice="1"]').textContent`), 'origin highlights the focused token');
assert.ok((await evaluate(`document.querySelectorAll('.origin a').length`)) >= 2, 'origin and language are linked');
await send('Input.dispatchKeyEvent', {type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, text:'\r', unmodifiedText:'\r'});
await send('Input.dispatchKeyEvent', {type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13});
assert.equal(await evaluate(`document.activeElement.id`), 'heading', 'keyboard token choice retains focus');
assert.equal(await evaluate(`document.querySelectorAll('[data-choice]').length`), 32);
assert.ok((await evaluate(`document.getElementById('panel').textContent`)).includes('0000001'), 'last chosen bits are shown');
await shot('mobile-token-origin.png');
await evaluate(`document.querySelector('[data-reason]').open = true; document.querySelector('[data-reason]').scrollIntoView({block:'start'})`);
assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'mobile filter explanations fit the viewport');
await shot('mobile-filter-reasons.png');
await evaluate(`document.getElementById('undo').click()`);
assert.equal(await evaluate(`document.querySelectorAll('[data-choice]').length`), 128);
await evaluate(`document.getElementById('reset').click(); document.querySelector('[data-layout="2"]').click(); document.querySelector('[data-layout="2"]').click(); document.querySelector('[data-layout="2"]').click()`);
await send('Emulation.setTouchEmulationEnabled', {enabled:true, maxTouchPoints:1});
for (let i = 0; i < 10; i++) {
  await tap('[data-choice="0"]');
  assert.equal(await evaluate(`state.tokens.length`), i, `touch ${i + 1} should preview`);
  await tap('.origin [data-confirm-choice]');
  assert.equal(await evaluate(`state.tokens.length`), i + 1, `confirm ${i + 1} should select`);
}
assert.equal(await evaluate(`document.querySelector('.result-phrase').textContent`), vectors[0].phrase,
  'complete touchscreen playthrough matches the shared vector');
await send('Emulation.setTouchEmulationEnabled', {enabled:false});
await evaluate(`document.getElementById('reset').click(); document.querySelector('[data-layout="2"]').click(); document.querySelector('[data-layout="2"]').click()`);
assert.equal(await evaluate(`document.getElementById('stage').dataset.phase`), 'layout');
assert.equal(await evaluate(`document.getElementById('stage').dataset.prefix`), '2,2');
await evaluate(`document.getElementById('random').click()`);
assert.equal(await evaluate(`document.getElementById('stage').dataset.phase`), 'complete');
const random = await evaluate(`({phrase:document.querySelector('.result-phrase').textContent, hex:document.querySelector('.hex').textContent})`);
await evaluate(`document.getElementById('undo').click()`);
assert.equal(await evaluate(`document.getElementById('stage').dataset.prefix`), '2,2');
assert.equal(await evaluate(`document.getElementById('stage').dataset.phase`), 'layout');
const py = spawnSync('python3', ['-c', `import json,sys\nsys.path.insert(0,${JSON.stringify(path.join(here, '../compiler'))})\nimport compile_phrase as p\nm=json.load(open(${JSON.stringify(path.join(here, '../models/phrase-v8.json'))}))\nprint(p.encode(m,int(sys.argv[1],16)))`, random.hex], {encoding:'utf8'});
assert.equal(py.status,0,py.stderr); assert.equal(py.stdout.trim(), random.phrase, 'random output vs Python');
console.log('Random fill matches independent Python encoder; undo restores the partial layout');

await width(320, 780);
const samples = await evaluate(`(() => {
  const out = [];
  for (let i = 0; i < 100; i++) {
    document.getElementById('reset').click(); document.getElementById('random').click();
    out.push({phrase:document.querySelector('.result-phrase').textContent,
      hex:document.querySelector('.hex').textContent,
      overflow:document.documentElement.scrollWidth > innerWidth});
  }
  return out;
})()`);
assert.ok(samples.every(item => !item.overflow), '320px overflow on random phrase');
const oracle = spawnSync('python3', ['-c', `import json,sys\nsys.path.insert(0,${JSON.stringify(path.join(here, '../compiler'))})\nimport compile_phrase as p\nm=json.load(open(${JSON.stringify(path.join(here, '../models/phrase-v8.json'))}))\nfor item in json.load(sys.stdin):\n assert p.encode(m,int(item['hex'],16)) == item['phrase'], item\nprint('100 random games match the Python encoder')`], {input:JSON.stringify(samples), encoding:'utf8'});
assert.equal(oracle.status, 0, oracle.stderr); console.log(oracle.stdout.trim());

await width(1200, 900);
assert.equal(await evaluate(`getComputedStyle(document.getElementById('phrase')).position`), 'static', 'desktop layout does not stick');
await evaluate(`document.getElementById('reset').click()`);
assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'desktop overflow');
await shot('desktop-start.png');
await evaluate(`document.getElementById('random').click()`);
assert.equal(await evaluate(`document.getElementById('count').textContent`), '64');
await shot('desktop-complete.png');
assert.deepEqual(errors, [], 'browser console errors');
console.log('Browser checks passed at 390px and 1200px; no console errors');
ws.close();
