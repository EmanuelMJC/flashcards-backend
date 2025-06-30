const express = require('express');
const router = express.Router();
const decksController = require('../controllers/decks.controller');
const cardsController = require('../controllers/cards.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', decksController.getAllDecks);

router.get('/:id', decksController.getDeckById);

router.post('/', decksController.createDeck);

router.put('/:id', decksController.updateDeck);

router.delete('/:id', decksController.deleteDeck);

router.get('/:deckId/study', decksController.getStudyCards);

router.get('/:deckId/cards', cardsController.getCardsByDeck);

router.post('/:deckId/cards', cardsController.createCard);

module.exports = router;
