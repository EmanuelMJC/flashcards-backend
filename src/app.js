require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors'); 

app.use(cors());


app.use(express.json());

app.use('/auth', require('./routes/auth.routes'));
app.use('/decks', require('./routes/decks.routes'));
app.use('/cards', require('./routes/cards.routes'));
app.use('/tags', require('./routes/tags.routes'));
app.use('/reports', require('./routes/reports.routes')); 

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

