# Decoreba API

API do aplicativo Decoreba - Sistema de flashcards com repetição espaçada.

## Tecnologias

- **Node.js** com **Express.js**
- **SQLite** para banco de dados
- **JWT** para autenticação
- **bcrypt** para hash de senhas

## Instalação

1. **Clone o repositório e instale as dependências:**
   ```bash
   npm install
   ```

2. **Configure as variáveis de ambiente:**
   ```bash
   # Copie o arquivo de exemplo
   cp .env.example .env
   
   # Edite o arquivo .env com suas configurações
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

## Estrutura do Banco de Dados

### Tabela: users
- `id` - INTEGER PRIMARY KEY AUTOINCREMENT
- `username` - TEXT NOT NULL UNIQUE
- `email` - TEXT NOT NULL UNIQUE
- `password` - TEXT NOT NULL (hash bcrypt)

### Tabela: decks
- `id` - INTEGER PRIMARY KEY AUTOINCREMENT
- `user_id` - INTEGER NOT NULL (FK para users)
- `name` - TEXT NOT NULL
- `description` - TEXT
- `created_at` - DATETIME DEFAULT CURRENT_TIMESTAMP

### Tabela: cards
- `id` - INTEGER PRIMARY KEY AUTOINCREMENT
- `deck_id` - INTEGER NOT NULL (FK para decks)
- `front` - TEXT NOT NULL (frente do card)
- `back` - TEXT NOT NULL (verso do card)
- `difficulty` - TEXT DEFAULT 'new' ('new', 'easy', 'medium', 'hard')
- `last_studied` - DATETIME
- `next_review` - DATETIME
- `created_at` - DATETIME DEFAULT CURRENT_TIMESTAMP

## Endpoints da API

### Autenticação

#### POST /auth/register
Registra um novo usuário.

**Body:**
```json
{
  "username": "usuario",
  "email": "usuario@email.com",
  "password": "senha123"
}
```

#### POST /auth/login
Autentica um usuário e retorna JWT token.

**Body:**
```json
{
  "email": "usuario@email.com",
  "password": "senha123"
}
```

**Response:**
```json
{
  "message": "Login realizado com sucesso!",
  "token": "jwt_token_aqui",
  "user": {
    "id": 1,
    "username": "usuario",
    "email": "usuario@email.com"
  }
}
```

### Decks (Baralhos)

> **Todas as rotas de decks requerem autenticação via Bearer Token**

#### GET /decks
Lista todos os decks do usuário autenticado.

#### GET /decks/:id
Obtém um deck específico por ID.

#### POST /decks
Cria um novo deck.

**Body:**
```json
{
  "name": "Inglês Básico",
  "description": "Vocabulário básico de inglês"
}
```

#### PUT /decks/:id
Atualiza um deck existente.

#### DELETE /decks/:id
Remove um deck e todos os cards associados.

#### GET /decks/:deckId/study
Retorna cards prontos para revisão baseado na repetição espaçada.

**Lógica de repetição:**
- Cards `new`: sempre retornados
- Cards `easy`: revisão após 4 dias
- Cards `medium`: revisão após 2 dias
- Cards `hard`: revisão após 1 dia

#### GET /decks/:deckId/cards
Lista todos os cards de um deck específico.

#### POST /decks/:deckId/cards
Cria um novo card em um deck.

**Body:**
```json
{
  "front": "Hello",
  "back": "Olá"
}
```

### Cards (Flashcards)

> **Todas as rotas de cards requerem autenticação via Bearer Token**

#### GET /cards/:id
Obtém um card específico por ID.

#### PUT /cards/:id
Atualiza um card existente.

**Body:**
```json
{
  "front": "Good morning",
  "back": "Bom dia",
  "difficulty": "easy"
}
```

#### DELETE /cards/:id
Remove um card.

#### POST /cards/:id/difficulty
Marca a dificuldade de um card após o estudo.

**Body:**
```json
{
  "difficulty": "easy" // "easy", "medium" ou "hard"
}
```

## Autenticação

Para acessar rotas protegidas, inclua o token JWT no header:

```
Authorization: Bearer seu_jwt_token_aqui
```

## Sistema de Repetição Espaçada

O sistema implementa repetição espaçada baseada na dificuldade:

1. **Cards novos** (`new`): Sempre aparecem para estudo
2. **Cards fáceis** (`easy`): Revisão após 4 dias
3. **Cards médios** (`medium`): Revisão após 2 dias  
4. **Cards difíceis** (`hard`): Revisão após 1 dia

O algoritmo considera:
- Cards marcados como `new` sempre são priorizados
- Cards com `next_review` vencido ou null
- Ordenação por dificuldade e data de próxima revisão

## Fluxo de Uso

1. **Registro/Login** - Criar conta e obter token
2. **Criar Deck** - Organizar cards por tema
3. **Adicionar Cards** - Criar flashcards no deck
4. **Estudar** - Usar `/decks/:id/study` para obter cards para revisão
5. **Marcar Dificuldade** - Após estudar cada card, marcar como easy/medium/hard
6. **Repetição** - Sistema automaticamente agenda próximas revisões

## Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure as seguintes variáveis:

```env
PORT=3000
DATABASE_URL=./src/database/decoreba.sqlite
JWT_SECRET=sua_chave_secreta_super_forte_aqui
``