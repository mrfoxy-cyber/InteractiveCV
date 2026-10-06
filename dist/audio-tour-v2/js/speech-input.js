/** Manages microphone lifetime and local-only speech sessions, not navigation. */
export class SpeechInput {
  constructor(recognizer, mediaDevices) {
    this.recognizer = recognizer;
    this.microphone = new EchoMicrophone.Input(mediaDevices);
    this.available = false;
    this.enabled = true;
  }

  async check() {
    const availability = await SpeechCommands.availability(this.recognizer);
    this.available = availability === 'available';
    return availability;
  }

  async install() {
    if (!await SpeechCommands.install(this.recognizer)) throw new Error('English pack installation did not complete.');
    return this.check();
  }

  async open() {
    if (!this.enabled) return;
    if (!this.available) throw new Error('Local English speech is unavailable. Prepare English speech or use buttons.');
    return this.microphone.open();
  }

  track() {
    if (!this.enabled || !this.available || !this.microphone.track) throw new Error('Filtered local voice input is not ready.');
    return this.microphone.track;
  }

  watchCommands(callbacks) { return SpeechCommands.watchCommands(this.recognizer, {...callbacks, audioTrack: this.track()}); }
  listen(callbacks) { return SpeechCommands.listen(this.recognizer, {...callbacks, audioTrack: this.track()}); }
  close() { this.microphone.close(); }
}
