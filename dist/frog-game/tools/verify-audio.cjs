const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
async function verify() {
  const events = [];
  const sound = { id: 'sound-frog', getAttribute: () => null, querySelector: () => ({ getAttribute: () => 'frog.mp3' }), play: () => { events.push('fallback'); return Promise.resolve(); } };
  const samples = new Float32Array(1000);
  samples.fill(.5, 400, 600);
  class AudioContext {
    constructor() { this.destination = {}; }
    resume() { events.push('resume'); return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve({ length: 1000, sampleRate: 1000, numberOfChannels: 1, duration: 1, getChannelData: () => samples }); }
    createGain() { return { gain: {}, connect() {} }; }
    createBufferSource() { return { connect() {}, start(...args) { events.push(args); } }; }
  }
  const context = vm.createContext({ AudioContext, document: { querySelectorAll: () => [sound], querySelector: () => sound }, fetch: () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }) });
  const code = fs.readFileSync(path.join(__dirname, '../audio.js'), 'utf8');
  vm.runInContext(code + '\nglobalThis.audio = frogAudio;', context);
  const playing = context.audio.play('sound-frog');
  assert.equal(events[0], 'resume', 'Sound must unlock synchronously in the click gesture');
  await playing;
  assert.ok(Math.abs(events[1][1] - .385) < .001, 'Leading silence should be skipped');
  assert.ok(events[1][2] > .2 && events[1][2] < .3);
  const eventCount = events.length;
  const directPlayback = context.audio.play('sound-frog', true);
  assert.equal(events[eventCount], 'resume');
  assert.equal(events[eventCount + 1], 'fallback', 'Play must start immediately without waiting for decoding');
  await directPlayback;
  const fallbackContext = vm.createContext({ document: { querySelectorAll: () => [sound], querySelector: () => sound } });
  vm.runInContext(code + '\nglobalThis.audio = frogAudio;', fallbackContext);
  await fallbackContext.audio.play('sound-frog');
  assert.equal(events.at(-1), 'fallback');
  assert.equal(sound.volume, 1);
  assert.equal(sound.muted, false);
  console.log('Passed: immediate click activation, decoded playback, leading-silence skipping and fallback audio.');
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
