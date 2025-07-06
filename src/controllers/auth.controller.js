const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

const authController = {
  register: async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Preencha todos os campos.' });
    }

    try {
      const existingUser = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (existingUser) {
        return res.status(409).json({ message: 'Usuário ou e-mail já cadastrado.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          [username, email, hashedPassword],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao registrar usuário.', error: error.message });
    }
  },

  login: async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }

    try {
      console.log('Tentando login com:', email, password);

      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      console.log('Usuário retornado do banco:', user);

      if (!user) {
        console.log('Nenhum usuário encontrado com esse e-mail.');
        return res.status(401).json({ message: 'Credenciais inválidas.' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      console.log('Senha válida?', isPasswordValid);

      if (!isPasswordValid) {
        console.log('Senha incorreta.');
        return res.status(401).json({ message: 'Credenciais inválidas.' });
      }

      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
      );

      console.log('Login bem-sucedido. Token gerado.');

      res.json({
        message: 'Login realizado com sucesso!',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ message: 'Erro ao fazer login.', error: error.message });
    }
  }
};

module.exports = authController;
