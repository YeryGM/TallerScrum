const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// === Servir archivos estáticos de ambas carpetas ===
app.use('/login', express.static(path.join(__dirname, 'Login')));
app.use('/registro', express.static(path.join(__dirname, 'Registro')));
app.get('/tablero', (req, res) => {
  res.sendFile(path.join(__dirname, 'Login', 'tablero.html'));
});

// === Redirigir raíz "/" al login ===
app.get('/', (req, res) => {
  res.redirect('/login');
});

// === Endpoint para guardar usuarios (de Registro) ===
const usuariosPath = path.join(__dirname, 'Registro', 'usuarios.txt');

// === Servir la página principal del login ===
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  fs.readFile(usuariosPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer usuarios.txt', err);
      return res.status(500).json({ error: 'read_failed' });
    }

    const lines = data.trim().split('\n').filter(Boolean);
    if (lines.length <= 1) return res.status(401).json({ ok: false, error: 'No users' });
    const [header, ...rows] = lines;

    // simple CSV line parser that supports quoted fields
    function parseCsvLine(line) {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      result.push(cur);
      return result;
    }

    function normalizeEmail(emailStr) {
      const e = (emailStr || '').trim().toLowerCase();
      const parts = e.split('@');
      if (parts.length !== 2) return e;
      let [local, domain] = parts;
      if (domain === 'gmail.com' || domain === 'googlemail.com') {
        const plus = local.indexOf('+');
        if (plus !== -1) local = local.substring(0, plus);
        local = local.replace(/\./g, '');
      }
      return `${local}@${domain}`;
    }

    const usuarios = rows.map(line => {
      const parts = parseCsvLine(line);
      const nombre = parts[0] || '';
      const emailField = parts[1] || '';
      const passwordHash = parts[2] || '';
      const createdAt = parts[3] || '';
      return { nombre, email: emailField, passwordHash, createdAt };
    });

    const targetCanonical = normalizeEmail(email);
    // Hash the provided password with SHA-256 to compare with stored hash
    const providedHash = crypto.createHash('sha256').update(String(password)).digest('hex');

    const usuario = usuarios.find(u => normalizeEmail(u.email) === targetCanonical && u.passwordHash === providedHash);

    if (usuario) {
      res.json({ ok: true, nombre: usuario.nombre });
    } else {
      res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    }
  });
});

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

  fs.mkdir(path.dirname(usuariosPath), { recursive: true }, (mkErr) => {
    if (mkErr) console.warn('mkdir warning', mkErr);
    fs.writeFile(usuariosPath, content, 'utf8', (err) => {
      if (err) {
        console.error('Write error', err);
        return res.status(500).json({ error: 'write_failed' });
      }
      return res.json({ ok: true, path: usuariosPath });
    });
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor activo en http://localhost:${port}`));
