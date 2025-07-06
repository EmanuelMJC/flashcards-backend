const express = require('express');
const router = express.Router();
const tagsController = require('../controllers/tags.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', tagsController.getAllTags); 
router.post('/', tagsController.createTag); 
router.delete('/:id', tagsController.deleteTag); 

router.get('/card/:cardId', tagsController.getTagsByCard); 
router.post('/card/:cardId', tagsController.addTagToCard); 
router.delete('/card/:cardId/:tagId', tagsController.removeTagFromCard); 

module.exports = router;