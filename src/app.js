require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001; 

const authMiddleware = require('./middlewares/auth.middleware');

const authRoutes = require('./routes/auth.routes');
const decksRoutes = require('./routes/decks.routes');
const cardsRoutes = require('./routes/cards.routes');
const tagsRoutes = require('./routes/tags.routes');
const reportsRoutes = require('./routes/reports.routes'); 

app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api/auth', authRoutes);

app.use('/api/decks', authMiddleware, decksRoutes);
app.use('/api/cards', authMiddleware, cardsRoutes); 
app.use('/api/tags', authMiddleware, tagsRoutes);   
app.use('/api/reports', authMiddleware, reportsRoutes);

app.use((req, res, next) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

app.use((err, req, res, next) => {
  console.error(err.stack); 
  res.status(500).json({ message: 'Erro interno do servidor.', error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});