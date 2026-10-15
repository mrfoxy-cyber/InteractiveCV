const assert=require('node:assert/strict'),fs=require('node:fs');require('./command-map.js');
const commands=JSON.parse(fs.readFileSync('P:/Marju/dist/audio-tour-v2/commands.json','utf8')).commands,M=MoonshineCommands;
for(const c of commands)assert.equal(M.match(c.phrase,commands)?.id,c.id);
assert.equal(M.match('Please tell me about education.',commands)?.id,'education');
assert.equal(M.match('Skövde',commands)?.id,'skovde');assert.equal(M.match('Tartu',commands)?.id,'tartu');
assert.equal(M.match('do not stop',commands),null);assert.equal(M.match('stop education',commands),null);
assert.equal(M.match('something unrelated',commands),null);assert.equal(M.samples().length,73);
for(const sample of M.samples())assert.ok(fs.existsSync('P:/Marju/dist/voice-tour/audio/commands/'+sample.file));
console.log('PASS: 24 command mappings, aliases, noncommands rejected, all 73 test files exist');
