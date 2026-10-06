import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {NarrationLibrary} from './js/narration-library.js';
import {TourController} from './js/tour-controller.js';
const require = createRequire(import.meta.url);
globalThis.AudioTourConfig = require('./lib/tour-config.js');
globalThis.SpeechCommands = require('./lib/speech-commands.js');
globalThis.TourFlow = require('./lib/tour-flow.js');

const files = new Map();
files.set('/audio-tour-v2/commands.json', JSON.parse(await readFile(new URL('./commands.json', import.meta.url))));
for (const file of await readdir(new URL('./narrations/', import.meta.url))) {
  if (file.endsWith('.json')) files.set(`/audio-tour-v2/narrations/${file}`, JSON.parse(await readFile(new URL(`./narrations/${file}`, import.meta.url))));
}
let loads = 0;
const library = new NarrationLibrary('https://cv.example/audio-tour-v2/', async url => {
  loads++;
  const value = files.get(decodeURIComponent(url.pathname));
  assert.ok(value, `Missing fixture ${url.pathname}`);
  return value;
});
await library.initialize();
for (const command of library.commands.filter(item => item.file || item.audio)) {
  const narration = await library.get(command);
  assert.equal(narration.audioUrl.origin, 'https://cv.example');
  assert.equal(narration.characterUrl.pathname, '/audio-tour-v2/anchored-character/character.json');
  if (narration.config.mouthTiming) assert.equal(narration.config.mouthTiming.mouthOffsetMs, -30);
}
const before = loads;
await library.get(library.command('menu'));
assert.equal(loads, before, 'Narrations cached');
assert.throws(() => library.asset('https://external.example/audio.mp3'));

let closed = 0, plays = [], chosen = [];
const speech = {enabled: true, available: true, microphone: {track: {}, pending: null}, open: async () => {}, close: () => closed++, watchCommands: () => ({cancel() {}}), listen: () => ({cancel() {}})};
const elements = new Map();
const view = {element: id => { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); }, message() {}, state() {}, showNarration() {}, showChoices() {}};
const player = {halt() {}, play: async narration => plays.push(narration.config.title)};
const controller = new TourController({library, player, view, speech});
controller.ready = true;
controller.flow.commands = library.commands;
await controller.choose(library.command('menu'));
assert.equal(plays.at(-1), 'Welcome');
await controller.choose(library.command('stop'));
assert.equal(plays.at(-1), 'End of tour');
assert.ok(closed > 0, 'Microphone released before goodbye');
controller.flow.ended();
assert.equal(controller.flow.active, false);
speech.enabled = false;
await controller.choose(library.command('projects'));
assert.equal(plays.at(-1), 'Projects menu');
player.onEnded();
assert.equal(controller.flow.active, false, 'Button-only mode must not start recognition');
let release;
speech.enabled = true;
speech.microphone.track = null;
speech.open = () => new Promise(resolve => release = resolve);
const pending = controller.choose(library.command('education'));
controller.cancel();
release();
await pending;
assert.equal(plays.at(-1), 'Projects menu', 'Cancelled permission request must not play a stale choice');
console.log('PASS: all command assets, path isolation, -30ms offsets, JSON cache, goodbye cleanup, button-only mode, stale permission request');
