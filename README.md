# 📚 Beaver Books — Backend de Leads

## Estrutura do projeto

```
beaver-books-backend/
├── server.js          ← servidor principal
├── database.js        ← conexão com o banco
├── routes/
│   ├── leads.js       ← recebe o formulário
│   └── admin.js       ← API do painel admin
├── views/
│   └── admin.html     ← painel visual
├── .env               ← suas credenciais (NUNCA subir pro GitHub)
├── .env.example       ← modelo do .env
├── .gitignore
└── package.json
```

---

## PASSO 1 — Instalar dependências

```powershell
npm install
```

---

## PASSO 2 — Criar o banco no Supabase

1. Acesse https://supabase.com e crie uma conta gratuita
2. Crie um novo projeto chamado `beaver-books`
3. Vá em **SQL Editor** e rode o seguinte SQL:

```sql
CREATE TABLE leads (
  id          SERIAL PRIMARY KEY,
  criado_em   TIMESTAMP DEFAULT NOW(),
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL,
  whatsapp    TEXT,
  cidade      TEXT,
  objetivo    TEXT,
  genero      TEXT,
  finalizado  TEXT,
  paginas     INTEGER,
  obj_livro   TEXT,
  prazo       TEXT,
  mensagem    TEXT,
  arquivo     TEXT,
  anotacao    TEXT,
  status      TEXT DEFAULT 'novo'
);
```

4. Vá em **Settings → Database → Connection String → URI**
5. Copie a string — vai parecer assim:
   `postgresql://postgres:SUA_SENHA@db.XXXX.supabase.co:5432/postgres`

---

## PASSO 3 — Configurar o .env

1. Renomeie o arquivo `.env.example` para `.env`
2. Preencha cada campo:

```env
DATABASE_URL=postgresql://postgres:SUA_SENHA@db.XXXX.supabase.co:5432/postgres
PORT=3000
ADMIN_SENHA=escolha_uma_senha_forte_aqui
EMAIL_USER=seugmail@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
EMAIL_DESTINO=equipe@beaverbooks.com.br
ADMIN_URL=https://beaver-books-backend.up.railway.app/admin
```

### Como gerar a senha de App do Gmail (EMAIL_PASS):
1. Acesse https://myaccount.google.com
2. Vá em **Segurança → Verificação em duas etapas** (ative se não tiver)
3. Volte em **Segurança → Senhas de app**
4. Selecione "Outro (nome personalizado)" → escreva "Beaver Books" → Gerar
5. Copie os 16 caracteres gerados (ex: `abcd efgh ijkl mnop`)
6. Cole no EMAIL_PASS do .env

---

## PASSO 4 — Testar localmente

```powershell
node server.js
```

Acesse: http://localhost:3000/admin

---

## PASSO 5 — Deploy no Railway

1. Crie uma conta em https://railway.app (pode entrar com GitHub)
2. Crie um repositório no GitHub:
   ```powershell
   git init
   git add .
   git commit -m "primeiro commit"
   ```
   Depois suba para o GitHub normalmente.

3. No Railway: **New Project → Deploy from GitHub Repo**
4. Selecione seu repositório
5. Vá em **Variables** e adicione todas as variáveis do seu .env
6. O Railway vai gerar uma URL pública automaticamente

7. Copie essa URL e atualize o ADMIN_URL no Railway Variables

---

## PASSO 6 — Conectar o formulário ao backend

No arquivo `contato-beaver-books.html`, localize a função `handleSubmit`
e substitua a URL do fetch pela URL gerada pelo Railway:

```javascript
const res = await fetch('https://SEU-PROJETO.up.railway.app/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(dados)
});
```

---

## Status dos leads

| Status       | Significado                        |
|--------------|------------------------------------|
| 🔵 novo      | Recém chegou, aguardando contato   |
| 🟡 em_contato| Equipe já entrou em contato        |
| 🟢 publicando| Autor fechou contrato              |
| ⚫ encerrado  | Atendimento finalizado             |

---

## Dúvidas?

Abra o painel em `/admin` e use a senha definida em `ADMIN_SENHA` do .env.
