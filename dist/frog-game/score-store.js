// Local scores continue to work when browser storage is disabled.
const ScoreStore = (() => {
  let best = 0, bestCombo = 0, history = [];
  try {
    best = Math.max(0, Number(localStorage.getItem('froggame-best')) || 0);
    bestCombo = Math.max(0, Number(localStorage.getItem('froggame-best-combo')) || 0);
    const saved = JSON.parse(localStorage.getItem('froggame-scores') || '[]');
    if (Array.isArray(saved)) history = saved.filter(entry => Number.isFinite(entry.points) && entry.points > 0).slice(0, 10);
  } catch {}
  function persist() {
    try {
      localStorage.setItem('froggame-best', String(best));
      localStorage.setItem('froggame-best-combo', String(bestCombo));
      localStorage.setItem('froggame-scores', JSON.stringify(history));
    } catch {}
  }
  return {
    best() { return best; },
    bestCombo() { return bestCombo; },
    updateCombo(points) { bestCombo = Math.max(bestCombo, points); persist(); return bestCombo; },
    history() { return history.slice(); },
    update(points) { best = Math.max(best, points); persist(); return best; },
    finish(points) {
      if (points <= 0) return;
      best = Math.max(best, points);
      history.push({ points, date: new Date().toISOString() });
      history.sort((a, b) => b.points - a.points);
      history = history.slice(0, 10);
      persist();
    },
  };
})();
