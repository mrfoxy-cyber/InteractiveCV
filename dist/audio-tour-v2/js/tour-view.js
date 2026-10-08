/** DOM updates live here; command matching and playback remain independent. */
export class TourView {
  constructor(document) { this.document = document; }
  element(id) { return this.document.getElementById(id); }
  message(id, text) { this.element(id).textContent = text; }

  showNarration(config) {
    this.message('tour-title', config.title);
    this.message('tour-transcript', config.transcript);
  }

  showChoices(command, commands, onChoose) {
    const menu = ['education', 'projects', 'languages'].includes(command.id);
    const group = menu ? command.id : command.group === 'controls' ? 'main' : command.group || 'main';
    const choices = commands.filter(item => (item.group === group && item.id !== 'menu')
      || item.group === 'controls' || (group !== 'main' && item.id === 'menu'));
    this.element('tour-choices').replaceChildren(...choices.map(item => {
      const button = this.document.createElement('button');
      button.type = 'button';
      button.textContent = item.phrase;
      button.addEventListener('click', () => onChoose(item));
      return button;
    }));
    this.message('tour-missing', group === 'languages' ? 'Language samples currently play without lip sync.' : '');
  }

  state(kind, value, active, voiceEnabled) {
    this.element('tour-stop').disabled = !active;
    this.message('tour-start-label', active ? 'Pause audio tour' : 'Start audio tour');
    const messages = {
      loading: 'Loading the next narration…',
      playing: value?.terminal ? 'Goodbye! The microphone is off.'
        : voiceEnabled ? 'Listening while narration plays. Say any command to switch, or “stop” to finish.' : 'Narration playing. Use the buttons to choose.',
      listening: 'Listening. Say your choice, then pause.',
      stopped: 'Tour cancelled. The microphone is off.',
      waiting: 'Tour finished. The microphone is off.',
      unmatched: 'No matching choice. Start again, or choose a button.',
    };
    if (kind === 'heard') this.message('tour-heard', `Heard: ${value.transcript}`);
    else if (kind === 'commands-unavailable') this.message('tour-input-status', `Voice commands unavailable: ${value}. Use the choice buttons.`);
    else if (kind === 'error' || kind === 'speech-error') this.message('tour-status', `${value.message || value} Use a choice button to continue.`);
    else if (messages[kind]) this.message('tour-status', messages[kind]);
  }
}
