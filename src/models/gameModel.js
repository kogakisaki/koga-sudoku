// src/models/gameModel.js
class GameModel {
  static createNewGame(difficulty = "easy") {
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
      mistakes: 0,
      maxMistakes: 3,
      timer: 0,
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
    return game.solution[row][col] === value;
  }

  static isGameComplete(game) {
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (game.board[i][j] !== game.solution[i][j]) return false;
      }
    }
    return true;
  }

  static shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

module.exports = GameModel;
