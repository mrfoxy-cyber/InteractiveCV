/** Owns portable JSON contracts and resolves every asset against its JSON file. */
export class NarrationLibrary {
  constructor(baseUrl, fetchJson = NarrationLibrary.fetchJson) {
    this.baseUrl = new URL(baseUrl);
    this.fetchJson = fetchJson;
    this.cache = new Map();
    this.commands = [];
  }

  static async fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url.pathname}.`);
    return response.json();
  }

  asset(path, base = this.baseUrl) {
    AudioTourConfig.path(path);
    const url = new URL(path, base);
    if (url.origin !== this.baseUrl.origin) throw new Error('Tour assets must stay on this website.');
    return url;
  }

  async initialize() {
    const [mapping, catalogue] = await Promise.all([
      this.fetchJson(this.asset('commands.json')),
      this.fetchJson(this.asset('narrations/catalogue.json')),
    ]);
    if (mapping.schemaVersion !== 1 || !Array.isArray(mapping.commands)
        || catalogue.schemaVersion !== 1 || !Array.isArray(catalogue.narrations)) {
      throw new Error('Invalid audio-tour catalogue.');
    }
    const ids = new Set();
    for (const command of mapping.commands) {
      if (!command.id || !command.phrase || ids.has(command.id)) throw new Error('Invalid or duplicate command.');
      ids.add(command.id);
      if (command.file && (!/^[^/\\]+\.narration\.json$/u.test(command.file)
          || !catalogue.narrations.some(item => item.file === command.file))) {
        throw new Error(`Missing narration for ${command.phrase}.`);
      }
      if (command.audio) this.asset(command.audio);
    }
    this.commands = mapping.commands;
    return this.commands;
  }

  command(id) {
    return this.commands.find(command => command.id === id);
  }

  async get(command) {
    const key = command.file || command.audio;
    if (this.cache.has(key)) return this.cache.get(key);
    let config, base;
    if (command.audio) {
      base = this.baseUrl;
      config = {
        schemaVersion: 1, kind: 'audio-tour-narration', title: command.phrase,
        character: 'anchored-character/character.json', audio: {src: command.audio},
        transcript: `Original ${command.phrase} recording. A transcript and mouth timing have not been added yet.`,
        mouthTiming: null,
        animations: {
          blink: {enabled: true, cycleMs: 4800, closeMs: 70, holdMs: 60, openMs: 100},
          hair: {enabled: true, cycleMs: 7200},
        },
      };
    } else {
      base = this.asset(`narrations/${encodeURIComponent(command.file)}`);
      config = await this.fetchJson(base);
    }
    AudioTourConfig.validate(config);
    const narration = {config, characterUrl: this.asset(config.character, base), audioUrl: this.asset(config.audio.src, base)};
    this.cache.set(key, narration);
    return narration;
  }
}
