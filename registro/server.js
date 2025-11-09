const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Servir archivos estáticos desde la carpeta Login (index.html, script.js, style.css)
app.use(express.static(path.join(__dirname, 'Login')));

// Responder GET / con el index.html del login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Login', 'index.html'));
});

// Ruta para tablero principal
app.get('/tablero', (req, res) => {
  res.sendFile(path.join(__dirname, 'Login', 'tablero.html'));
});

// Archivo de usuarios
const filePath = path.join(__dirname, 'Login', 'usuarios.txt');

// Escapar valores CSV
function escapeCsv(s) {
  if (s == null) return '';
  const str = String(s);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Leer usuarios desde el archivo
function readUsers() {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').slice(1); // Saltar encabezado
  return lines
    .filter(line => line.trim() !== '')
    .map(line => {
      const [nombre, email, passwordHash, createdAt] = line.split(',');
      return { nombre, email, passwordHash, createdAt };
    });
}

// Guardar usuarios en archivo
function saveUsers(users) {
  const header = 'nombre,email,passwordHash,createdAt';
  const lines = users.map(u => `${escapeCsv(u.nombre)},${escapeCsv(u.email)},${u.passwordHash},${u.createdAt}`);
  const content = [header, ...lines].join('\n');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// Registrar usuario
app.post('/register', (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre || !email || !password) return res.status(400).json({ error: 'missing_fields' });

  const users = readUsers();
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'email_exists' });
  }

  const newUser = {
    nombre,
    email,
    passwordHash: password, // en producción, hay que hashear la contraseña
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);
  res.json({ ok: true, user: newUser });
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.email === email && u.passwordHash === password);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  res.json({ ok: true, user });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
