const GridLayout = {
  choose(width, height) {
    // A comfortable square size; reserve exactly one square on either side.
    const preferredCell = width < 600 ? 54 : 64;
    const cols = Math.max(2, Math.floor(width / preferredCell) - 2);
    const cell = Math.min(preferredCell, width / (cols + 2));
    return { cols, rows: Math.max(3, Math.floor(height / cell)) };
  },
  fit(width, height, cols, rows) {
    const cell = Math.min(width / (cols + 2), height / rows);
    return { cell, width: cols * cell, gutter: cell };
  },
};
