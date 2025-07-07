const db = require('../database/db');

const tagsController = {
  getAllTags: (req, res) => {
    const userId = req.user.id;
    db.all('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC', [userId], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  },

  createTag: async (req, res) => {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'O nome da tag é obrigatório.' });
    }

    try {
      const existingTag = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM tags WHERE user_id = ? AND name = ?', [userId, name.trim()], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (existingTag) {
        return res.status(409).json({ message: 'Tag com este nome já existe para seu usuário.' });
      }

      await new Promise((resolve, reject) => {
        db.run('INSERT INTO tags (user_id, name) VALUES (?, ?)', [userId, name.trim()], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      res.status(201).json({ id: this.lastID, user_id: userId, name: name.trim() });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao criar tag.', error: error.message });
    }
  },

  deleteTag: (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    db.run('DELETE FROM tags WHERE id = ? AND user_id = ?', [id, userId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Tag não encontrada ou não autorizada.' });
      }
      res.json({ message: 'Tag deletada com sucesso.' });
    });
  },

  getTagsByCard: (req, res) => {
    const { cardId } = req.params;
    const userId = req.user.id;

    const checkCardQuery = `
      SELECT c.id FROM cards c
      JOIN decks d ON c.deck_id = d.id
      WHERE c.id = ? AND d.user_id = ?
    `;

    db.get(checkCardQuery, [cardId, userId], (err, card) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!card) {
        return res.status(404).json({ error: 'Card não encontrado ou não autorizado.' });
      }

      const query = `
        SELECT t.id, t.name
        FROM tags t
        JOIN card_tags ct ON t.id = ct.tag_id
        WHERE ct.card_id = ?
      `;
      db.all(query, [cardId], (err, tags) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json(tags);
      });
    });
  },

  addTagToCard: async (req, res) => {
    const { cardId } = req.params;
    const { tagId } = req.body; 
    const userId = req.user.id;

    if (!tagId) {
      return res.status(400).json({ error: 'ID da tag é obrigatório.' });
    }

    try {
      const cardCheck = await new Promise((resolve, reject) => {
        db.get(`SELECT c.id FROM cards c JOIN decks d ON c.deck_id = d.id WHERE c.id = ? AND d.user_id = ?`,
          [cardId, userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
      });
      if (!cardCheck) {
        return res.status(404).json({ error: 'Card não encontrado ou não autorizado.' });
      }

      const tagCheck = await new Promise((resolve, reject) => {
        db.get(`SELECT id FROM tags WHERE id = ? AND user_id = ?`,
          [tagId, userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
      });
      if (!tagCheck) {
        return res.status(404).json({ error: 'Tag não encontrada ou não autorizada.' });
      }

      await new Promise((resolve, reject) => {
        db.run('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)',
          [cardId, tagId], function(err) {
            if (err) reject(err);
            else resolve();
          });
      });

      res.status(200).json({ message: 'Tag associada ao card com sucesso.' });

    } catch (error) {
      res.status(500).json({ message: 'Erro ao associar tag ao card.', error: error.message });
    }
  },

  removeTagFromCard: (req, res) => {
    const { cardId, tagId } = req.params; 
    const userId = req.user.id;

    const checkCardQuery = `
      SELECT c.id FROM cards c
      JOIN decks d ON c.deck_id = d.id
      WHERE c.id = ? AND d.user_id = ?
    `;

    db.get(checkCardQuery, [cardId, userId], (err, card) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!card) {
        return res.status(404).json({ error: 'Card não encontrado ou não autorizado.' });
      }

      db.run('DELETE FROM card_tags WHERE card_id = ? AND tag_id = ?', [cardId, tagId], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Associação de tag não encontrada para este card.' });
        }
        res.json({ message: 'Tag removida do card com sucesso.' });
      });
    });
  },

  getStudyCardsByTag: async (req, res) => {
    const { tagId } = req.params;
    const userId = req.user.id;
    const now = new Date().toISOString();

    console.log(`[Backend] getStudyCardsByTag - tagId: ${tagId}, userId: ${userId}`);

    try {
      const tag = await new Promise((resolve, reject) => {
        db.get('SELECT id, name FROM tags WHERE id = ? AND user_id = ?', [tagId, userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!tag) {
      console.log(`[Backend] Tag ${tagId} não encontrada ou não autorizada para o usuário ${userId}.`); 
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
          console.error(`[Backend] Erro ao buscar cartões para a tag ${tagId}:`, err); 
          return res.status(500).json({ error: err.message });
        }
        console.log(`[Backend] Encontrado ${cards.length} cartões para a tag ${tagId}.`);

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
      console.error('Erro ao obter cards para estudo por tag no backend:', error);
      res.status(500).json({ message: 'Erro ao obter cards para estudo por tag.', error: error.message });
    }
  },

  getAllTags: (req, res) => {
    const userId = req.user.id;
    const query = `
      SELECT DISTINCT t.id, t.name
      FROM tags t
      INNER JOIN card_tags ct ON t.id = ct.tag_id
      INNER JOIN cards c ON ct.card_id = c.id
      INNER JOIN decks d ON c.deck_id = d.id
      WHERE d.user_id = ?
      ORDER BY t.name ASC;
    `;

    db.all(query, [userId], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  }
};

module.exports = tagsController;