const db = require('../database/db');

const reportsController = {
  recordStudySession: async (req, res) => {
    const { deckId, tagId, correctCount, incorrectCount } = req.body;
    const userId = req.user.id;

    if ((!deckId && !tagId) || correctCount === undefined || incorrectCount === undefined) {
      return res.status(400).json({ error: 'Dados da sessão incompletos. Requer deckId OU tagId, e correctCount e incorrectCount.' });
    }

    if (correctCount < 0 || incorrectCount < 0) {
      return res.status(400).json({ error: 'As contagens de acertos e erros não podem ser negativas.' });
    }

    if (deckId) {
      const deck = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM decks WHERE id = ? AND user_id = ?', [deckId, userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (!deck) {
        return res.status(404).json({ error: 'Deck não encontrado ou não autorizado.' });
      }
    }

    if (tagId) {
      const tag = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM tags WHERE id = ? AND user_id = ?', [tagId, userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (!tag) {
        return res.status(404).json({ error: 'Tag não encontrada ou não autorizada.' });
      }
    }
    
    try {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO study_sessions (user_id, deck_id, tag_id, correct_count, incorrect_count) VALUES (?, ?, ?, ?, ?)',
          [userId, deckId || null, tagId || null, correctCount, incorrectCount],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      res.status(201).json({ message: 'Sessão de estudo registrada com sucesso!', sessionId: this.lastID });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao registrar sessão de estudo.', error: error.message });
    }
  },

  getStudyHistory: (req, res) => {
    const userId = req.user.id;
    const { limit, offset, deckId, tagId } = req.query;

    let query = `
      SELECT ss.id, ss.correct_count, ss.incorrect_count, ss.session_date,
             d.name AS deck_name, d.id AS deck_id,
             t.name AS tag_name, t.id AS tag_id
      FROM study_sessions ss
      LEFT JOIN decks d ON ss.deck_id = d.id
      LEFT JOIN tags t ON ss.tag_id = t.id
      WHERE ss.user_id = ?
    `;
    const params = [userId];

    if (deckId) {
      query += ' AND ss.deck_id = ?';
      params.push(deckId);
    }
    if (tagId) {
      query += ' AND ss.tag_id = ?';
      params.push(tagId);
    }

    query += ' ORDER BY ss.session_date DESC'; 

    if (limit) {
        query += ' LIMIT ?';
        params.push(parseInt(limit));
    }
    if (offset) {
        query += ' OFFSET ?';
        params.push(parseInt(offset));
    }

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  },

  getOverallStats: (req, res) => {
    const userId = req.user.id;

    const query = `
      SELECT
        SUM(correct_count) AS total_correct,
        SUM(incorrect_count) AS total_incorrect,
        COUNT(id) AS total_sessions,
        MIN(session_date) AS first_session_date,
        MAX(session_date) AS last_session_date
      FROM study_sessions
      WHERE user_id = ?;
    `;

    db.get(query, [userId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(row);
    });
  },

  getStatsByDeck: (req, res) => {
    const userId = req.user.id;

    const query = `
      SELECT
        d.id AS deck_id,
        d.name AS deck_name,
        COUNT(ss.id) AS total_sessions_in_deck,
        SUM(ss.correct_count) AS total_correct_in_deck,
        SUM(ss.incorrect_count) AS total_incorrect_in_deck
      FROM decks d
      LEFT JOIN study_sessions ss ON d.id = ss.deck_id
      WHERE d.user_id = ?
      GROUP BY d.id, d.name
      ORDER BY d.name ASC;
    `;

    db.all(query, [userId], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  },

    getStatsByTag: (req, res) => {
        const userId = req.user.id;

        const query = `
            SELECT
                t.id AS tag_id,
                t.name AS tag_name,
                COUNT(ss.id) AS total_sessions_with_tag,
                SUM(ss.correct_count) AS total_correct_with_tag,
                SUM(ss.incorrect_count) AS total_incorrect_with_tag
            FROM tags t
            LEFT JOIN study_sessions ss ON t.id = ss.tag_id
            WHERE t.user_id = ?
            GROUP BY t.id, t.name
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

module.exports = reportsController;