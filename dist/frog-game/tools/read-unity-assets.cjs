// Export the serialized Unity references rather than guessing from folder names.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const byGuid = new Map();
for (const file of walk(path.join(root, 'Assets')).filter(file => file.endsWith('.meta'))) {
  const guid = fs.readFileSync(file, 'utf8').match(/^guid: (\w+)/m)?.[1];
  if (guid) byGuid.set(guid, file.slice(0, -5));
}
function read(file) { return fs.readFileSync(file, 'utf8'); }
function resolve(guid) {
  const file = byGuid.get(guid);
  if (!file) throw new Error(`Unresolved Unity GUID: ${guid}`);
  return file;
}
function sprite(guid) {
  const file = resolve(guid);
  const metadata = read(file + '.meta');
  const url = 'assets/unity/' + path.relative(path.join(root, 'Assets'), file).replaceAll('\\', '/');
  const target = path.join(root, 'web', url);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(file, target);
  return { src: url, pixelsPerUnit: Number(metadata.match(/spritePixelsToUnits: ([\d.]+)/)?.[1] || 100) };
}
const controller = read(path.join(root, 'Assets/Prefabs/Grid/FrogController.controller'));
const clips = {};
for (const block of controller.split('--- !u!1102 ').slice(1)) {
  const state = block.match(/m_Name: (\w+)/)?.[1];
  const guid = block.match(/m_Motion: \{fileID: \d+, guid: (\w+)/)?.[1];
  if (!guid) continue;
  const animation = read(resolve(guid));
  const frames = [...animation.matchAll(/- time: ([\d.]+)\s+value: \{fileID: \d+, guid: (\w+)/g)].map(match => ({ time: Number(match[1]), ...sprite(match[2]) }));
  clips[state] = { duration: Number(animation.match(/m_StopTime: ([\d.]+)/)[1]), loop: animation.includes('m_LoopTime: 1'), frames };
}
const slot = read(path.join(root, 'Assets/Prefabs/Grid/GridSlot.prefab'));
const tiles = {};
for (const match of slot.matchAll(/^  (S|R|L|U|D|RL|UL|DL|UD|UR|DR|RUL|RLD|LUD|RUD|LURD): \{fileID: \d+, guid: (\w+)/gm)) tiles[match[1]] = sprite(match[2]);
const frogs = {};
function frogData(guid) {
  const prefab = read(resolve(guid));
  const parent = prefab.match(/m_SourcePrefab: \{fileID: \d+, guid: (\w+)/)?.[1];
  if (parent) {
    const data = frogData(parent);
    for (const match of prefab.matchAll(/propertyPath: (Color\.[rgb]|Points)\s+value: ([\d.]+)/g)) {
      if (match[1] === 'Points') data.points = Number(match[2]);
      else data.color['rgb'.indexOf(match[1].at(-1))] = Number(match[2]);
    }
    return data;
  }
  const color = prefab.match(/^  Color: \{r: ([\d.]+), g: ([\d.]+), b: ([\d.]+), a: ([\d.]+)\}/m);
  return { points: Number(prefab.match(/^  Points: (\d+)/m)[1]), color: color.slice(1, 4).map(Number) };
}
for (const match of slot.matchAll(/^  (\w+)Frog: \{fileID: -?\d+, guid: (\w+)/gm)) {
  const data = frogData(match[2]);
  frogs[match[1]] = { points: data.points, color: data.color.map(value => Math.round(value * 255)) };
}
const cloudAnimation = read(path.join(root, 'Assets/Animations/cloud/cloudeat.anim'));
const cloudEat = {
  duration: Number(cloudAnimation.match(/m_StopTime: ([\d.]+)/)[1]),
  loop: cloudAnimation.includes('m_LoopTime: 1'),
  frames: [...cloudAnimation.matchAll(/- time: ([\d.]+)\s+value: \{fileID: \d+, guid: (\w+)/g)]
    .map(match => ({ time: Number(match[1]), ...sprite(match[2]) })),
};
process.stdout.write(JSON.stringify({ clips, tiles, frogs, cloudEat }));
