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
      this.isPaused = false; // Reset pause state for new game

      this.showScreen("game");
      this.createBoard();

      // Reset and start timer from 0
      const timerDisplay = document.getElementById("timer");
      timerDisplay.textContent = "00:00";
      this.startTimer(0);

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

      // Set isPaused based on game status before creating board
      this.isPaused =
        this.gameData.status === "failed" ||
        this.gameData.status === "completed";

      this.showScreen("game");
      this.createBoard();

      // Initialize the timer
      const timerDisplay = document.getElementById("timer");
      const minutes = Math.floor(this.gameData.timer / 60);
      const seconds = this.gameData.timer % 60;
      timerDisplay.textContent = `${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      // Start timer if game is active
      if (!this.isPaused) {
        this.startTimer(this.gameData.timer);
      }

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

    // Check game status and handle appropriately
    if (this.gameData.status === "failed") {
      this.handleGameOver();
    } else if (this.gameData.status === "completed") {
      this.handleGameWin();
    }
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
      input.addEventListener("input", (e) => {
        // Only handle input events that are not from keyboard
        if (e.inputType === "insertText") {
          this.handleCellInput(e);
        }
      });
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

      // Update UI based on move result
      if (data.isValid || !this.gameData.mistakeChecking) {
        cell.value = value;
        cell.classList.remove("error");
        cell.classList.add("correct");
        cell.parentElement.classList.add("highlighted-user-value");

        if (data.isComplete) {
          this.handleGameWin();
        }
      } else {
        cell.value = value; // Show the incorrect value temporarily
        cell.classList.add("error");
        cell.classList.remove("correct");
        this.updateStats(); // Update mistakes display immediately

        // Check if game is failed due to max mistakes
        if (this.gameData.mistakes >= this.gameData.maxMistakes) {
          this.handleGameOver();
        } else {
          setTimeout(() => {
            cell.classList.remove("error");
            cell.value = ""; // Clear the value after animation
            cell.parentElement.classList.remove("highlighted-user-value");
          }, 1000);
        }
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
      document.querySelectorAll(".cell input").forEach((input) => {
        input.classList.remove("error", "correct");
        input.parentElement.classList.remove("error", "empty-error");
      });

      // Apply validation results for all cells that can be modified
      document
        .querySelectorAll(".cell input:not([disabled])")
        .forEach((input) => {
          const row = parseInt(input.dataset.row);
          const col = parseInt(input.dataset.col);
          const value = input.value;

          // Mark empty cells with a different error style
          if (!value) {
            input.parentElement.classList.add("empty-error");
            hasErrors = true;
          }
          // Check non-empty cells against solution
          else if (parseInt(value) !== this.gameData.solution[row][col]) {
            input.classList.add("error");
            hasErrors = true;
          }
        });

      // Remove error highlighting after 2 seconds
      setTimeout(() => {
        document.querySelectorAll(".cell input.error").forEach((input) => {
          input.classList.remove("error");
        });
        document.querySelectorAll(".cell.empty-error").forEach((cell) => {
          cell.classList.remove("empty-error");
        });
      }, 2000);

      if (!hasErrors && data.isComplete) {
        this.handleGameWin();
      }
    } catch (error) {
      console.error("Error checking game:", error);
      alert("Failed to check game");
    }
  }

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
        cell.parentElement.classList.add("highlighted-user-value");

        // Remove highlighting after 2 seconds
        setTimeout(() => {
          cell.parentElement.classList.remove("highlighted-user-value");
        }, 2000);

        if (data.isComplete) {
          this.handleGameWin();
        }
      } else {
        cell.value = value;
        cell.classList.add("error");
        cell.classList.remove("correct");
        this.updateStats();

        if (this.gameData.mistakes >= this.gameData.maxMistakes) {
          this.handleGameOver();
        } else {
          setTimeout(() => {
            cell.classList.remove("error");
            cell.value = "";
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Error making move:", error);
      alert("Failed to make move");
    }
  }

  async updateBoardImage(check = false) {
    try {
      const theme = document.body.getAttribute("data-theme") || "light";
      const url = `/api/games/${this.gameId}/image?theme=${theme}${
        check ? "&check=true" : ""
      }`;
      const response = await fetch(url);

      if (!response.ok) throw new Error("Failed to update board image");

      // You could optionally update a preview or handle the response in some way
    } catch (error) {
      console.error("Error updating board image:", error);
    }
  }

  updateStats() {
    if (!this.gameData) return;
    const mistakeContainer = document.getElementById("mistakes");
    if (this.gameData.mistakeChecking) {
      const currentMistakes = this.gameData.mistakes || 0;
      const maxMistakes = this.gameData.maxMistakes || 3;
      mistakeContainer.textContent = `${currentMistakes}/${maxMistakes}`;
    }
  }

  async saveGameState() {
    if (!this.gameId) return;

    try {
      const response = await fetch(`/api/games/${this.gameId}/save`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timer: this.gameData.timer,
          // Add other state data as needed
        }),
      });

      if (!response.ok) throw new Error("Failed to save game state");
    } catch (error) {
      console.error("Error saving game state:", error);
    }
  }

  // Timer Management
  startTimer(savedTime = 0) {
    // Clear any existing timer first
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Don't start timer if game is completed or failed
    if (this.isPaused) {
      return;
    }

    // Initialize timer display
    const timerDisplay = document.getElementById("timer");
    const formatTime = (totalSeconds) => {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    };

    // Start counting from the saved time
    this.gameData.timer = savedTime;
    timerDisplay.textContent = formatTime(this.gameData.timer);

    this.timerInterval = setInterval(async () => {
      if (!this.isPaused) {
        this.gameData.timer++;
        timerDisplay.textContent = formatTime(this.gameData.timer);

        // Save game state every 10 seconds
        if (this.gameData.timer % 10 === 0) {
          await this.saveGameState();
        }
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

    // Remove any existing overlay first
    const existingOverlay = document.querySelector(".game-completion");
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Disable all input cells except initial values
    document.querySelectorAll(".cell input").forEach((input) => {
      if (!input.classList.contains("initial")) {
        input.disabled = true;
      }
    });

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
      const validateBtn = document.getElementById("validateBtn");
      const check =
        validateBtn.style.display === "none" ||
        validateBtn.classList.contains("active");

      const response = await fetch(
        `/api/games/${this.gameId}/image?theme=${theme}${
          check ? "&check=true" : ""
        }`
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
    // Save the current game state before returning to menu
    if (this.gameId && !this.isPaused) {
      this.saveGameState();
    }

    this.stopTimer();
    this.gameId = null;
    this.gameData = null;
    this.selectedCell = null;
    this.isPaused = false;
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
      .getElementById("mainMenuBtn")
      .addEventListener("click", () => this.returnToMainMenu());
    document
      .getElementById("validateBtn")
      .addEventListener("click", () => this.validateGame());
    document
      .getElementById("downloadBtn")
      .addEventListener("click", () => this.downloadBoard());

    const retryBtn = document.getElementById("retryBtn");
    const retryHandler = async () => {
      if (this.gameId) {
        try {
          const response = await fetch(`/api/games/${this.gameId}/retry`, {
            method: "PUT",
          });

          if (!response.ok) throw new Error("Failed to retry game");

          const data = await response.json();
          this.gameData = data;
          this.isPaused = false;

          // Remove any existing game completion overlays
          const existingOverlay = document.querySelector(".game-completion");
          if (existingOverlay) {
            existingOverlay.remove();
          }

          // Reset and restart the game
          this.createBoard();
          const timerDisplay = document.getElementById("timer");
          timerDisplay.textContent = "00:00";
          this.startTimer(0);
          this.updateStats();
        } catch (error) {
          console.error("Error retrying game:", error);
          alert("Failed to retry game. Please try again.");
        }
      }
    };

    // Store the handler in the class instance
    if (!this.retryHandler) {
      this.retryHandler = retryHandler;
    } else {
      // Remove old handler if it exists
      retryBtn.removeEventListener("click", this.retryHandler);
    }

    // Add new handler
    retryBtn.addEventListener("click", this.retryHandler);

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

    document.getElementById("copyGameId").addEventListener("click", () => {
      const gameId = this.gameId;
      if (gameId) {
        navigator.clipboard
          .writeText(gameId)
          .then(() => {
            // Optional: Show feedback
            const copyIcon = document.getElementById("copyGameId");
            const originalClass = copyIcon.className;
            copyIcon.className = "fas fa-check";
            setTimeout(() => {
              copyIcon.className = originalClass;
            }, 1000);
          })
          .catch((err) => {
            console.error("Failed to copy game ID:", err);
          });
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.gameId && !this.isPaused) {
        this.saveGameState();
      }
    });

    window.addEventListener("beforeunload", () => {
      if (this.gameId && !this.isPaused) {
        this.saveGameState();
      }
    });
  }

  handleKeyPress(e) {
    if (!this.selectedCell || this.isPaused || this.selectedCell.disabled)
      return;

    // Prevent the default behavior for number keys and arrow keys
    if (
      /^[1-9]$/.test(e.key) ||
      e.key === "Delete" ||
      e.key === "Backspace" ||
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
    ) {
      e.preventDefault();
    }

    // Check if the input event is from keyboard
    if (e.type === "keydown") {
      // Only handle number inputs if there isn't already a value in the input
      if (/^[1-9]$/.test(e.key) && !this.selectedCell.value) {
        this.makeMove(this.selectedCell, e.key);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        this.selectedCell.value
      ) {
        this.deleteMove(this.selectedCell);
      } else if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        this.moveFocus(e.key);
      }
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
