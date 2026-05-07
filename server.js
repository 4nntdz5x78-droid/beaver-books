const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

const FRONTEND = path.join(__dirname, 'frontend');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(FRONTEND));
app.use(express.static(__dirname));

app.use('/leads',    require('./routes/leads'));
app.use('/admin',    require('./routes/admin'));
app.use('/books',    require('./books'));
app.use('/orders',   require('./orders'));
app.use('/payments', require('./payments'));

app.get('/catalogo.html', (req, res) => res.sendFile(path.join(FRONTEND, 'catalogo.html')));
app.get('/catalogo',      (req, res) => res.sendFile(path.join(FRONTEND, 'catalogo.html')));
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
});
