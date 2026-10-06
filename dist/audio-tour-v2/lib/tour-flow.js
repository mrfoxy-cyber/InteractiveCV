(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TourFlow=factory();})(globalThis,function(){
  'use strict';
  // Every mapped command can interrupt narration; tokens invalidate stale sessions.
  class Flow {
    constructor({play,listen,watchCommands,halt,state,match,commands}){Object.assign(this,{play,listen,watchCommands,halt,state,match,commands});this.token=0;this.active=false;this.current=null;this.history=[];this.capture=null;this.retries=0;this.guardTimer=null;}
    cancelCapture(){clearTimeout(this.guardTimer);this.guardTimer=null;const old=this.capture;this.capture=null;old?.cancel();}
    stop({reset=true}={}){this.active=false;++this.token;this.cancelCapture();this.halt();if(reset){this.current=null;this.history=[];this.retries=0;}this.state('stopped');}
    async choose(command,{remember=true,prompt=false}={}){
      if(command.id==='stop'){if(this.current?.id==='stop'){this.stop();return;}command={...command,terminal:true};this.history=[];}
      if(command.id==='repeat')return this.choose(this.current||this.commands[0],{remember:false});
      if(command.id==='back')return this.choose(this.history.pop()||this.commands[0],{remember:false});
      if(remember&&!prompt&&this.current&&this.current.id!==command.id)this.history.push(this.current);
      if(!prompt)this.current=command;
      this.finishAfterPlayback=!!command.terminal;
      this.active=true;const token=++this.token;this.cancelCapture();this.halt();this.state('loading',command);
      if(!command.terminal)this.guardCommands(token);
      try{await this.play(command,()=>token===this.token);if(token===this.token)this.state('playing',command);}
      catch(error){if(token===this.token){this.stop({reset:false});this.state('error',error);}}
    }
    guardCommands(token){
      if(!this.watchCommands||token!==this.token||!this.active)return;
      try{this.capture=this.watchCommands({
        commands:this.commands,
        onCommand:result=>{if(token===this.token){this.retries=0;this.state('heard',result);this.choose(result.command);}},
        onError:error=>{if(token===this.token){this.capture=null;this.state('commands-unavailable',error);}},
        onEnd:()=>{if(token===this.token&&this.active){this.capture=null;this.guardTimer=setTimeout(()=>this.guardCommands(token),200);}}
      });}catch(error){this.state('commands-unavailable',error.message);}
    }
    ended(){if(!this.active)return;if(this.finishAfterPlayback){this.stop({reset:false});this.state('waiting');return;}this.listenNow();}
    unheard(){this.choose({id:'nothing-heard',file:'nothing-heard.narration.json'},{prompt:true,remember:false});}
    listenNow(){
      if(!this.active)this.active=true;
      const token=++this.token;this.cancelCapture();this.halt();this.state('listening');
      try{this.capture=this.listen({
        onResult:words=>{if(token!==this.token)return;const result=this.match(words,this.commands);this.state('heard',result);if(result.command){this.retries=0;this.choose(result.command);}else if(this.retries++<1){this.choose({id:'retry',file:'not-understood.narration.json'},{prompt:true,remember:false});}else{this.stop();this.state('unmatched');}},
        onError:error=>{if(token!==this.token)return;if(error==='no-speech'||error==='timeout'){this.unheard();}else{this.stop({reset:false});this.state('speech-error',error);}},
        onEnd:()=>{if(token===this.token){this.capture=null;this.unheard();}}
      });}catch(error){this.stop();this.state('error',error);}
    }
  }
  return {Flow};
});
