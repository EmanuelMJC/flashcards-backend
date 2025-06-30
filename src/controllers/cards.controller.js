const db = require('../database/db');

const cardsController = {
  getCardsByDeck: (req, res) => {
    const { deckId } = req.params;
    const userId = req.user.id;
    
    db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, userId], (err, deck) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!deck) {
        return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });
      }
      
      db.all('SELECT * FROM cards WHERE deck_id = ?', [deckId], (err, rows) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json(rows);
      });
    });
  },

  createCard: (req, res) => {
    const { deckId } = req.params;
    const { front, back } = req.body;
    const userId = req.user.id;
    
    if (!front || !back) {
      return res.status(400).json({ 
        error: 'Frente e verso do card são obrigatórios.' 
      });
    }
    
    db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, userId], (err, deck) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!deck) {
        return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });
      }
      
      db.run('INSERT INTO cards (deck_id, front, back, difficulty) VALUES (?, ?, ?, ?)', 
             [deckId, front, back, 'new'], 
             function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.status(201).json({
          id: this.lastID,
          deck_id: deckId,
          front,
          back,
          difficulty: 'new'
        });
      });
    });
  },

  getCardById: (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    const query = `
      SELECT c.* FROM cards c
      INNER JOIN decks d ON c.deck_id = d.id
      WHERE c.id = ? AND d.user_id = ?
    `;
    
    db.get(query, [id, userId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Card não encontrado ou não autorizado.' });
      }
      
      res.json(row);
    });
  },

  updateCard: (req, res) => {
    const { id } = req.params;
    const { front, back, difficulty } = req.body;
    const userId = req.user.id;
    
    const checkQuery = `
      SELECT c.* FROM cards c
      INNER JOIN decks d ON c.deck_id = d.id
      WHERE c.id = ? AND d.user_id = ?
    `;
    
    db.get(checkQuery, [id, userId], (err, card) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!card) {
        return res.status(404).json({ error: 'Card não encontrado ou não autorizado.' });
      }
      
      let nextReview = null;
      const now = new Date();
      
      if (difficulty && difficulty !== 'new') {
        switch (difficulty) {
          case 'easy':
            nextReview = new Date(now.getTime() + (4 * 24 * 60 * 60 * 1000)); // 4 dias
            break;
          case 'medium':
            nextReview = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000)); // 2 dias
            break;
          case 'hard':
            nextReview = new Date(now.getTime() + (1 * 24 * 60 * 60 * 1000)); // 1 dia
            break;
        }
      }
      
      const updateQuery = `
        UPDATE cards 
        SET front = ?, back = ?, difficulty = ?, last_studied = ?, next_review = ?
        WHERE id = ?
      `;
      
      db.run(updateQuery, 
             [front || card.front, back || card.back, difficulty || card.difficulty, 
              new Date().toISOString(), nextReview?.toISOString() || card.next_review, id], 
             function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.json({ message: 'Card atualizado com sucesso!' });
      });
    });
  },

  deleteCard: (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    const checkQuery = `
      SELECT c.* FROM cards c
      INNER JOIN decks d ON c.deck_id = d.id
      WHERE c.id = ? AND d.user_id = ?
    `;
    
    db.get(checkQuery, [id, userId], (err, card) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!card) {
        return res.status(404).json({ error: 'Card não encontrado ou não autorizado.' });
      }
      
      db.run('DELETE FROM cards WHERE id = ?', [id], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.json({ message: 'Card deletado com sucesso!' });
      });
    });
  },

  markCardDifficulty: (req, res) => {
    const { id } = req.params;
    const { difficulty } = req.body;
    const userId = req.user.id;
    
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({ error: 'Dificuldade deve ser: easy, medium ou hard.' });
    }
    
    const checkQuery = `
      SELECT c.* FROM cards c
      INNER JOIN decks d ON c.deck_id = d.id
      WHERE c.id = ? AND d.user_id = ?
    `;
    
    db.get(checkQuery, [id, userId], (err, card) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!card) {
        return res.status(404).json({ error: 'Card não encontrado ou não autorizado.' });
      }
      
      const now = new Date();
      let nextReview;
      
      switch (difficulty) {
        case 'easy':
          nextReview = new Date(now.getTime() + (4 * 24 * 60 * 60 * 1000)); // 4 dias
          break;
        case 'medium':
          nextReview = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000)); // 2 dias
          break;
        case 'hard':
          nextReview = new Date(now.getTime() + (1 * 24 * 60 * 60 * 1000)); // 1 dia
          break;
      }
      
      const updateQuery = `
        UPDATE cards 
        SET difficulty = ?, last_studied = ?, next_review = ?
        WHERE id = ?
      `;
      
      db.run(updateQuery, 
             [difficulty, now.toISOString(), nextReview.toISOString(), id], 
             function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.json({ 
          message: 'Dificuldade marcada com sucesso!',
          next_review: nextReview.toISOString()
        });
      });
    });
  }
};

module.exports = cardsController;
