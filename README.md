# Decoreba API

API do aplicativo Decoreba - Sistema de flashcards com repetição espaçada.

## Tecnologias

- **Node.js** com **Express.js**
- **SQLite** para banco de dados
- **JWT** para autenticação
- **bcrypt** para hash de senhas
- **CORS** para gerenciamento de requisições cross-origin

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
- `difficulty` - TEXT DEFAULT 'new' ('new', 'again', 'hard', 'medium', 'easy')
- `last_studied` - DATETIME
- `next_review` - DATETIME
- `created_at` - DATETIME DEFAULT CURRENT_TIMESTAMP

### Tabela: tags
- `id` - INTEGER PRIMARY KEY AUTOINCREMENT
- `user_id` - INTEGER NOT NULL (FK para users)
- `name` - TEXT NOT NULL UNIQUE (para o mesmo user_id)

### Tabela: card_tags
- `card_id` - INTEGER NOT NULL (FK para cards, ON DELETE CASCADE)
- `tag_id` - INTEGER NOT NULL (FK para tags, ON DELETE CASCADE)
- PRIMARY KEY (card_id, tag_id) - Garante unicidade da associaçã

### Tabela: study_sessions
- `id` - INTEGER PRIMARY KEY AUTOINCREMENT
- `user_id` - INTEGER NOT NULL (FK para users)
- `deck_id` - INTEGER (FK para decks, NULLable se for por tag)
- `tag_id` - INTEGER (FK para tags, NULLable se for por deck)
- `correct_count` - INTEGER NOT NULL
- `incorrect_count` - INTEGER NOT NULL
- `session_date` - DATETIME DEFAULT CURRENT_TIMESTAMP

## Endpoints da API
> **Todas as rotas, exceto POST /auth/register e POST /auth/login, requerem autenticação via Bearer Token**

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

#### GET /decks
Lista todos os decks do usuário autenticado, incluindo contagem total de cards e cards prontos para revisão.

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
Lista todos os cards de um deck específico, incluindo suas tags associadas.

#### POST /decks/:deckId/cards
Cria um novo card em um deck. Pode incluir tags (nomes das tags). Se a tag não existir, ela será criada e associada.

**Body:**
```json
{
  "front": "Hello",
  "back": "Olá",
  "tags": ["Vocabulário", "Saudações"]
}
```

### Cards (Flashcards)

#### GET /cards/:id
Obtém um card específico por ID, incluindo suas tags associadas.

#### PUT /cards/:id
Atualiza um card existente. Pode atualizar front, back e as tags (substituindo associações existentes).

**Body:**
```json
{
  "front": "Good morning",
  "back": "Bom dia",
  "tags": ["Vocabulário", "Manhã"] 
}
```

#### DELETE /cards/:id
Remove um card.

#### POST /cards/:id/difficulty
Marca a dificuldade de um card após o estudo com um rating de 1 a 5.

**Body:**
```json
{
  "rating": 3 // 1: Não lembrei/errei, 2: Difícil, 3: Lembrei com ressalvas, 4: Fácil, 5: Na ponta da língua
}
```
**Response (exemplo):**
``` JSON
{ 
  "message": "Dificuldade marcada com sucesso!",
  "new_difficulty": "medium",
  "next_review": "2023-11-01T15:30:00.000Z"
}
```

#### POST /decks/cards/:cardId/reset-progress
Reseta o progresso de estudo de um card individual (difficulty='new', last_studied=NULL, next_review=NULL).

#### POST /decks/:deckId/reset-progress
Reseta o progresso de estudo de todos os cards de um deck específico.

### Estudo

#### GET /decks/:deckId/study
Retorna cards prontos para revisão de um deck específico, ordenados pela lógica de SRS. Inclui tags dos cards.

#### GET /decks/study/tag/:tagId
Retorna cards prontos para revisão associados a uma tag específica, ordenados pela lógica de SRS. Inclui tags dos cards.

### Tags

