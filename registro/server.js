const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Servir archivos estáticos desde la carpeta Registro (index.html, script.js, style.css)
app.use(express.static(path.join(__dirname, 'Login')));

// Responder GET / con el index.html para que http://localhost:3000/ muestre la página
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Login', 'index.html'));
});

// Escrbir en registro/Registro/usuarios.txt (relativo a esta carpeta)
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
app.listen(port, () => console.log(`Registro server listening on http://localhost:${port}`));
