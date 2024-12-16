// src/models/gameModel.js
class GameModel {
  static createNewGame(difficulty = "easy", mistakeChecking = true) {
    const difficulties = {
      easy: { cellsToRemove: 30, hintsAllowed: 5 },
      medium: { cellsToRemove: 40, hintsAllowed: 3 },
      hard: { cellsToRemove: 50, hintsAllowed: 1 },
    };

    const solution = this.generateSudoku();
    const board = this.createGameBoard(
      solution,
      difficulties[difficulty].cellsToRemove
    );

    return {
      difficulty,
      board,
      solution,
      status: "active",
      hintsRemaining: difficulties[difficulty].hintsAllowed,
      mistakes: mistakeChecking ? 0 : null,
      maxMistakes: mistakeChecking ? 3 : null,
      timer: 0,
      userValues: [],
      mistakeChecking,
    };
  }

  static generateSudoku() {
    const board = Array(9)
      .fill()
      .map(() => Array(9).fill(0));
    this.solveSudoku(board);
    return board;
  }

  static solveSudoku(board) {
    const emptyCell = this.findEmptyCell(board);
    if (!emptyCell) return true;

    const [row, col] = emptyCell;
    const nums = this.shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    for (const num of nums) {
      if (this.isValid(board, row, col, num)) {
        board[row][col] = num;
        if (this.solveSudoku(board)) return true;
        board[row][col] = 0;
      }
    }

    return false;
  }

  static createGameBoard(solution, cellsToRemove) {
    const board = solution.map((row) => [...row]);
    const positions = this.shuffleArray([...Array(81)].map((_, i) => i));

    for (let i = 0; i < cellsToRemove; i++) {
      const pos = positions[i];
      const row = Math.floor(pos / 9);
      const col = pos % 9;
      board[row][col] = 0;
    }

    return board;
  }

  static findEmptyCell(board) {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] === 0) return [row, col];
      }
    }
    return null;
  }

  static isValid(board, row, col, num) {
    // Check row
    for (let x = 0; x < 9; x++) {
      if (board[row][x] === num) return false;
    }

    // Check column
    for (let x = 0; x < 9; x++) {
      if (board[x][col] === num) return false;
    }

    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (board[boxRow + i][boxCol + j] === num) return false;
      }
    }

    return true;
  }

  static validateMove(game, row, col, value) {
    if (value === 0) return true; // Allow deletion
    if (!game.mistakeChecking) return true; // Always return true if mistake checking is disabled
    if (game.status === "failed") return false; // Don't allow moves if game is failed
    if (game.mistakes >= game.maxMistakes) return false; // Don't allow moves if max mistakes reached
    return game.solution[row][col] === value;
  }

  static isGameComplete(game) {
    // Don't check completion if game is failed
    if (game.status === "failed") return false;

    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (game.board[i][j] !== game.solution[i][j]) return false;
      }
    }
    return true;
  }

  static isGameFailed(game) {
    return game.mistakeChecking && game.mistakes >= game.maxMistakes;
  }

  static shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  static isUserValue(game, row, col) {
    return game.userValues?.some((v) => v.row === row && v.col === col);
  }

  static addUserValue(game, row, col) {
    if (!game.userValues) {
      game.userValues = [];
    }
    if (!this.isUserValue(game, row, col)) {
      game.userValues.push({ row, col });
    }
  }

  static removeUserValue(game, row, col) {
    if (!game.userValues) return;

    const index = game.userValues.findIndex(
      (v) => v.row === row && v.col === col
    );

    if (index !== -1) {
      game.userValues.splice(index, 1);
    }
  }

  static validateBoard(game) {
    const validation = [];
    let isComplete = true;

    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        const currentValue = game.board[i][j];
        const correctValue = game.solution[i][j];

        // Only validate cells that are either empty or filled by user
        if (this.isUserValue(game, i, j) || currentValue === 0) {
          validation.push({
            row: i,
            col: j,
            isEmpty: currentValue === 0,
            isValid: currentValue === correctValue,
          });

          if (currentValue !== correctValue) {
            isComplete = false;
          }
        }
      }
    }

    return {
      validation,
      isComplete,
      isFailed: this.isGameFailed(game),
    };
  }

  static canMakeMove(game) {
    return (
      game.status !== "failed" &&
      game.status !== "completed" &&
      (!game.mistakeChecking || game.mistakes < game.maxMistakes)
    );
  }
}

module.exports = GameModel;
