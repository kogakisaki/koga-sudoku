// script.js
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
  async startNewGame(difficulty, mistakeChecking = true) {
    try {
      const response = await fetch("/api/games/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty, mistakeChecking }),
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

      // Show or hide mistake elements based on mistake checking
      const mistakeContainer = document.getElementById("mistakeContainer");
      const validateBtn = document.getElementById("validateBtn");

      if (!mistakeChecking) {
        mistakeContainer.style.display = "none";
        validateBtn.style.display = "block";
      } else {
        mistakeContainer.style.display = "flex";
        validateBtn.style.display = "none";
      }
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

      // Show or hide mistake elements based on mistake checking
      const mistakeContainer = document.getElementById("mistakeContainer");
      const validateBtn = document.getElementById("validateBtn");

      if (!data.mistakeChecking) {
        mistakeContainer.style.display = "none";
        validateBtn.style.display = "block";
      } else {
        mistakeContainer.style.display = "flex";
        validateBtn.style.display = "none";
      }
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
          if (!this.isUserValue(i, j)) {
            input.disabled = true;
            input.classList.add("initial");
          }
        }

        cell.appendChild(input);
        board.appendChild(cell);

        // Add highlighting for user values
        if (this.isUserValue(i, j)) {
          cell.classList.add("highlighted-user-value");
        }
      }
    }

    this.addCellListeners();
  }

  isUserValue(row, col) {
    return this.gameData.userValues?.some(
      (v) => v.row === row && v.col === col
    );
  }

  addCellListeners() {
    document.querySelectorAll(".cell input").forEach((input) => {
      input.addEventListener("focus", (e) => this.handleCellFocus(e));
      input.addEventListener("blur", (e) => this.handleCellBlur(e));
      input.addEventListener("input", (e) => this.handleCellInput(e));
    });
  }
  handleCellFocus(e) {
    if (this.isPaused || e.target.disabled) return;

    this.selectedCell = e.target;
    this.highlightRelatedCells(e.target);

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

  highlightRelatedCells(cell) {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const value = cell.value;

    document.querySelectorAll(".cell input").forEach((input) => {
      const inputRow = parseInt(input.dataset.row);
      const inputCol = parseInt(input.dataset.col);
      const cellDiv = input.parentElement;

      // Remove all highlight classes first
      cellDiv.classList.remove(
        "highlighted",
        "highlighted-user-value",
        "highlighted-focus-value"
      );

      // Highlight same row, column, and 3x3 box
      if (
        inputRow === row ||
        inputCol === col ||
        (Math.floor(inputRow / 3) === Math.floor(row / 3) &&
          Math.floor(inputCol / 3) === Math.floor(col / 3))
      ) {
        cellDiv.classList.add("highlighted");
      }

      // Highlight user values
      if (this.isUserValue(inputRow, inputCol)) {
        cellDiv.classList.add("highlighted-user-value");
      }

      // Highlight same numbers
      if (value && input.value === value) {
        cellDiv.classList.add("highlighted-focus-value");
      }
    });
  }

  removeHighlight() {
    document.querySelectorAll(".cell").forEach((cell) => {
      cell.classList.remove(
        "highlighted",
        "highlighted-user-value",
        "highlighted-focus-value"
      );

      // Restore user value highlight if applicable
      const input = cell.querySelector("input");
      const row = parseInt(input.dataset.row);
      const col = parseInt(input.dataset.col);
      if (this.isUserValue(row, col)) {
        cell.classList.add("highlighted-user-value");
      }
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
      this.gameData = data.game;

      if (data.isValid || !this.gameData.mistakeChecking) {
        cell.value = value;
        cell.classList.remove("error");
        cell.classList.add("correct");

        // Update visual state for user value
        cell.parentElement.classList.add("highlighted-user-value");

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
          cell.parentElement.classList.remove("highlighted-user-value");
        }, 1000);
      }
    } catch (error) {
      console.error("Error making move:", error);
      alert("Failed to make move");
    }
  }

  async deleteMove(cell) {
    if (!this.gameId || cell.disabled || this.isPaused) return;

    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    try {
      const response = await fetch(`/api/games/${this.gameId}/move`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ row, col, value: 0 }),
      });

      if (!response.ok) throw new Error("Failed to delete move");

      const data = await response.json();
      this.gameData = data.game;

      cell.value = "";
      cell.classList.remove("error", "correct");
      cell.parentElement.classList.remove("highlighted-user-value");

      // Remove from visual highlighting
      this.highlightRelatedCells(cell);
    } catch (error) {
      console.error("Error deleting move:", error);
      alert("Failed to delete move");
    }
  }

  async validateGame() {
    if (!this.gameId || this.isPaused) return;

    try {
      const response = await fetch(`/api/games/${this.gameId}/check`);
      if (!response.ok) throw new Error("Failed to check game");

      const data = await response.json();
      let hasErrors = false;

      // Reset all cell states first
      document
        .querySelectorAll(".cell input:not([disabled])")
        .forEach((input) => {
          input.classList.remove("error", "correct");
          input.parentElement.classList.remove("error"); // Remove error from cell div
        });

      // Apply validation results
      data.validation.forEach((result) => {
        const cell = document.querySelector(
          `.cell input[data-row="${result.row}"][data-col="${result.col}"]`
        );

        if (!cell || cell.disabled) return;

        if (result.isEmpty || !result.isValid) {
          cell.classList.add("error");
          cell.parentElement.classList.add("error"); // Add error to cell div
          hasErrors = true;
        }
      });

      if (!hasErrors && data.isComplete) {
        this.handleGameWin();
      } else if (hasErrors) {
        // Remove error highlighting after delay
        setTimeout(() => {
          document.querySelectorAll(".cell input.error").forEach((input) => {
            input.classList.remove("error");
            input.parentElement.classList.remove("error"); // Remove error from cell div
          });
        }, 2000);
      }
    } catch (error) {
      console.error("Error checking game:", error);
      alert("Failed to check game");
    }
  }

  handleMistake() {
    if (!this.gameData.mistakeChecking) return; // Don't handle mistakes if checking is disabled

    this.gameData.mistakes++;
    this.updateStats();

    if (this.gameData.mistakes >= this.gameData.maxMistakes) {
      this.handleGameOver();
    }
  }

  updateStats() {
    if (!this.gameData) return;
    const mistakeContainer = document.getElementById("mistakes");
    if (this.gameData.mistakeChecking) {
      mistakeContainer.textContent = `${this.gameData.mistakes}/${this.gameData.maxMistakes}`;
    }
  }

  // Timer Management
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const startTime = Date.now() - (this.gameData.timer || 0) * 1000;
    const timerDisplay = document.getElementById("timer");

    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        timerDisplay.textContent = `${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
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
    if (!this.gameData.mistakeChecking) return; // Don't handle game over if mistake checking is disabled

    this.stopTimer();
    this.isPaused = true;

    const boardContainer = document.querySelector(".board-container");
    const overlay = document.createElement("div");
    overlay.className = "game-completion";
    overlay.textContent = "Game Over! Too many mistakes!";
    boardContainer.appendChild(overlay);
  }

  handleGameWin() {
    this.stopTimer();
    this.isPaused = true;

    const minutes = Math.floor(this.gameData.timer / 60);
    const seconds = this.gameData.timer % 60;

    const boardContainer = document.querySelector(".board-container");
    const overlay = document.createElement("div");
    overlay.className = "game-completion";
    overlay.innerHTML = `Congratulations!<br>Time: ${minutes}m ${seconds}s`;
    boardContainer.appendChild(overlay);
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

  // Navigation and UI Updates
  returnToMainMenu() {
    this.stopTimer();
    this.gameId = null;
    this.gameData = null;
    this.selectedCell = null;
    document.getElementById("gameIdInput").value = "";

    // Remove any existing game completion overlays
    const existingOverlay = document.querySelector(".game-completion");
    if (existingOverlay) {
      existingOverlay.remove();
    }

    this.showScreen("welcome");
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

    // Update board highlighting for current theme
    if (this.selectedCell) {
      this.highlightRelatedCells(this.selectedCell);
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

  // Event Listeners Management
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
        button.addEventListener("click", () => {
          const mistakeChecking = confirm(
            "Enable mistake checking? (Cancel for No)"
          );
          this.startNewGame(button.dataset.difficulty, mistakeChecking);
        });
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
          this.deleteMove(this.selectedCell);
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

  handleKeyPress(e) {
    if (!this.selectedCell || this.isPaused || this.selectedCell.disabled)
      return;

    if (/^[1-9]$/.test(e.key)) {
      this.makeMove(this.selectedCell, e.key);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      this.deleteMove(this.selectedCell);
    } else if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
    ) {
      e.preventDefault();
      this.moveFocus(e.key);
    }
  }

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
    if (nextCell) {
      nextCell.focus();
      this.highlightRelatedCells(nextCell);
    }
  }
}

// Create game instance
const game = new SudokuGame();

// Service Worker Registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.error("ServiceWorker registration failed:", error);
    });
  });
}

// Handle visibility change for timer management
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    game.isPaused = true;
  } else {
    game.isPaused = false;
  }
});

// Handle window focus/blur for timer management
window.addEventListener("blur", () => {
  game.isPaused = true;
});

window.addEventListener("focus", () => {
  game.isPaused = false;
});

// Prevent zooming on mobile devices
document.addEventListener("gesturestart", function (e) {
  e.preventDefault();
});
