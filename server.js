// server.js
const express = require('express');
const http = require('http');
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
app.use(express.static(path.join(__dirname, 'public')));

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

// El resto: servir index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
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
