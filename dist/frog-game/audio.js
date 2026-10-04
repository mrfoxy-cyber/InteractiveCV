// Decode in advance; resume inside the Play gesture so browsers allow the sound.
const frogAudio = (() => {
  const AudioEngine = globalThis.AudioContext || globalThis.webkitAudioContext;
  let context;
  try { if (AudioEngine) context = new AudioEngine(); } catch {}
  const buffers = new Map();
  const sounds = [...document.querySelectorAll('#sound-bank audio')];
  if (context) sounds.forEach(sound => {
    const src = sound.querySelector('source').getAttribute('src');
    buffers.set(sound.id, fetch(src)
      .then(response => { if (!response.ok) throw new Error('Audio unavailable'); return response.arrayBuffer(); })
      .then(bytes => context.decodeAudioData(bytes))
      .then(buffer => {
        // Original exports can have silence before the croak. Start at the sound.
        let first = buffer.length, last = 0;
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const samples = buffer.getChannelData(channel);
          for (let index = 0; index < samples.length; index++) if (Math.abs(samples[index]) > .008) {
            first = Math.min(first, index); last = Math.max(last, index);
          }
        }
        const start = Math.max(0, first / buffer.sampleRate - .015);
        return { buffer, start: first === buffer.length ? 0 : start, duration: Math.max(.05, (last + 1) / buffer.sampleRate - start + .04) };
      }).catch(() => null));
  });
  function fallback(id) {
    const sound = document.querySelector('#' + id);
    if (!sound) return Promise.reject(new Error('Missing sound: ' + id));
    if (!sound.getAttribute('src')) sound.src = sound.querySelector('source').getAttribute('src');
    sound.muted = false;
    sound.volume = 1;
    sound.currentTime = 0;
    return sound.play();
  }
  return {
    play(id, direct = false) {
      if (direct) {
        // Start playback synchronously inside the button's click gesture.
        if (context) context.resume().catch(() => {});
        return fallback(id);
      }
      if (!context || !buffers.has(id)) return fallback(id);
      const resumed = context.resume();
      return Promise.all([resumed, buffers.get(id)]).then(([, clip]) => {
        if (!clip) return fallback(id);
        const source = context.createBufferSource();
        const volume = context.createGain();
        source.buffer = clip.buffer;
        volume.gain.value = .65;
        source.connect(volume);
        volume.connect(context.destination);
        source.start(0, clip.start, Math.min(clip.duration, clip.buffer.duration - clip.start));
      }).catch(() => fallback(id));
    },
  };
})();
