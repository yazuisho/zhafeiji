const {
  GRID_SIZE, PLANE_COUNT, PLANE_ALL_OFFSETS,
  CELL_EMPTY, CELL_PLANE, CELL_HIT, CELL_MISS,
} = require('./constants');

function createEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(CELL_EMPTY));
}

function getPlaneCells(row, col, rotation) {
  return PLANE_ALL_OFFSETS[rotation].map(([dx, dy]) => ({ row: row + dy, col: col + dx }));
}

function canPlace(grid, row, col, rotation) {
  const cells = getPlaneCells(row, col, rotation);
  return cells.every(({ row: r, col: c }) =>
    r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && grid[r][c] === CELL_EMPTY
  );
}

function placePlane(grid, row, col, rotation) {
  const cells = getPlaneCells(row, col, rotation);
  cells.forEach(({ row: r, col: c }) => { grid[r][c] = CELL_PLANE; });
  return cells;
}

function removePlane(grid, row, col, rotation) {
  const cells = getPlaneCells(row, col, rotation);
  cells.forEach(({ row: r, col: c }) => { grid[r][c] = CELL_EMPTY; });
  return cells;
}

function processAttack(grid, row, col) {
  if (grid[row][col] === CELL_PLANE) {
    grid[row][col] = CELL_HIT;
    return { hit: true };
  }
  if (grid[row][col] === CELL_EMPTY) {
    grid[row][col] = CELL_MISS;
  }
  return { hit: false };
}

function checkPlaneDestroyed(grid, planeCells) {
  return planeCells.every(({ row: r, col: c }) => grid[r][c] === CELL_HIT);
}

function checkAllPlanesDestroyed(grid, placedPlanes) {
  return placedPlanes.every(p => checkPlaneDestroyed(grid, p.cells));
}

function checkWin(myGrid, opponentPlacedPlanes) {
  return checkAllPlanesDestroyed(myGrid, opponentPlacedPlanes);
}

module.exports = {
  createEmptyGrid, getPlaneCells, canPlace,
  placePlane, removePlane, processAttack,
  checkPlaneDestroyed, checkAllPlanesDestroyed, checkWin,
};
