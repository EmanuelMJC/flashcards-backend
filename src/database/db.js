const sqlite3 = require('sqlite3').verbose();
const path = require('path');

if (!process.env.DB_FOLDER) {
  throw new Error("Variável de ambiente DB_FOLDER não definida.");
}

const dbPath = path.join(process.cwd(), process.env.DB_FOLDER, 'db.sqlite');

console.log('>> Usando banco de dados em:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
    }
});

db.run("PRAGMA foreign_keys = ON;");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      difficulty TEXT DEFAULT 'new', -- Pode ser 'new', 'again', 'hard', 'medium', 'easy'
      last_studied DATETIME,
      next_review DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deck_id) REFERENCES decks (id) ON DELETE CASCADE
    );
  `);

  // Novas funcionalidades: tags e relatório
  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(user_id, name), -- Garante que o usuário não tenha tags com o mesmo nome
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS card_tags (
      card_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (card_id, tag_id), -- Chave primária composta para evitar duplicação
      FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      deck_id INTEGER, -- NULLABLE: se a sessão foi iniciada por uma tag, não um deck
      tag_id INTEGER,  -- NULLABLE: se a sessão foi iniciada por um deck, não uma tag
      correct_count INTEGER NOT NULL,
      incorrect_count INTEGER NOT NULL,
      session_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (deck_id) REFERENCES decks (id) ON DELETE SET NULL, -- Se o deck for deletado, o histórico da sessão permanece, mas o deck_id é zerado
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE SET NULL,   -- Se a tag for deletada, o histórico da sessão permanece, mas o tag_id é zerado
      CHECK (deck_id IS NOT NULL OR tag_id IS NOT NULL) -- Garante que a sessão esteja associada a um deck OU a uma tag
    );
  `);
});

module.exports = db;
