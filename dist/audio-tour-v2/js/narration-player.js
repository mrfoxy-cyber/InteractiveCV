/** Coordinates audio and anchored character animation, not microphone capture. */
export class NarrationPlayer {
  constructor(audio, canvas, animationToggle) {
    this.audio = audio;
    this.canvas = canvas;
    this.animationToggle = animationToggle;
    this.renderer = null;
    this.config = null;
    this.characterUrl = null;
    this.version = 0;
    this.animationFrame = 0;
    this.cancelLoad = null;
    this.lastFrame = -Infinity;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    animationToggle.checked = !this.reducedMotion.matches;
    audio.addEventListener('play', () => this.animate());
    audio.addEventListener('pause', () => this.resetPose());
    audio.addEventListener('ended', () => { this.resetPose(); this.onEnded?.(); });
    audio.addEventListener('error', () => this.onError?.(new Error('The recording could not play.')));
    animationToggle.addEventListener('change', () => this.frame());
    this.reducedMotion.addEventListener('change', event => {
      if (event.matches) { animationToggle.checked = false; this.frame(); }
    });
  }

  resetPose() {
    cancelAnimationFrame(this.animationFrame);
    this.renderer?.render({});
  }

  halt() {
    ++this.version;
    this.cancelLoad?.();
    this.audio.pause();
    this.resetPose();
  }

  frame() {
    if (!this.renderer || !this.config) return;
    const time = this.audio.currentTime * 1000;
    this.renderer.frame(time, this.config, MouthTimeline.sample(this.config.mouthTiming, time),
      this.animationToggle.checked && !this.audio.ended);
  }

  animate() {
    cancelAnimationFrame(this.animationFrame);
    this.lastFrame = -Infinity;
    const tick = now => {
      if (now - this.lastFrame > 1000 / 30) { this.lastFrame = now; this.frame(); }
      if (!this.audio.paused && !this.audio.ended) this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  async load(narration, valid = () => true) {
    this.halt();
    const version = this.version;
    const current = () => version === this.version && valid();
    if (this.characterUrl !== narration.characterUrl.href) {
      const canvas = document.createElement('canvas');
      canvas.id = 'tour-character';
      canvas.setAttribute('role', 'img');
      const renderer = await AudioTourCharacter.load(canvas, narration.characterUrl);
      if (!current()) return false;
      this.canvas.replaceWith(canvas);
      this.canvas = canvas;
      this.renderer = renderer;
      this.characterUrl = narration.characterUrl.href;
    }
    if (!current()) return false;
    if (narration.config.mouthTiming?.mouthCues.some(cue => !this.renderer.poses.has(cue.pose))) {
      throw new Error('The character is missing a required mouth pose.');
    }
    this.config = narration.config;
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.audio.removeEventListener('loadedmetadata', ready);
        this.audio.removeEventListener('error', failed);
        this.cancelLoad = null;
      };
      const ready = () => {
        cleanup();
        const timing = this.config.mouthTiming;
        if (timing && (!Number.isFinite(this.audio.duration)
            || Math.abs(this.audio.duration * 1000 - timing.durationMs) > 150)) {
          reject(new Error('Recording duration does not match its mouth timing.'));
        } else resolve();
      };
      const failed = () => { cleanup(); reject(new Error('Recording unavailable.')); };
      const timer = setTimeout(failed, 20000);
      this.cancelLoad = () => { cleanup(); resolve(); };
      this.audio.addEventListener('loadedmetadata', ready);
      this.audio.addEventListener('error', failed);
      this.audio.src = narration.audioUrl.href;
      this.audio.load();
    });
    return current();
  }

  async play(narration, valid) {
    if (await this.load(narration, valid)) await this.audio.play();
  }
}
