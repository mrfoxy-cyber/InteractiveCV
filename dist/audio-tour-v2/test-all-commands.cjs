const assert=require('node:assert/strict');const speech=require('./lib/speech-commands.js');const {Flow}=require('./lib/tour-flow.js');const commands=require('./commands.json').commands;
let recognition;
class Recognizer{constructor(){this.processLocally=false;recognition=this;}static available(){}static install(){}start(track){assert.equal(this.processLocally,true);assert.equal(track.kind,'audio');}abort(){this.aborted=true;}}
const track={kind:'audio',readyState:'live'};
for(const command of commands){
 let result=null;
 speech.watchCommands(Recognizer,{audioTrack:track,commands,onCommand:matched=>result=matched,onError:()=>{},onEnd:()=>{}});
 const event=final=>({resultIndex:0,results:[{isFinal:final,length:1,0:{transcript:command.phrase}}]});
 recognition.onresult(event(false));
 if(command.id!=='stop'){assert.equal(result,null,'Non-Stop interim results wait until the phrase is final');recognition.onresult(event(true));}
 assert.equal(result.command.id,command.id);assert.equal(recognition.aborted,true);
}
let guard,played=[],cancelled=0;
const flow=new Flow({commands,match:speech.match,play:async c=>played.push(c.id),halt:()=>{},state:()=>{},watchCommands:callbacks=>{guard=callbacks;return {cancel:()=>cancelled++};},listen:()=>({cancel(){}})});
(async()=>{
 await flow.choose(commands.find(c=>c.id==='menu'));
 const old=guard;guard.onCommand(speech.match(['projects'],commands));await new Promise(setImmediate);assert.equal(played.at(-1),'projects');assert.ok(cancelled);
 old.onCommand(speech.match(['education'],commands));assert.equal(played.at(-1),'projects');
 guard.onCommand(speech.match(['repeat'],commands));await new Promise(setImmediate);assert.equal(played.at(-1),'projects');
 guard.onCommand(speech.match(['stop'],commands));await new Promise(setImmediate);assert.equal(played.at(-1),'stop');flow.ended();assert.equal(flow.active,false);
 console.log('PASS: all 22 commands accepted during playback, final-phrase gating, interim Stop, interrupted playback, stale-session rejection, repeat and goodbye shutdown');
})();
