// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const { createCanvas, registerFont } = require("canvas");
const fs = require("fs").promises;
const gameRoutes = require("./src/routes/gameRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

registerFont(path.join(__dirname, "public/fonts/Rubik-Regular.ttf"), {
  family: "Rubik",
});
registerFont(path.join(__dirname, "public/fonts/Rubik-Medium.ttf"), {
  family: "Rubik Medium",
});
registerFont(path.join(__dirname, "public/fonts/Rubik-Bold.ttf"), {
  family: "Rubik Bold",
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Ensure data directory exists
async function ensureDataExists() {
  const gamesDir = path.join(__dirname, "src/data/games");
  try {
    await fs.access(gamesDir);
  } catch {
    await fs.mkdir(gamesDir, { recursive: true });
  }
}

// API Routes
app.use("/api/games", gameRoutes);

// Board Image Generation Endpoint
app.get("/api/games/:id/image", async (req, res) => {
  try {
    const { id } = req.params;
    const { theme = "light" } = req.query;

    const gamePath = path.join(__dirname, "src/data/games", `${id}.json`);
    const gameData = JSON.parse(await fs.readFile(gamePath, "utf8"));

    // Dimensions
    const gridLabelSize = 30; // Size for row/column labels
    const padding = 40;
    const cellSize = 50;
    const boardSize = cellSize * 9;
    const headerHeight = 60;
    const footerHeight = 40;

    // Calculate total width and height including labels
    const totalBoardWidth = boardSize + gridLabelSize;
    const totalBoardHeight = boardSize + gridLabelSize;
    const canvasWidth = totalBoardWidth + padding * 2;
    const canvasHeight =
      totalBoardHeight + headerHeight + footerHeight + padding * 2;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    const colors =
      theme === "dark"
        ? {
            background: "#2d2d2d",
            lines: "#ffffff",
            text: "#ffffff",
            gridLabels: "rgba(255, 255, 255, 0.7)",
          }
        : {
            background: "#ffffff",
            lines: "#000000",
            text: "#000000",
            gridLabels: "rgba(0, 0, 0, 0.7)",
          };

    // Draw background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw header (Sudoku title)
    ctx.font = '32px "Rubik Bold"';
    ctx.fillStyle = colors.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Sudoku", canvasWidth / 2, padding + headerHeight / 2);

    // Calculate board position - adjusted left position
    const boardLeft = padding + gridLabelSize / 2; // Reduced the left offset
    const boardTop = padding + headerHeight + gridLabelSize;

    // Draw row numbers (1-9)
    ctx.font = '16px "Rubik Medium"';
    ctx.fillStyle = colors.gridLabels;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 9; i++) {
      const y = boardTop + i * cellSize + cellSize / 2;
      ctx.fillText((i + 1).toString(), padding, y); // Adjusted x position
    }

    // Draw column numbers (1-9)
    for (let i = 0; i < 9; i++) {
      const x = boardLeft + i * cellSize + cellSize / 2;
      ctx.fillText((i + 1).toString(), x, boardTop - gridLabelSize / 2);
    }

    // Draw cells and numbers
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        const x = boardLeft + j * cellSize;
        const y = boardTop + i * cellSize;

        // Draw cell borders
        ctx.strokeStyle = colors.lines;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);

        // Draw numbers
        if (gameData.board[i][j] !== 0) {
          ctx.font = "24px Rubik";
          ctx.fillStyle = colors.text;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            gameData.board[i][j].toString(),
            x + cellSize / 2,
            y + cellSize / 2
          );
        }
      }
    }

    // Draw thicker lines for 3x3 boxes
    ctx.lineWidth = 3;
    for (let i = 0; i <= 9; i++) {
      if (i % 3 === 0) {
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(boardLeft + i * cellSize, boardTop);
        ctx.lineTo(boardLeft + i * cellSize, boardTop + boardSize);
        ctx.stroke();

        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(boardLeft, boardTop + i * cellSize);
        ctx.lineTo(boardLeft + boardSize, boardTop + i * cellSize);
        ctx.stroke();
      }
    }

    // Draw footer (game ID)
    ctx.font = "16px Rubik";
    ctx.fillStyle = colors.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(id, canvasWidth / 2, boardTop + boardSize + footerHeight / 2);

    res.setHeader("Content-Type", "image/png");
    canvas.createPNGStream().pipe(res);
  } catch (error) {
    console.error("Error generating board image:", error);
    res.status(500).json({ error: "Failed to generate board image" });
  }
});

// Serve static files
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Initialize server
async function initializeServer() {
  try {
    await ensureDataExists();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`View the app at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
}

initializeServer();

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something broke!" });
});

module.exports = app;
