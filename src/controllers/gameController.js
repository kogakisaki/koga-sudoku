// src/controllers/gameController.js
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const GameModel = require("../models/gameModel");

class GameController {
  async createNewGame(req, res) {
    try {
      const { difficulty, mistakeChecking } = req.body;
      const gameId = uuidv4();
      const game = GameModel.createNewGame(difficulty, mistakeChecking);

      const gameData = {
        id: gameId,
        ...game,
        userValues: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      await this.saveGame(gameId, gameData);
      res.status(201).json({ gameId, game: gameData });
    } catch (error) {
      console.error("Create game error:", error);
      res.status(500).json({ error: "Failed to create new game" });
    }
  }

  async getGame(req, res) {
    try {
      const { id } = req.params;
      const game = await this.loadGame(id);

      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }

      if (!game.userValues) {
        game.userValues = [];
      }

      res.json(game);
    } catch (error) {
      res.status(500).json({ error: "Failed to get game" });
    }
  }

  async makeMove(req, res) {
    try {
      const { id } = req.params;
      const { row, col, value } = req.body;
      const game = await this.loadGame(id);

      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }

      if (game.status === "failed") {
        return res.json({
          isValid: false,
          game,
          isComplete: false,
          isFailed: true,
        });
      }

      if (!game.userValues) {
        game.userValues = [];
      }

      if (value === 0) {
        const index = game.userValues.findIndex(
          (v) => v.row === row && v.col === col
        );
        if (index !== -1) {
          game.userValues.splice(index, 1);
        }
        game.board[row][col] = 0;
        game.lastUpdated = new Date().toISOString();

        await this.saveGame(id, game);
        return res.json({
          isValid: true,
          game,
          isComplete: false,
          isFailed: false,
        });
      }

      // Check if the move is valid against the solution
      const isValid = game.mistakeChecking
        ? GameModel.validateMove(game, row, col, value)
        : true;

      if (isValid || !game.mistakeChecking) {
        game.board[row][col] = value;
        game.lastUpdated = new Date().toISOString();

        if (!game.userValues.some((v) => v.row === row && v.col === col)) {
          game.userValues.push({ row, col });
        }

        if (GameModel.isGameComplete(game)) {
          game.status = "completed";
          game.completedAt = new Date().toISOString();
        }
      } else if (game.mistakeChecking) {
        game.mistakes++;
        if (game.mistakes >= game.maxMistakes) {
          game.status = "failed";
        }
      }

      await this.saveGame(id, game);
      res.json({
        isValid,
        game,
        isComplete: game.status === "completed",
        isFailed: game.status === "failed",
      });
    } catch (error) {
      console.error("Make move error:", error);
      res.status(500).json({ error: "Failed to make move" });
    }
  }

  async checkGame(req, res) {
    try {
      const { id } = req.params;
      const game = await this.loadGame(id);

      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }

      // Create an array to store the validation results
      const validation = [];

      // Check each cell
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
          const currentValue = game.board[i][j];
          const correctValue = game.solution[i][j];

          // Only check non-initial cells (cells that can be modified by the user)
          if (
            !game.userValues.some((v) => v.row === i && v.col === j) &&
            currentValue !== 0
          ) {
            continue;
          }

          validation.push({
            row: i,
            col: j,
            isEmpty: currentValue === 0,
            isValid: currentValue === correctValue,
          });
        }
      }

      res.json({
        validation,
        isComplete: GameModel.isGameComplete(game),
      });
    } catch (error) {
      console.error("Check game error:", error);
      res.status(500).json({ error: "Failed to check game" });
    }
  }

  async retryGame(req, res) {
    try {
      const { id } = req.params;
      const oldGame = await this.loadGame(id);

      if (!oldGame) {
        return res.status(404).json({ error: "Game not found" });
      }

      const newGame = GameModel.createNewGame(
        oldGame.difficulty,
        oldGame.mistakeChecking
      );
      const gameData = {
        id,
        ...newGame,
        userValues: [],
        createdAt: oldGame.createdAt,
        lastUpdated: new Date().toISOString(),
      };

      await this.saveGame(id, gameData);
      res.json(gameData);
    } catch (error) {
      console.error("Retry game error:", error);
      res.status(500).json({ error: "Failed to retry game" });
    }
  }

  async deleteMove(req, res) {
    try {
      const { id } = req.params;
      const { row, col } = req.body;
      const game = await this.loadGame(id);

      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }

      if (!game.userValues) {
        game.userValues = [];
      }

      const index = game.userValues.findIndex(
        (v) => v.row === row && v.col === col
      );
      if (index !== -1) {
        game.userValues.splice(index, 1);
      }

      game.board[row][col] = 0;
      game.lastUpdated = new Date().toISOString();

      await this.saveGame(id, game);
      res.json({
        isValid: true,
        game,
        isComplete: false,
        isFailed: false,
      });
    } catch (error) {
      console.error("Delete move error:", error);
      res.status(500).json({ error: "Failed to delete move" });
    }
  }

  async saveGame(gameId, data) {
    const gamesDir = path.join(__dirname, "../data/games");
    const filePath = path.join(gamesDir, `${gameId}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async loadGame(gameId) {
    try {
      const filePath = path.join(__dirname, "../data/games", `${gameId}.json`);
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async saveGameState(req, res) {
    try {
      const { id } = req.params;
      const { timer } = req.body;
      const game = await this.loadGame(id);

      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }

      game.timer = timer;
      game.lastUpdated = new Date().toISOString();

      await this.saveGame(id, game);
      res.json({ success: true });
    } catch (error) {
      console.error("Save game state error:", error);
      res.status(500).json({ error: "Failed to save game state" });
    }
  }
}

module.exports = new GameController();
