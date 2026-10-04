// Browser port of GridManager.FroggyPlacement, ComboRecurssion and Step.
const FrogLogic = {
  minimumCombo: 4, // Unity counts neighbours excluding the starting frog, then checks > 2.
  connections(board) {
    const pairs = new Set();
    for (let row = 0; row < board.length; row++) for (let col = 0; col < board[row].length; col++) {
      const frog = board[row][col];
      if (!frog) continue;
      // Check each bond once, so both ends of a connection don't play two sounds.
      for (const [dr, dc] of [[0, 1], [1, 0]]) if (board[row + dr]?.[col + dc]?.name === frog.name) {
        pairs.add(`${frog.name}:${row},${col}:${row + dr},${col + dc}`);
      }
    }
    return pairs;
  },
  placement(board, row, col) {
    const frog = board[row]?.[col];
    if (!frog) return null;
    const same = (r, c) => board[r]?.[c]?.name === frog.name;
    const mask = (same(row, col + 1) ? 1 : 0) | (same(row, col - 1) ? 2 : 0)
      | (same(row - 1, col) ? 4 : 0) | (same(row + 1, col) ? 8 : 0);
    return ['S', 'R', 'L', 'RL', 'U', 'UR', 'UL', 'RUL', 'D', 'DR', 'DL', 'RLD', 'UD', 'RUD', 'LUD', 'LURD'][mask];
  },
  group(board, row, col) {
    const frog = board[row]?.[col];
    if (!frog) return [];
    const found = [], seen = new Set(), queue = [{ row, col }];
    while (queue.length) {
      const cell = queue.pop(), key = `${cell.row}-${cell.col}`;
      if (seen.has(key) || board[cell.row]?.[cell.col]?.name !== frog.name) continue;
      seen.add(key);
      found.push(cell);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push({ row: cell.row + dr, col: cell.col + dc });
    }
    return found;
  },
  matches(board) {
    const matches = [], seen = new Set();
    for (let row = 0; row < board.length; row++) for (let col = 0; col < board[row].length; col++) {
      if (seen.has(`${row}-${col}`)) continue;
      const group = this.group(board, row, col);
      group.forEach(cell => seen.add(`${cell.row}-${cell.col}`));
      if (group.length >= this.minimumCombo) matches.push(...group);
    }
    return matches;
  },
  gravityStep(board) {
    for (let col = 0; col < board[0].length; col++) for (let row = 0; row < board.length - 1; row++) {
      if (board[row][col] && !board[row + 1][col]) {
        board[row + 1][col] = board[row][col];
        board[row][col] = null;
        return { row: row + 1, col };
      }
    }
    return null;
  },
  comboPoints(board, matches, chain) {
    return matches.reduce((sum, cell) => sum + board[cell.row][cell.col].points, 0) * chain;
  },
  frameAt(clip, elapsed) {
    const time = clip.loop ? elapsed % clip.duration : Math.min(elapsed, clip.duration);
    let frame = clip.frames[0];
    for (const candidate of clip.frames) {
      if (candidate.time > time) break;
      frame = candidate;
    }
    return frame;
  },
};
