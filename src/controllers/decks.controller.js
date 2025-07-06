const db = require('../database/db');

const decksController = {
  getAllDecks: (req, res) => {
    const userId = req.user.id;
    
    const query = `
      SELECT d.*, 
             COUNT(c.id) AS total_cards,
             SUM(CASE WHEN c.difficulty = 'new' OR c.next_review IS NULL OR c.next_review <= ? THEN 1 ELSE 0 END) AS cards_for_review
      FROM decks d
      LEFT JOIN cards c ON d.id = c.deck_id
      WHERE d.user_id = ?
      GROUP BY d.id
      ORDER BY d.name ASC
    `;
    const now = new Date().toISOString();

    db.all(query, [now, userId], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  },

  getDeckById: (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    const query = `
      SELECT d.*, 
             COUNT(c.id) AS total_cards,
             SUM(CASE WHEN c.difficulty = 'new' OR c.next_review IS NULL OR c.next_review <= ? THEN 1 ELSE 0 END) AS cards_for_review
      FROM decks d
      LEFT JOIN cards c ON d.id = c.deck_id
      WHERE d.id = ? AND d.user_id = ?
      GROUP BY d.id
    `;
    const now = new Date().toISOString();

    db.get(query, [now, id, userId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });

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
        description,
        total_cards: 0, 
        cards_for_review: 0 
      });
    });
  },

  updateDeck: (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;
    
    if (!name && description === undefined) { 
      return res.status(400).json({ error: 'Pelo menos o nome ou a descrição devem ser fornecidos.' });
    }

    db.get('SELECT name, description FROM decks WHERE id = ? AND user_id = ?', [id, userId], (err, deck) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!deck) {
            return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });
        }

        const newName = name !== undefined ? name : deck.name;
        const newDescription = description !== undefined ? description : deck.description;

        db.run('UPDATE decks SET name = ?, description = ? WHERE id = ? AND user_id = ?', 
               [newName, newDescription, id, userId], 
               function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });
          }
          
          res.json({ message: 'Deck atualizado com sucesso!' });
        });
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
    
    console.log("DeckId:", deckId, "UserId:", userId);

    db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, userId], (err, deck) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!deck) {
        return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });
      }
      
      const query = `
        SELECT c.*,
               GROUP_CONCAT(t.name) AS tags_names,
               GROUP_CONCAT(t.id) AS tags_ids
        FROM cards c
        LEFT JOIN card_tags ct ON c.id = ct.card_id
        LEFT JOIN tags t ON ct.tag_id = t.id
        WHERE c.deck_id = ? AND ( 
          c.difficulty = 'new' OR  
          c.next_review IS NULL OR  
          c.next_review <= ? 
        )
        GROUP BY c.id
        ORDER BY  
          CASE c.difficulty  
            WHEN 'new' THEN 1  
            WHEN 'again' THEN 2 -- Adicionado 'again' aqui
            WHEN 'hard' THEN 3  
            WHEN 'medium' THEN 4  
            WHEN 'easy' THEN 5  
          END, 
          c.next_review ASC
      `;
        
      db.all(query, [deckId, now], (err, cards) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const cardsWithTags = cards.map(card => ({
          ...card,
          tags: card.tags_ids ? card.tags_ids.split(',').map((id, index) => ({
            id: parseInt(id),
            name: card.tags_names.split(',')[index]
          })) : []
        }));

        res.json({ 
          deck: deck, 
          cards: cardsWithTags, 
          total_cards: cardsWithTags.length 
        });
      });
    });
  },

  getStudyCardsByTag: async (req, res) => {
    const { tagId } = req.params;
    const userId = req.user.id;
    const now = new Date().toISOString();

    try {
      const tag = await new Promise((resolve, reject) => {
        db.get('SELECT id, name FROM tags WHERE id = ? AND user_id = ?', [tagId, userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!tag) {
        return res.status(404).json({ error: 'Tag não encontrada ou não autorizada.' });
      }

      const query = `
        SELECT c.*,
               GROUP_CONCAT(t.name) AS tags_names,
               GROUP_CONCAT(t.id) AS tags_ids
        FROM cards c
        INNER JOIN card_tags ct ON c.id = ct.card_id
        LEFT JOIN decks d ON c.deck_id = d.id -- Precisa juntar com decks para verificar user_id
        LEFT JOIN tags t ON ct.tag_id = t.id -- Para pegar todas as tags do card
        WHERE ct.tag_id = ? AND d.user_id = ? AND (
          c.difficulty = 'new' OR
          c.next_review IS NULL OR
          c.next_review <= ?
        )
        GROUP BY c.id
        ORDER BY
          CASE c.difficulty
            WHEN 'new' THEN 1
            WHEN 'again' THEN 2
            WHEN 'hard' THEN 3
            WHEN 'medium' THEN 4
            WHEN 'easy' THEN 5
          END,
          c.next_review ASC
      `;

      db.all(query, [tagId, userId, now], (err, cards) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        const cardsWithTags = cards.map(card => ({
          ...card,
          tags: card.tags_ids ? card.tags_ids.split(',').map((id, index) => ({
            id: parseInt(id),
            name: card.tags_names.split(',')[index]
          })) : []
        }));

        res.json({
          tag: tag, 
          cards: cardsWithTags,
          total_cards: cardsWithTags.length
        });
      });

    } catch (error) {
      res.status(500).json({ message: 'Erro ao obter cards para estudo por tag.', error: error.message });
    }
  },

  resetCardProgress: (req, res) => {
    const { cardId } = req.params;
    const userId = req.user.id;

    const checkQuery = `
      SELECT c.* FROM cards c
      INNER JOIN decks d ON c.deck_id = d.id
      WHERE c.id = ? AND d.user_id = ?
    `;

    db.get(checkQuery, [cardId, userId], (err, card) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!card) {
        return res.status(404).json({ error: 'Card não encontrado ou não autorizado.' });
      }

      db.run('UPDATE cards SET difficulty = ?, last_studied = NULL, next_review = NULL WHERE id = ?',
             ['new', cardId], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Progresso do card resetado com sucesso!' });
      });
    });
  },

  resetDeckProgress: (req, res) => {
    const { deckId } = req.params;
    const userId = req.user.id;

    db.get('SELECT id FROM decks WHERE id = ? AND user_id = ?', [deckId, userId], (err, deck) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!deck) {
        return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });
      }

      db.run('UPDATE cards SET difficulty = ?, last_studied = NULL, next_review = NULL WHERE deck_id = ?',
             ['new', deckId], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Progresso de todos os cards do deck resetado com sucesso!' });
      });
    });
  }
};

module.exports = decksController;
=======
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
