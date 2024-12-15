// script.js - Part 1: Core Game Class and Initialization

class SudokuGame {
  constructor() {
    // Game state properties
    this.gameId = null;
    this.currentScreen = "welcome";
    this.gameData = null;
    this.selectedCell = null;
    this.timerInterval = null;
    this.isPaused = false;

    // Initialize game
    this.initializeEventListeners();
    this.loadTheme();
  }

  // Screen Management
  showScreen(screenName) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });
    document.getElementById(`${screenName}Screen`).classList.add("active");
    this.currentScreen = screenName;
  }

  // Game Initialization
  async startNewGame(difficulty) {
    try {
      const response = await fetch("/api/games/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty }),
      });

      if (!response.ok) throw new Error("Failed to create new game");

      const data = await response.json();
      this.gameId = data.gameId;
      this.gameData = data.game;

      this.showScreen("game");
      this.createBoard();
      this.startTimer();
      this.updateStats();
      this.updateDifficultyBadge(difficulty);
      this.showGameId();
    } catch (error) {
      console.error("Error starting new game:", error);
      alert("Failed to start new game. Please try again.");
    }
  }

  async loadGame(gameId) {
    try {
      const response = await fetch(`/api/games/${gameId}`);
      if (!response.ok) throw new Error("Game not found");

      const data = await response.json();
      this.gameId = gameId;
      this.gameData = data;

      this.showScreen("game");
      this.createBoard();
      this.startTimer();
      this.updateStats();
      this.updateDifficultyBadge(data.difficulty);
      this.showGameId();
    } catch (error) {
      console.error("Error loading game:", error);
      alert("Failed to load game. Please check the Game ID and try again.");
    }
  }

  // Board Creation and Management
  createBoard() {
    const board = document.getElementById("board");
    board.innerHTML = "";

    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        const cell = document.createElement("div");
        cell.className = "cell";

        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 1;
        input.dataset.row = i;
        input.dataset.col = j;

        const value = this.gameData.board[i][j];
        if (value !== 0) {
          input.value = value;
          input.disabled = true;
          input.classList.add("initial");
        }

        cell.appendChild(input);
        board.appendChild(cell);
      }
    }

    // Add input event listeners after creating the board
    this.addCellListeners();
  }

  addCellListeners() {
    document.querySelectorAll(".cell input").forEach((input) => {
      input.addEventListener("focus", (e) => this.handleCellFocus(e));
      input.addEventListener("blur", (e) => this.handleCellBlur(e));
      input.addEventListener("input", (e) => this.handleCellInput(e));
    });
  }

  initializeEventListeners() {
    // Welcome Screen
    document.getElementById("newGameBtn").addEventListener("click", () => {
      this.showScreen("difficulty");
    });

    document.getElementById("loadGameBtn").addEventListener("click", () => {
      const gameId = document.getElementById("gameIdInput").value.trim();
      if (gameId) this.loadGame(gameId);
    });

    // Game ID Input
    document.getElementById("gameIdInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const gameId = e.target.value.trim();
        if (gameId) this.loadGame(gameId);
      }
    });

    // Difficulty Selection
    document
      .querySelectorAll(".difficulty-buttons button")
      .forEach((button) => {
        button.addEventListener("click", () =>
          this.startNewGame(button.dataset.difficulty)
        );
      });

    // Game Controls
    document
      .getElementById("retryBtn")
      .addEventListener("click", () => this.retryGame());
    document
      .getElementById("mainMenuBtn")
      .addEventListener("click", () => this.returnToMainMenu());
    document
      .getElementById("validateBtn")
      .addEventListener("click", () => this.validateGame());
    document
      .getElementById("downloadBtn")
      .addEventListener("click", () => this.downloadBoard());

    // Theme Toggle
    document
      .querySelectorAll("#themeToggle, #themeToggleGame")
      .forEach((button) => {
        button.addEventListener("click", () => this.toggleTheme());
      });

    // Number Pad
    document.querySelectorAll(".num-btn").forEach((button) => {
      button.addEventListener("click", () => {
        if (!this.selectedCell || this.isPaused || this.selectedCell.disabled)
          return;

        const number = button.dataset.number;
        if (number === "0") {
          // Eraser functionality
          this.selectedCell.value = "";
          const row = parseInt(this.selectedCell.dataset.row);
          const col = parseInt(this.selectedCell.dataset.col);
          this.gameData.board[row][col] = 0;
          this.selectedCell.classList.remove("error", "correct");
        } else {
          this.makeMove(this.selectedCell, number);
        }
      });
    });

    // Keyboard Input
    document.addEventListener("keydown", (e) => this.handleKeyPress(e));

    // Back Buttons
    document.querySelectorAll(".btn-back").forEach((button) => {
      button.addEventListener("click", () => this.showScreen("welcome"));
    });
  }

  showGameId() {
    const gameIdDisplay = document.getElementById("gameId");
    if (gameIdDisplay) {
      gameIdDisplay.textContent = this.gameId;
    }
  }

  updateDifficultyBadge(difficulty) {
    const badge = document.getElementById("difficultyBadge");
    if (badge) {
      badge.textContent =
        difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
      badge.className = `badge ${difficulty}`;
    }
  }

  handleCellFocus(e) {
    if (this.isPaused || e.target.disabled) return;

    this.selectedCell = e.target;
    this.highlightRelatedCells(e.target);

    // Visual feedback for selected cell
    document.querySelectorAll(".cell").forEach((cell) => {
      cell.classList.remove("selected");
    });
    e.target.parentElement.classList.add("selected");
  }

  handleCellBlur(e) {
    e.target.parentElement.classList.remove("selected");
    this.removeHighlight();
  }

  handleCellInput(e) {
    if (this.isPaused || e.target.disabled) return;

    const value = e.target.value;
    if (value && !/^[1-9]$/.test(value)) {
      e.target.value = "";
    } else if (value) {
      this.makeMove(e.target, value);
    }
  }

  handleKeyPress(e) {
    if (!this.selectedCell || this.isPaused || this.selectedCell.disabled)
      return;

    if (/^[1-9]$/.test(e.key)) {
      this.makeMove(this.selectedCell, e.key);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      this.selectedCell.value = "";
      const row = parseInt(this.selectedCell.dataset.row);
      const col = parseInt(this.selectedCell.dataset.col);
      this.gameData.board[row][col] = 0;
      this.selectedCell.classList.remove("error", "correct");
    } else if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
    ) {
      e.preventDefault();
      this.moveFocus(e.key);
    }
  }

  // Cell Navigation
  moveFocus(direction) {
    if (!this.selectedCell) return;

    const row = parseInt(this.selectedCell.dataset.row);
    const col = parseInt(this.selectedCell.dataset.col);
    let newRow = row;
    let newCol = col;

    switch (direction) {
      case "ArrowUp":
        newRow = Math.max(0, row - 1);
        break;
      case "ArrowDown":
        newRow = Math.min(8, row + 1);
        break;
      case "ArrowLeft":
        newCol = Math.max(0, col - 1);
        break;
      case "ArrowRight":
        newCol = Math.min(8, col + 1);
        break;
    }

    const nextCell = document.querySelector(
      `input[data-row="${newRow}"][data-col="${newCol}"]`
    );
    if (nextCell) nextCell.focus();
  }

  // Cell Highlighting
  highlightRelatedCells(cell) {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const value = cell.value;

    document.querySelectorAll(".cell input").forEach((input) => {
      const inputRow = parseInt(input.dataset.row);
      const inputCol = parseInt(input.dataset.col);
      const cellDiv = input.parentElement;

      // Highlight same row, column, and 3x3 box
      if (
        inputRow === row ||
        inputCol === col ||
        (Math.floor(inputRow / 3) === Math.floor(row / 3) &&
          Math.floor(inputCol / 3) === Math.floor(col / 3))
      ) {
        cellDiv.classList.add("highlighted");
      }

      // Highlight same numbers
      if (value && input.value === value) {
        cellDiv.classList.add("highlighted");
      }
    });
  }

  removeHighlight() {
    document.querySelectorAll(".cell").forEach((cell) => {
      cell.classList.remove("highlighted");
    });
  }

  // Game Moves
  async makeMove(cell, value) {
    if (!this.gameId || cell.disabled || this.isPaused) return;

    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const numValue = parseInt(value);

    try {
      const response = await fetch(`/api/games/${this.gameId}/move`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ row, col, value: numValue }),
      });

      if (!response.ok) throw new Error("Failed to make move");

      const data = await response.json();

      if (data.isValid) {
        cell.value = value;
        cell.classList.remove("error");
        cell.classList.add("correct");
        this.gameData.board[row][col] = numValue;

        if (data.isComplete) {
          this.handleGameWin();
        }
      } else {
        cell.classList.add("error");
        cell.classList.remove("correct");
        this.handleMistake();
        setTimeout(() => {
          cell.classList.remove("error");
          cell.value = "";
          this.gameData.board[row][col] = 0;
        }, 1000);
      }
    } catch (error) {
      console.error("Error making move:", error);
      alert("Failed to make move");
    }
  }

  async validateGame() {
    if (!this.gameId || this.isPaused) return;

    const incompleteCells = document.querySelectorAll(
      ".cell input:not([disabled]):not([value])"
    );
    if (incompleteCells.length > 0) {
      alert("Please fill in all cells before validating");
      return;
    }

    let isValid = true;
    document.querySelectorAll(".cell input").forEach((input) => {
      if (!input.disabled) {
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);
        if (parseInt(input.value) !== this.gameData.solution[row][col]) {
          isValid = false;
          input.classList.add("error");
        } else {
          input.classList.add("correct");
        }
      }
    });

    if (isValid) {
      alert("Congratulations! All entries are correct!");
    } else {
      alert("There are some mistakes. Keep trying!");
      setTimeout(() => {
        document.querySelectorAll(".cell input.error").forEach((input) => {
          input.classList.remove("error");
        });
      }, 2000);
    }
  }

  async retryGame() {
    if (!this.gameId) return;

    try {
      const response = await fetch(`/api/games/${this.gameId}/retry`, {
        method: "PUT",
      });

      if (!response.ok) throw new Error("Failed to retry game");

      const data = await response.json();
      this.gameData = data;

      this.createBoard();
      this.startTimer();
      this.updateStats();
    } catch (error) {
      console.error("Error retrying game:", error);
      alert("Failed to retry game");
    }
  }

  handleMistake() {
    this.gameData.mistakes++;
    this.updateStats();

    if (this.gameData.mistakes >= this.gameData.maxMistakes) {
      this.handleGameOver();
    }
  }

  updateStats() {
    if (!this.gameData) return;
    document.getElementById(
      "mistakes"
    ).textContent = `${this.gameData.mistakes}/${this.gameData.maxMistakes}`;
  }

  // Timer Management
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const startTime = Date.now() - (this.gameData.timer || 0) * 1000;
    const timerDisplay = document.getElementById("timer");

    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60)
          .toString()
          .padStart(2, "0");
        const seconds = (elapsed % 60).toString().padStart(2, "0");
        timerDisplay.textContent = `${minutes}:${seconds}`;
        this.gameData.timer = elapsed;
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Game Completion Handlers
  handleGameOver() {
    this.stopTimer();
    this.isPaused = true;
    document.getElementById("gameOverModal").classList.add("active");
  }

  handleGameWin() {
    this.stopTimer();
    this.isPaused = true;

    const minutes = Math.floor(this.gameData.timer / 60);
    const seconds = this.gameData.timer % 60;

    document.getElementById(
      "finalTime"
    ).textContent = `${minutes}m ${seconds}s`;
    document.getElementById("finalMistakes").textContent =
      this.gameData.mistakes;

    document.getElementById("victoryModal").classList.add("active");
  }

  // Navigation
  returnToMainMenu() {
    this.stopTimer();
    this.gameId = null;
    this.gameData = null;
    this.selectedCell = null;
    document.getElementById("gameIdInput").value = "";
    this.showScreen("welcome");
  }

  // Board Download
  async downloadBoard() {
    if (!this.gameId) return;

    try {
      const theme = document.body.getAttribute("data-theme") || "light";
      const response = await fetch(
        `/api/games/${this.gameId}/image?theme=${theme}`
      );

      if (!response.ok) throw new Error("Failed to download board");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sudoku_${this.gameId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading board:", error);
      alert("Failed to download board");
    }
  }

  // Theme Management
  toggleTheme() {
    const body = document.body;
    const icons = document.querySelectorAll(
      "#themeToggle i, #themeToggleGame i"
    );

    if (body.getAttribute("data-theme") === "dark") {
      body.removeAttribute("data-theme");
      icons.forEach((icon) => (icon.className = "fas fa-moon"));
      localStorage.setItem("theme", "light");
    } else {
      body.setAttribute("data-theme", "dark");
      icons.forEach((icon) => (icon.className = "fas fa-sun"));
      localStorage.setItem("theme", "dark");
    }
  }

  loadTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.body.setAttribute("data-theme", "dark");
      document
        .querySelectorAll("#themeToggle i, #themeToggleGame i")
        .forEach((icon) => (icon.className = "fas fa-sun"));
    }
  }

  // Modal Management
  hideModals() {
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.classList.remove("active");
    });
  }
}

const game = new SudokuGame();

// Service Worker Registration (Optional)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.error("ServiceWorker registration failed:", error);
    });
  });
}