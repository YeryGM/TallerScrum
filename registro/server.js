const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// === Servir archivos estáticos de ambas carpetas ===
app.use('/login', express.static(path.join(__dirname, 'Login')));
app.use('/registro', express.static(path.join(__dirname, 'Registro')));

// === Redirigir raíz "/" al login ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Registro', 'index.html'));
  res.redirect('/login');
});

// === Servir la página principal del login ===
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'Login', 'index.html'));
});

// === Endpoint para guardar usuarios (de Registro) ===
const filePath = path.join(__dirname, 'Registro', 'usuarios.txt');

function escapeCsv(s) {
  if (s == null) return '';
  const str = String(s);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

app.post('/save-users', (req, res) => {
  const users = req.body && req.body.users;
  if (!Array.isArray(users)) return res.status(400).json({ error: 'invalid_payload' });

  const header = 'nombre,email,passwordHash,createdAt';
  const lines = users.map(u => `${escapeCsv(u.nombre)},${escapeCsv(u.email)},${u.passwordHash},${u.createdAt}`);
  const content = [header, ...lines].join('\n');

  fs.mkdir(path.dirname(filePath), { recursive: true }, (mkErr) => {
    if (mkErr) console.warn('mkdir warning', mkErr);
    fs.writeFile(filePath, content, 'utf8', (err) => {
      if (err) {
        console.error('Write error', err);
        return res.status(500).json({ error: 'write_failed' });
      }
      return res.json({ ok: true, path: filePath });
    });
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor activo en http://localhost:${port}`));
