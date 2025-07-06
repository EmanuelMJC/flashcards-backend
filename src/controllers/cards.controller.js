const db = require('../database/db');

const addTime = (date, days = 0, hours = 0) => {
  const newDate = new Date(date.getTime());
  newDate.setDate(newDate.getDate() + days);
  newDate.setHours(newDate.getHours() + hours);
  return newDate;
};

const cardsController = {
  getCardsByDeck: (req, res) => {
    const { deckId } = req.params;
    const userId = req.user.id;

    const query = `
      SELECT c.*, 
             GROUP_CONCAT(t.name) AS tags_names,
             GROUP_CONCAT(t.id) AS tags_ids
      FROM cards c
      INNER JOIN decks d ON c.deck_id = d.id
      LEFT JOIN card_tags ct ON c.id = ct.card_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      WHERE c.deck_id = ? AND d.user_id = ?
      GROUP BY c.id
    `;

    db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, userId], (err, deck) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!deck) return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });

      db.all(query, [deckId, userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const cardsWithTags = rows.map(card => ({
          ...card,
          tags: card.tags_ids ? card.tags_ids.split(',').map((id, index) => ({
            id: parseInt(id),
            name: card.tags_names.split(',')[index]
          })) : []
        }));
        res.json(cardsWithTags);
      });
    });
  },

  createCard: (req, res) => {
    const { deckId } = req.params;
    const { front, back, tags } = req.body;
    const userId = req.user.id;

    if (!front || !back) {
      return res.status(400).json({ error: 'Frente e verso do card são obrigatórios.' });
    }

    db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, userId], (err, deck) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!deck) return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });

      db.run('INSERT INTO cards (deck_id, front, back, difficulty) VALUES (?, ?, ?, ?)',
        [deckId, front, back, 'new'],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          const cardId = this.lastID;

          if (tags && Array.isArray(tags) && tags.length > 0) {
            const tagPromises = tags.map(tagName => {
              return new Promise((resolve, reject) => {
                db.get('SELECT id FROM tags WHERE user_id = ? AND name = ?', [userId, tagName], (err, tagRow) => {
                  if (err) return reject(err);

                  if (tagRow) {
                    db.run('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)', [cardId, tagRow.id], err => {
                      if (err) reject(err);
                      else resolve();
                    });
                  } else {
                    db.run('INSERT INTO tags (user_id, name) VALUES (?, ?)', [userId, tagName], function (err) {
                      if (err) return reject(err);
                      const newTagId = this.lastID;
                      db.run('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)', [cardId, newTagId], err => {
                        if (err) reject(err);
                        else resolve();
                      });
                    });
                  }
                });
              });
            });

            Promise.all(tagPromises)
              .then(() => {
                res.status(201).json({ id: cardId, deck_id: deckId, front, back, difficulty: 'new', tags });
              })
              .catch(tagErr => {
                console.error('Erro ao associar tags ao card:', tagErr.message);
                res.status(201).json({
                  id: cardId,
                  deck_id: deckId,
                  front,
                  back,
                  difficulty: 'new',
                  message: 'Card criado, mas houve um erro ao associar algumas tags.'
                });
              });
          } else {
            res.status(201).json({ id: cardId, deck_id: deckId, front, back, difficulty: 'new', tags: [] });
          }
        });
    });
  },

  getCardById: (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const query = `
      SELECT c.*,
             GROUP_CONCAT(t.name) AS tags_names,
             GROUP_CONCAT(t.id) AS tags_ids
      FROM cards c
      INNER JOIN decks d ON c.deck_id = d.id
      LEFT JOIN card_tags ct ON c.id = ct.card_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      WHERE c.id = ? AND d.user_id = ?
      GROUP BY c.id
    `;

    db.get(query, [id, userId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Card não encontrado ou não autorizado.' });

      const cardWithTags = {
        ...row,
        tags: row.tags_ids ? row.tags_ids.split(',').map((tagId, index) => ({
          id: parseInt(tagId),
          name: row.tags_names.split(',')[index]
        })) : []
      };
      delete cardWithTags.tags_names;
      delete cardWithTags.tags_ids;

      res.json(cardWithTags);
    });
  },

  updateCard: async (req, res) => {
    const { id } = req.params;
    const { front, back, tags } = req.body;
    const userId = req.user.id;

    const checkQuery = `
      SELECT c.* FROM cards c
      INNER JOIN decks d ON c.deck_id = d.id
      WHERE c.id = ? AND d.user_id = ?
    `;

    db.get(checkQuery, [id, userId], async (err, card) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!card) return res.status(404).json({ error: 'Card não encontrado ou não autorizado.' });

      const updateQuery = `
        UPDATE cards 
        SET front = ?, back = ?
        WHERE id = ?
      `;

      await new Promise((resolve, reject) => {
        db.run(updateQuery, [front || card.front, back || card.back, id], err => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (tags !== undefined) {
        try {
          await new Promise((resolve, reject) => {
            db.run('DELETE FROM card_tags WHERE card_id = ?', [id], err => {
              if (err) reject(err);
              else resolve();
            });
          });

          if (Array.isArray(tags) && tags.length > 0) {
            const tagPromises = tags.map(tagName => {
              return new Promise((resolve, reject) => {
                db.get('SELECT id FROM tags WHERE user_id = ? AND name = ?', [userId, tagName], (err, tagRow) => {
                  if (err) return reject(err);

                  if (tagRow) {
                    db.run('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)', [id, tagRow.id], err => {
                      if (err) reject(err);
                      else resolve();
                    });
                  } else {
                    db.run('INSERT INTO tags (user_id, name) VALUES (?, ?)', [userId, tagName], function (err) {
                      if (err) return reject(err);
                      const newTagId = this.lastID;
                      db.run('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)', [id, newTagId], err => {
                        if (err) reject(err);
                        else resolve();
                      });
                    });
                  }
                });
              });
            });
            await Promise.all(tagPromises);
          }

          res.json({ message: 'Card e tags atualizados com sucesso!' });
        } catch (tagError) {
          console.error('Erro ao atualizar tags do card:', tagError.message);
          res.status(500).json({ message: 'Card atualizado, mas houve um erro ao atualizar tags.', error: tagError.message });
        }
      } else {
        res.json({ message: 'Card atualizado com sucesso!' });
      }
    });
  },

  markCardDifficulty: (req, res) => {
    const { id } = req.params;
    const { rating } = req.body;
    const userId = req.user.id;

    if (![1, 2, 3, 4, 5].includes(rating)) {
      return res.status(400).json({ error: 'Rating deve ser um número de 1 a 5.' });
    }

    const checkQuery = `
      SELECT c.* FROM cards c
      INNER JOIN decks d ON c.deck_id = d.id
      WHERE c.id = ? AND d.user_id = ?
    `;

    db.get(checkQuery, [id, userId], (err, card) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!card) return res.status(404).json({ error: 'Card não encontrado ou não autorizado.' });

      const now = new Date();
      let nextReview;
      let newDifficulty;

      switch (rating) {
        case 1:
          newDifficulty = 'again';
          nextReview = addTime(now, 0, 10);
          break;
        case 2:
          newDifficulty = 'hard';
          nextReview = addTime(now, 1);
          break;
        case 3:
          newDifficulty = 'medium';
          nextReview = addTime(now, 3);
          break;
        case 4:
          newDifficulty = 'easy';
          nextReview = addTime(now, 7);
          break;
        case 5:
          newDifficulty = 'easy';
          nextReview = addTime(now, 14);
          break;
      }

      const updateQuery = `
        UPDATE cards 
        SET difficulty = ?, last_studied = ?, next_review = ?
        WHERE id = ?
      `;

      db.run(updateQuery, [newDifficulty, now.toISOString(), nextReview?.toISOString(), id], err => {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
          message: 'Dificuldade marcada com sucesso!',
          new_difficulty: newDifficulty,
          next_review: nextReview?.toISOString()
        });
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
      if (err) return res.status(500).json({ error: err.message });

      if (!card) {
        return res.status(404).json({ error: 'Card não encontrado ou não autorizado.' });
      }

      db.run('DELETE FROM cards WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({ message: 'Card deletado com sucesso.' });
      });
    });
  }
};

module.exports = cardsController;
