const db = require('../database/db');

const tagsController = {
  // Obter todas as tags de um usuário
  getAllTags: (req, res) => {
    const userId = req.user.id;
    db.all('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC', [userId], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  },

  // Criar uma nova tag para o usuário
  createTag: async (req, res) => {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'O nome da tag é obrigatório.' });
    }

    try {
      // Verifica se a tag já existe para este usuário
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

  // Deletar uma tag 
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

  // Obter tags de um card específico
  getTagsByCard: (req, res) => {
    const { cardId } = req.params;
    const userId = req.user.id;

    // Verificar se o card pertence ao usuário
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

      // Se o card for válido, buscar as tags associadas
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

  // Associar uma tag a um card
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
  }
};

module.exports = tagsController;