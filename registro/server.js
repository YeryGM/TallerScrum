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

    const lines = data.trim().split('\n');
    const [header, ...rows] = lines;

    // Convertir cada línea del archivo CSV en un objeto usuario
    const usuarios = rows.map(line => {
      const [nombre, emailField, passwordHash] = line.split(',');
      return { nombre, email: emailField, passwordHash };
    });

    const usuario = usuarios.find(u => u.email === email && u.passwordHash === password);

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
      return res.json({ ok: true, path: usuariosPathnmp });
    });
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor activo en http://localhost:${port}`));
