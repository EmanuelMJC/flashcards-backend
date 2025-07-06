const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.post('/sessions', reportsController.recordStudySession);

router.get('/history', reportsController.getStudyHistory);
router.get('/stats/overall', reportsController.getOverallStats);
router.get('/stats/decks', reportsController.getStatsByDeck);
router.get('/stats/tags', reportsController.getStatsByTag);

module.exports = router;