/** Connects navigation to the view, player and speech input. */
export class TourController {
  constructor({library, player, view, speech}) {
    Object.assign(this, {library, player, view, speech});
    this.request = 0;
    this.ready = false;
    this.flow = new TourFlow.Flow({
      commands: [], match: SpeechCommands.match,
      halt: () => player.halt(),
      state: (kind, value) => this.state(kind, value),
      play: (command, valid) => this.play(command, valid),
      watchCommands: callbacks => speech.enabled && speech.available && speech.microphone.track
        ? speech.watchCommands(callbacks) : null,
      listen: callbacks => speech.listen(callbacks),
    });
    player.onEnded = () => {
      if (!speech.enabled || !speech.available || !speech.microphone.track) {
        this.cancel();
        view.message('tour-status', 'Choose another section with a button. The microphone is off.');
      } else this.flow.ended();
    };
    player.onError = error => { this.cancel(); view.message('tour-status', error.message); };
  }

  async initialize() {
    this.flow.commands = await this.library.initialize();
    this.bindControls();
    const welcome = this.library.command('menu');
    const narration = await this.library.get(welcome);
    await this.player.load(narration);
    this.view.showNarration(narration.config);
    this.view.showChoices(welcome, this.library.commands, command => this.choose(command));
    await this.checkSpeech();
    this.ready = true;
    this.view.element('tour-start').disabled = false;
    this.view.message('tour-status', 'Ready. Start the tour, or choose a section below.');
  }

  async checkSpeech() {
    try {
      const result = await this.speech.check();
      this.view.message('tour-language-status', result === 'available' ? 'English speech is ready on this device.' : `Local English speech: ${result}. Buttons remain available.`);
    } catch (error) { this.view.message('tour-language-status', error.message); }
  }

  async choose(command) {
    if (!this.ready) return;
    const request = ++this.request;
    if (command.id === 'stop') { this.speech.close(); return this.flow.choose(command); }
    if (this.speech.enabled && !this.speech.microphone.track) {
      this.view.element('tour-stop').disabled = false;
      this.view.message('tour-input-status', 'Preparing an echo-cancelled microphone…');
      try {
        await this.speech.open();
        if (request !== this.request) return;
        this.view.message('tour-input-status', 'Microphone echo cancellation enabled. Audio track supplied to local recognition. Headphones can still help.');
      } catch (error) {
        if (request !== this.request || error.name === 'AbortError') return;
        this.view.message('tour-input-status', `${error.message} Continuing with buttons; no unfiltered or online fallback.`);
      }
    }
    if (request === this.request) return this.flow.choose(command);
  }

  async play(command, valid) {
    const narration = await this.library.get(command);
    if (!valid()) return;
    this.view.showNarration(narration.config);
    const choiceContext = ['retry', 'nothing-heard'].includes(command.id) ? this.flow.current : command;
    this.view.showChoices(choiceContext || this.library.command('menu'), this.library.commands, next => this.choose(next));
    await this.player.play(narration, valid);
  }

  state(kind, value) {
    if (['stopped', 'waiting', 'speech-error', 'error'].includes(kind)
        || (kind === 'loading' && value?.terminal)) {
      ++this.request;
      this.speech.close();
    }
    this.view.state(kind, value, this.flow.active, this.speech.enabled && !!this.speech.microphone.track);
  }

  cancel() { ++this.request; this.speech.close(); this.flow.stop(); }

  bindControls() {
    const view = this.view;
    view.element('tour-start').addEventListener('click', () => {
      if (this.flow.active || this.speech.microphone.pending) this.cancel();
      else {
        this.flow.retries = 0;
        this.choose(this.flow.current && !this.flow.current.terminal ? this.flow.current : this.library.command('menu'));
      }
    });
    view.element('tour-stop').addEventListener('click', () => this.choose(this.library.command('stop')));
    view.element('tour-voice').addEventListener('change', event => {
      this.speech.enabled = event.target.checked;
      this.cancel();
      view.message('tour-input-status', this.speech.enabled ? 'Voice commands will start with the tour.' : 'Button-only mode. The microphone is off.');
    });
    view.element('tour-prepare').addEventListener('click', async event => {
      const button = event.target;
      button.disabled = true;
      try {
        view.message('tour-language-status', 'Preparing English speech…');
        await this.speech.install();
        await this.checkSpeech();
      } catch (error) { view.message('tour-language-status', error.message); }
      finally { button.disabled = false; }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.cancel(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') this.cancel(); });
    window.addEventListener('pagehide', () => this.cancel());
  }
}
