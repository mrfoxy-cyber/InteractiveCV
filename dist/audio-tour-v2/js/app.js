import {NarrationLibrary} from './narration-library.js';
import {NarrationPlayer} from './narration-player.js';
import {TourView} from './tour-view.js';
import {SpeechInput} from './speech-input.js';
import {TourController} from './tour-controller.js';

const view = new TourView(document);
const tour = new TourController({
  view,
  library: new NarrationLibrary(new URL('../', import.meta.url)),
  player: new NarrationPlayer(view.element('tour-audio'), view.element('tour-character'), view.element('tour-animate')),
  speech: new SpeechInput(window.SpeechRecognition || window.webkitSpeechRecognition, navigator.mediaDevices),
});

tour.initialize().catch(error => view.message('tour-status', `Could not prepare the tour: ${error.message}`));
