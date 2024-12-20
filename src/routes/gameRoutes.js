// src/routes/gameRoutes.js
const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// Core game routes
router.post('/new', (req, res) => gameController.createNewGame(req, res));
router.get('/:id', (req, res) => gameController.getGame(req, res));
router.put('/:id/move', (req, res) => gameController.makeMove(req, res));
router.put('/:id/retry', (req, res) => gameController.retryGame(req, res));
router.get('/:id/check', (req, res) => gameController.checkGame(req, res)); 
router.delete('/:id/move', (req, res) => gameController.deleteMove(req, res));
router.put('/:id/save', (req, res) => gameController.saveGameState(req, res));

module.exports = router;