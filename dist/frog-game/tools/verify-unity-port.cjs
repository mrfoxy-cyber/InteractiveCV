const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'frog-logic.js'), 'utf8') + '\nglobalThis.logic = FrogLogic;', context);
vm.runInContext(fs.readFileSync(path.join(root, 'grid-layout.js'), 'utf8') + '\nglobalThis.layout = GridLayout;', context);
vm.runInContext(fs.readFileSync(path.join(root, 'unity-assets.js'), 'utf8') + '\nglobalThis.assets = UNITY_ASSETS;', context);
const { logic, assets } = context;
for (const [width, height] of [[308,400], [700,500], [1400,650]]) {
  const grid = context.layout.choose(width, height);
  const fit = context.layout.fit(width, height, grid.cols, grid.rows);
  assert.ok(grid.cols >= 2 && grid.rows >= 3);
  assert.ok(fit.width + 2 * fit.gutter <= width + .001);
  assert.ok(fit.cell * grid.rows <= height + .001);
  assert.equal(fit.gutter, fit.cell);
}
assert.ok(context.layout.choose(1400, 650).cols > context.layout.choose(308, 400).cols);
const frog = { name: 'Blue', points: 10 };
const expected = ['S','R','L','RL','U','UR','UL','RUL','D','DR','DL','RLD','UD','RUD','LUD','LURD'];
for (let mask = 0; mask < 16; mask++) {
  const board = Array.from({ length: 3 }, () => Array(3).fill(null));
  board[1][1] = frog;
  [[1,2], [1,0], [0,1], [2,1]].forEach(([r,c], bit) => { if (mask & (1 << bit)) board[r][c] = frog; });
  assert.equal(logic.placement(board, 1, 1), expected[mask]);
  assert.ok(assets.tiles[expected[mask]], `Missing tile for ${expected[mask]}`);
}
assert.equal(logic.matches([[frog, frog, frog]]).length, 0);
assert.equal(logic.matches([[frog, frog, frog, frog]]).length, 4);
assert.equal(logic.matches([[frog, null, null, null], [null, frog, null, null], [null, null, frog, null], [null, null, null, frog]]).length, 0);
const combo = [[frog, frog], [frog, frog]];
assert.equal(logic.comboPoints(combo, logic.matches(combo), 2), 80);
const gravity = [[frog, null], [null, null], [null, null]];
logic.gravityStep(gravity);
assert.equal(gravity[1][0], frog);
assert.equal(gravity[2][0], null);
logic.gravityStep(gravity);
assert.equal(gravity[2][0], frog);
assert.equal(logic.gravityStep(gravity), null);
for (const clip of Object.values(assets.clips)) {
  assert.equal(clip.loop, false);
  assert.ok(clip.frames.length > 10);
  assert.equal(logic.frameAt(clip, 0), clip.frames[0]);
  assert.equal(logic.frameAt(clip, 100), clip.frames.at(-1));
  for (let index = 0; index < clip.frames.length; index++) {
    const frame = clip.frames[index];
    assert.equal(logic.frameAt(clip, frame.time + 0.000001), frame);
    assert.ok(fs.existsSync(path.join(root, frame.src)), frame.src);
  }
}
for (const tile of Object.values(assets.tiles)) assert.ok(fs.existsSync(path.join(root, tile.src)), tile.src);
assert.ok(assets.clips.Up.frames.at(-1).src.includes('/down/'));
assert.ok(assets.clips.Down.frames.at(-1).src.includes('/up/'));
// Exercise the game renderer itself: redraws must preserve animation progress.
let clock = 100;
const drawCalls = [];
const drawContext = { clearRect() {}, drawImage(image, x, y, width, height) { drawCalls.push({ x, y, width, height }); }, fillRect() {} };
function element() {
  return { dataset: {}, style: {}, classList: { add() {}, remove() {} }, children: [],
    replaceChildren() { this.children = []; }, append(child) { this.children.push(child); },
    setAttribute() {}, getAttribute(name) { return this[name]; }, addEventListener() {}, getContext() { return drawContext; } };
}
const elements = new Map();
const playedSounds = [];
Object.assign(context, {
  frogAudio: { play: id => { playedSounds.push(id); return Promise.resolve(); } },
  document: { querySelector(selector) { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); }, querySelectorAll() { return []; }, createElement: element },
  Image: class {
    constructor() { this.complete = true; }
    set src(value) {
      const bytes = fs.readFileSync(path.join(root, value));
      this.naturalWidth = bytes.readUInt32BE(16);
      this.naturalHeight = bytes.readUInt32BE(20);
    }
  },
  performance: { now: () => clock },
  localStorage: { getItem: () => 0, setItem() {} },
  requestAnimationFrame() {},
});
vm.runInContext(fs.readFileSync(path.join(root, 'score-store.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'game.js'), 'utf8'), context);
vm.runInContext('board[7][0] = FROGS[0]; board[7][1] = FROGS[0]; renderBoard();', context);
assert.equal(playedSounds.filter(id => id.startsWith('sound-connect-')).length, 1);
assert.equal(vm.runInContext('animationStates.get("7-0").clip === UNITY_ASSETS.clips.Right', context), true);
assert.equal(vm.runInContext('animationStates.get("7-0").canvas.width', context), 600);
const started = vm.runInContext('animationStates.get("7-0").started', context);
clock += 300;
vm.runInContext('renderBoard();', context);
assert.equal(playedSounds.filter(id => id.startsWith('sound-connect-')).length, 1, 'Redrawing existing connections must not replay sound');
assert.equal(vm.runInContext('animationStates.get("7-0").started', context), started);
assert.ok(drawCalls.every(call => call.x >= 0 && call.y >= 0 && call.x + call.width <= 600 && call.y + call.height <= 600), 'Original animation frames must fit without clipping');
vm.runInContext('board[6][0] = FROGS[0]; renderBoard();', context);
assert.equal(playedSounds.filter(id => id.startsWith('sound-connect-')).length, 2);
assert.equal(vm.runInContext('animationStates.get("7-0").tile.src', context), assets.tiles.UR.src);
assert.equal(vm.runInContext('animationStates.get("7-0").started', context), clock);
vm.runInContext('renderBoard(null, [{row:7,col:0}]);', context);
assert.equal(vm.runInContext('animationStates.get("7-0").clip === UNITY_ASSETS.clips.explodingfrogs', context), true);
console.log('Passed: all 16 tile placements, Unity combo/scoring/gravity rules, exact frame timing, controller directions, and sprite files.');
console.log('Passed: game initialization, connection clips, persistent animation progress, changed connections and explosion rendering.');
// Award a real combo through the game flow, then save it exactly once.
context.setTimeout = callback => callback();
context.frogAudio = { play: () => Promise.resolve() };
vm.runInContext('resetGame(); board[7][0] = board[7][1] = board[7][2] = board[7][3] = FROGS[0];', context);
vm.runInContext('clearMatches()', context).then(async () => {
  assert.equal(vm.runInContext('score', context), 40);
  assert.equal(elements.get('#score').textContent, '40');
  assert.equal(vm.runInContext('ScoreStore.best()', context), 40);
  assert.equal(vm.runInContext('ScoreStore.bestCombo()', context), 40);
  assert.equal(elements.get('#combo').textContent, '40');
  assert.equal(vm.runInContext('board[7].filter(Boolean).length', context), 0);
  vm.runInContext('saveRun(); saveRun(); resetGame();', context);
  assert.equal(vm.runInContext('ScoreStore.history().length', context), 1);
  assert.equal(vm.runInContext('ScoreStore.history()[0].points', context), 40);
  assert.equal(vm.runInContext('score', context), 0);
  assert.equal(elements.get('#combo').textContent, '40', 'Top combo persists after starting another game');
  assert.equal(vm.runInContext('ScoreStore.best()', context), 40);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(!/<video[^>]*autoplay/.test(html), 'Intro video must wait for the button');
  assert.ok(html.includes('id="intro-video-panel" class="intro-video-panel" hidden'));
  // Fit the actual layout function to desktop, portrait and short landscape screens.
  const stageStyle = elements.get('#board-stage').style;
  stageStyle.setProperty = (key, value) => { stageStyle[key] = value; };
  elements.get('.game-shell').hidden = false;
  context.window = { innerHeight: 900 };
  elements.set('.game-header', { offsetHeight: 60 });
  elements.set('.actions', { offsetHeight: 44 });
  elements.set('.cloud-lane', { offsetHeight: 96 });
  elements.set('.game-card', { clientWidth: 1000 });
  elements.get('#message').offsetHeight = 24;
  elements.get('#score-breakdown').offsetHeight = 32;
  for (const [width, height] of [[1000,900], [320,700], [800,400]]) {
    elements.get('.game-card').clientWidth = width;
    context.window.innerHeight = height;
    vm.runInContext('fitBoard()', context);
    const actualWidth = parseFloat(stageStyle['--board-width']);
    assert.ok(actualWidth <= width - 12);
    assert.ok(actualWidth * 8 / 7 <= height - 60 - 44 - 96 - 24 - 32 - 60 + .001);
  }
  console.log('Passed: actual combo awards 40 points, HUD updates, finished scores save once, best survives reset, video starts only by request.');
  console.log('Passed: board fits desktop, mobile portrait and short landscape viewports with square cells.');
  const fallingStyle = elements.get('#falling-frog').style;
  for (const frame of assets.cloudEat.frames) assert.ok(fs.existsSync(path.join(root, frame.src)), frame.src);
  vm.runInContext('cloudAnimation = { started: performance.now() };', context);
  vm.runInContext('paintCloud(performance.now() + 250);', context);
  assert.equal(elements.get('#evil-cloud').src, assets.cloudEat.frames[3].src);
  vm.runInContext('cloudAnimation = null;', context);
  fallingStyle.setProperty = (key, value) => { fallingStyle[key] = value; };
  elements.get('#board-stage').getBoundingClientRect = () => ({ top: 100 });
  elements.get('#evil-cloud').getBoundingClientRect = () => ({ top: 110, height: 60 });
  elements.get('#board').children[7 * 7].getBoundingClientRect = () => ({ top: 320, width: 50, height: 50 });
  await vm.runInContext('animateCloudDrop(7, 0, FROGS[0])', context);
  assert.equal(elements.get('#evil-cloud').src, 'assets/evil-cloud.png');
  assert.equal(vm.runInContext('cloudAnimation', context), null);
  assert.ok(Math.abs(parseFloat(elements.get('#cloud-carrier').style.left) - 100 * .5 / 7) < .000001);
  assert.equal(fallingStyle.top, '46px');
  assert.equal(fallingStyle['--fall-distance'], '174px');
  const counts = [];
  for (const [width, height] of [[320,700], [1400,900]]) {
    elements.get('.game-card').clientWidth = width;
    context.window.innerHeight = height;
    vm.runInContext('resetGame()', context);
    counts.push(vm.runInContext('COLS', context));
    assert.equal(elements.get('#board').children.length, vm.runInContext('COLS * ROWS', context));
  }
  assert.ok(counts[1] > counts[0]);
  console.log('Passed: device-specific grid counts, one-column gutters, cloud-carried preview and measured release/landing positions.');
}).catch(error => { console.error(error); process.exitCode = 1; });
