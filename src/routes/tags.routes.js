const express = require('express');
const router = express.Router();
const tagsController = require('../controllers/tags.controller');

router.get('/', tagsController.getAllTags);
router.post('/', tagsController.createTag);
router.delete('/:id', tagsController.deleteTag);

router.get('/cards/:cardId/tags', tagsController.getTagsByCard); 
router.post('/cards/:cardId/tags', tagsController.addTagToCard); 
router.delete('/cards/:cardId/tags/:tagId', tagsController.removeTagFromCard); 


router.get('/:tagId/study', tagsController.getStudyCardsByTag); 

module.exports = router;