#### GET /tags
Lista todas as tags criadas pelo usuário autenticado.

#### GET /tags/card/:cardId
Lista todas as tags associadas a um card específico.

#### POST /tags
Cria uma nova tag para o usuário.

**Body:**
``` JSON
{
  "name": "Programação"
}
```

#### POST /tags/card/:cardId
Associa uma tag existente a um card.

**Body:**
``` JSON
{
  "tagId": 5 // ID da tag a ser associada
}
```

#### DELETE /tags/:id
Remove uma tag. Todas as associações card_tags com esta tag serão removidas automaticamente.

#### DELETE /tags/card/:cardId/:tagId
Remove a associação de uma tag específica a um card.

### Relatórios e Estatísticas
#### POST /reports/sessions
Registra uma nova sessão de estudo.

**Body (exemplo - por deck):**
``` JSON
{
  "deckId": 1,
  "correctCount": 10,
  "incorrectCount": 2
}
```

**Body (exemplo - por tag):**
``` JSON
{
  "tagId": 3,
  "correctCount": 5,
  "incorrectCount": 1
}
```

#### GET /reports/history
Obtém o histórico de todas as sessões de estudo do usuário. Suporta filtros por deckId, tagId, limit e offset.

#### Query Params (exemplo):
GET /reports/history?deckId=1&limit=10&offset=0

#### GET /reports/stats/overall
Retorna estatísticas gerais de estudo do usuário (total de acertos, erros, sessões).

#### GET /reports/stats/decks
Retorna estatísticas de estudo agrupadas por deck.

#### GET /reports/stats/tags
Retorna estatísticas de estudo agrupadas por tag.

## Autenticação

Para acessar rotas protegidas, inclua o token JWT no header:

```
Authorization: Bearer seu_jwt_token_aqui
```

## Sistema de Repetição Espaçada

O sistema implementa repetição espaçada baseada em 5 níveis de dificuldade, ajustando a data da próxima revisão dinamicamente:

1. **Rating 1: "Não lembrei/errei" (difficulty: 'again'):** Em 10 minutos
2. **Rating 2: "Díficil de lembrar/Lembrei só algumas partes" (difficulty: 'hard'):** Em 1 dia
3. **Rating 3: "Lembrei, mas esqueci alguns pontos" (difficulty: 'medium'):** Em 3 dias 
4. **Rating 4: "Foi fácil de lembrar" (difficulty: 'easy'):** Em 7 dias
5. **Rating 5: "A resposta está na ponta da língua" (difficulty: 'easy'):** Em 14 dias

O algoritmo considera:
- Cards marcados como new (nunca estudados) ou again são priorizados.
- Cards com `next_review` vencido ou null são retornados
- Ordenação por difficulty e next_review para garantir a melhor sequência de estudo.

## Fluxo de Uso

1. Registro/Login - Criar conta e obter token de autenticação.
2. Gerenciar Decks - Criar, visualizar, atualizar e deletar baralhos para organizar cards.
3. Gerenciar Tags - Criar, visualizar e deletar tags para categorizar cards de forma flexível.
4. Adicionar Cards - Criar flashcards em um deck, associando-os a uma ou mais tags no momento da criação ou posteriormente.
5. Estudar por Deck ou Tag - Usar /decks/:deckId/study ou /decks/study/tag/:tagId para obter cards prontos para revisão.
6. Marcar Dificuldade - Após estudar cada card, marcar sua dificuldade (rating 1-5) para agendar a próxima revisão.
7. Monitorar Progresso - Consultar os endpoints /reports para visualizar histórico de sessões e estatísticas gerais ou por deck/tag.
8. Resetar Progresso - Caso necessário, resetar o progresso de estudo de cards individuais ou de um deck inteiro.

## Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure as seguintes variáveis:

```env
PORT=3000
DATABASE_URL=./src/database/decoreba.sqlite
JWT_SECRET=sua_chave_secreta_super_forte_aqui
``