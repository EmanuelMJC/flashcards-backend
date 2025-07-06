const bcrypt = require('bcrypt');

const senha = 'senha123';
const hash = '$2a$10$0N7I4ZiyGlJBLbdZDuZ/JuUyMj4xKjzJAV9khzEReiRAwS/hyxPAG';

bcrypt.compare(senha, hash).then((result) => {
  console.log('Senha confere?', result);
});
