// src/controllers/gameController.js
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const GameModel = require("../models/gameModel");

class GameController {
  async createNewGame(req, res) {
    try {
      const { difficulty } = req.body;
      const gameId = uuidv4();
      const game = GameModel.createNewGame(difficulty);

      const gameData = {
        id: gameId,
        ...game,
        userValues: [], // Initialize empty array for user values
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

      // Initialize userValues if not present
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

      // Initialize userValues if not present
      if (!game.userValues) {
        game.userValues = [];
      }

      // Handle delete move (value = 0)
      if (value === 0) {
        // Remove from userValues if it exists
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

      // Handle regular move
      const isValid = GameModel.validateMove(game, row, col, value);
      if (isValid) {
        game.board[row][col] = value;
        game.lastUpdated = new Date().toISOString();

        // Add to userValues if not already present
        if (!game.userValues.some((v) => v.row === row && v.col === col)) {
          game.userValues.push({ row, col });
        }

        if (GameModel.isGameComplete(game)) {
          game.status = "completed";
          game.completedAt = new Date().toISOString();
        }
      } else {
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

  async retryGame(req, res) {
    try {
      const { id } = req.params;
      const oldGame = await this.loadGame(id);

      if (!oldGame) {
        return res.status(404).json({ error: "Game not found" });
      }

      const newGame = GameModel.createNewGame(oldGame.difficulty);
      const gameData = {
        id,
        ...newGame,
        userValues: [], // Reset user values for new game
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      await this.saveGame(id, gameData);
      res.json(gameData);
    } catch (error) {
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

      // Initialize userValues if not present
      if (!game.userValues) {
        game.userValues = [];
      }

      // Remove from userValues if it exists
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
}

module.exports = new GameController();
