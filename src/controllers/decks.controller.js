const db = require('../database/db');

const decksController = {
  getAllDecks: (req, res) => {
    const userId = req.user.id;
    
    db.all('SELECT * FROM decks WHERE user_id = ?', [userId], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  },

  getDeckById: (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Deck não encontrado.' });
      }
      
      res.json(row);
    });
  },

  createDeck: (req, res) => {
    const { name, description } = req.body;
    const userId = req.user.id;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome do deck é obrigatório.' });
    }
    
    db.run('INSERT INTO decks (user_id, name, description) VALUES (?, ?, ?)', 
           [userId, name, description || null], 
           function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.status(201).json({
        id: this.lastID,
        user_id: userId,
        name,
        description
      });
    });
  },

  updateDeck: (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;
    
    db.run('UPDATE decks SET name = ?, description = ? WHERE id = ? AND user_id = ?', 
           [name, description, id, userId], 
           function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });
      }
      
      res.json({ message: 'Deck atualizado com sucesso!' });
    });
  },

  deleteDeck: (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    db.run('DELETE FROM decks WHERE id = ? AND user_id = ?', [id, userId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });
      }
      
      res.json({ message: 'Deck deletado com sucesso!' });
    });
  },

  getStudyCards: (req, res) => {
    const { deckId } = req.params;
    const userId = req.user.id;
    const now = new Date().toISOString();
    
    db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, userId], (err, deck) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!deck) {
        return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });
      }
      
      const query = `
        SELECT * FROM cards 
        WHERE deck_id = ? AND (
          difficulty = 'new' OR 
          next_review IS NULL OR 
          next_review <= ?
        )
        ORDER BY 
          CASE difficulty 
            WHEN 'new' THEN 1 
            WHEN 'hard' THEN 2 
            WHEN 'medium' THEN 3 
            WHEN 'easy' THEN 4 
          END,
          next_review ASC
      `;
      
      db.all(query, [deckId, now], (err, cards) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.json({
          deck: deck,
          cards: cards,
          total_cards: cards.length
        });
      });
    });
  }
};

module.exports = decksController;
