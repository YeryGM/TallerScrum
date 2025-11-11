// server.js
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

const db = new sqlite3.Database('./kanban.db');

app.use(cors());
app.use(bodyParser.json());
// Serve the Kanban app under /kanban (use the Funcionres-Tareas implementation)
app.use('/kanban', express.static(path.join(__dirname, 'Funcionres-Tareas', 'public')));

// --- Integrate registro (login/registro) static and API endpoints ---
app.use('/registro', express.static(path.join(__dirname, 'registro', 'Registro')));
app.use('/login', express.static(path.join(__dirname, 'registro', 'Login')));

const usuariosPath = path.join(__dirname, 'registro', 'Registro', 'usuarios.txt');

function escapeCsv(s) {
  if (s == null) return '';
  const str = String(s);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

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

// POST /save-users: overwrite usuarios.txt with provided array {nombre,email,passwordHash,createdAt}
app.post('/save-users', (req, res) => {
  const users = req.body && req.body.users;
  if (!Array.isArray(users)) return res.status(400).json({ error: 'invalid_payload' });
  const header = 'nombre,email,passwordHash,createdAt';
  const lines = users.map(u => `${escapeCsv(u.nombre)},${escapeCsv(u.email)},${u.passwordHash},${u.createdAt}`);
  const content = [header, ...lines].join('\n');
  fs.mkdir(path.dirname(usuariosPath), { recursive: true }, (mkErr) => {
    if (mkErr) console.warn('mkdir warning', mkErr);
    fs.writeFile(usuariosPath, content, 'utf8', (err) => {
      if (err) { console.error('Write error', err); return res.status(500).json({ error: 'write_failed' }); }
      return res.json({ ok: true, path: usuariosPath });
    });
  });
});

// POST /login: accepts {email, password} (password plain), compares SHA-256 hashed password with stored hash
const crypto = require('crypto');
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });
  fs.readFile(usuariosPath, 'utf8', (err, data) => {
    if (err) { console.error('Error reading usuarios.txt', err); return res.status(500).json({ error: 'read_failed' }); }
    const lines = data.trim().split('\n').filter(Boolean);
    if (lines.length <= 1) return res.status(401).json({ ok: false, error: 'No users' });
    const [header, ...rows] = lines;
    const usuarios = rows.map(line => {
      const parts = parseCsvLine(line);
      return { nombre: parts[0] || '', email: parts[1] || '', passwordHash: parts[2] || '', createdAt: parts[3] || '' };
    });
    const targetCanonical = normalizeEmail(email);
    const providedHash = crypto.createHash('sha256').update(String(password)).digest('hex');
    const usuario = usuarios.find(u => normalizeEmail(u.email) === targetCanonical && u.passwordHash === providedHash);
    if (usuario) return res.json({ ok: true, nombre: usuario.nombre });
    return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
  });
});

// /tablero should redirect to the kanban app
app.get('/tablero', (req, res) => res.redirect('/kanban'));

// Serve login page at root '/'
app.get('/', (req, res) => {
  return res.sendFile(path.join(__dirname, 'registro', 'Login', 'index.html'));
});

// Obtener todas las tareas (agrupadas por estado)
app.get('/api/tasks', (req, res) => {
  db.all("SELECT * FROM tasks ORDER BY status, position ASC, id ASC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Crear tarea
app.post('/api/tasks', (req, res) => {
  const { title, description = '', status = 'todo' } = req.body;
  // obtener max position en esa columna
  db.get("SELECT COALESCE(MAX(position), 0) + 1 as nextpos FROM tasks WHERE status = ?", [status], (err, r) => {
    if (err) return res.status(500).json({ error: err.message });
    const position = r.nextpos;
    db.run("INSERT INTO tasks (title, description, status, position) VALUES (?, ?, ?, ?)", [title, description, status, position], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const inserted = { id: this.lastID, title, description, status, position };
      io.emit('task:created', inserted);
      res.json(inserted);
    });
  });
});

// Actualizar estado y posición de tarea (drag & drop)
app.put('/api/tasks/:id/move', (req, res) => {
  const id = req.params.id;
  const { status, position } = req.body;

  if (!status || typeof position !== 'number') {
    return res.status(400).json({ error: "status y position son requeridos" });
  }

  // Actualizamos la tarea solicitada con nuevo estado y posición
  db.run("UPDATE tasks SET status = ?, position = ? WHERE id = ?", [status, position, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    // Re-normalizar posiciones en la columna de origen y destino
    // Simplificación: quien hace el cambio le enviará un evento para que todos hagan refresh parcial.
    db.get("SELECT * FROM tasks WHERE id = ?", [id], (err2, updated) => {
      if (err2) return res.status(500).json({ error: err2.message });
      io.emit('task:moved', updated);
      res.json(updated);
    });
  });
});

// Actualizar una tarea (titulo, descripcion, prioridad, status)
app.put('/api/tasks/:id', (req, res) => {
  const id = req.params.id;
  const { title, description, priority, status } = req.body;

  // Construir query dinámicamente según campos presentes
  const sets = [];
  const params = [];
  if (typeof title !== 'undefined') { sets.push('title = ?'); params.push(title); }
  if (typeof description !== 'undefined') { sets.push('description = ?'); params.push(description); }
  if (typeof priority !== 'undefined') { sets.push('priority = ?'); params.push(priority); }
  if (typeof status !== 'undefined') { sets.push('status = ?'); params.push(status); }

  if (sets.length === 0) return res.status(400).json({ error: 'no_fields' });

  params.push(id);
  const sql = `UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`;
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM tasks WHERE id = ?', [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      io.emit('task:updated', row);
      res.json(row);
    });
  });
});

// Eliminar tarea
app.delete('/api/tasks/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('task:deleted', Number(id));
    res.json({ ok: true });
  });
});

// Endpoint opcional para reordenar posiciones en una columna (cuando sueltas, cliente puede enviar array)
app.put('/api/tasks/reorder', (req, res) => {
  const { tasks } = req.body; // tasks: [{id, status, position}, ...]
  if (!Array.isArray(tasks)) return res.status(400).json({ error: "tasks debe ser array" });

  const stmt = db.prepare("UPDATE tasks SET status = ?, position = ? WHERE id = ?");
  db.serialize(() => {
    tasks.forEach(t => stmt.run([t.status, t.position, t.id]));
    stmt.finalize(err => {
      if (err) return res.status(500).json({ error: err.message });
      db.all("SELECT * FROM tasks ORDER BY status, position ASC", (err2, rows) => {
        if (err2) return res.status(500).json({ error: err2.message });
        io.emit('tasks:reordered', rows);
        res.json(rows);
      });
    });
  });
});

// SPA fallback for Kanban app URLs
app.get('/kanban*', (req, res) => {
  res.sendFile(path.join(__dirname, 'Funcionres-Tareas', 'public', 'index.html'));
});

// Socket.IO (si quieres manejar conexiones en tiempo real)
io.on('connection', (socket) => {
  console.log('Cliente conectado', socket.id);
  socket.on('disconnect', () => {
    console.log('Cliente desconectado', socket.id);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
