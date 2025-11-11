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

// Clase Task para el servidor
class Task {
  constructor(id, title, description, priority, status, createdAt) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.priority = priority || 'medium';
    this.status = status || 'todo';
    this.createdAt = createdAt || new Date().toISOString();
  }

  static fromDB(row) {
    return new Task(
      row.id,
      row.title,
      row.description,
      row.priority,
      row.status,
      row.created_at
    );
  }

  toDB() {
    return {
      title: this.title,
      description: this.description,
      priority: this.priority,
      status: this.status,
      created_at: this.createdAt
    };
  }
}

// Clase TaskManager para el servidor
class TaskManager {
  constructor(db) {
    this.db = db;
  }

 createTask(taskData, callback) {
    const task = new Task(
        null,
        taskData.title,
        taskData.description,
        taskData.priority,
        taskData.status || 'todo'
    );

    // Obtener la máxima posición para el status
    this.db.get(
        "SELECT COALESCE(MAX(position), 0) as maxPos FROM tasks WHERE status = ?", 
        [task.status],
        (err, row) => {
            if (err) return callback(err);
            
            const newPosition = row.maxPos + 1;
            
            const sql = `INSERT INTO tasks (title, description, priority, status, position, created_at) 
                         VALUES (?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [
                task.title,
                task.description,
                task.priority,
                task.status,
                newPosition,
                task.createdAt
            ], function(err) {
                if (err) return callback(err);
                
                // Obtener la tarea recién creada
                this.db.get("SELECT * FROM tasks WHERE id = ?", [this.lastID], (err, row) => {
                    if (err) return callback(err);
                    callback(null, Task.fromDB(row));
                });
            });
        }
    );
}

  getAllTasks(callback) {
    this.db.all("SELECT * FROM tasks ORDER BY status, position ASC", (err, rows) => {
      if (err) return callback(err);
      const tasks = rows.map(row => Task.fromDB(row));
      callback(null, tasks);
    });
  }

  updateTask(id, updates, callback) {
    console.log('Actualizando tarea:', id, updates);
    
    const allowedFields = ['title', 'description', 'priority', 'status', 'position'];
    const setClause = [];
    const values = [];

    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            setClause.push(`${key} = ?`);
            values.push(updates[key]);
        }
    });

    if (setClause.length === 0) {
        return callback(new Error('No valid fields to update'));
    }

    values.push(id);
    const sql = `UPDATE tasks SET ${setClause.join(', ')} WHERE id = ?`;

    this.db.run(sql, values, function(err) {
        if (err) return callback(err);
        
        // Obtener la tarea actualizada
        db.get("SELECT * FROM tasks WHERE id = ?", [id], (err, row) => {
            if (err) return callback(err);
            if (!row) return callback(new Error('Tarea no encontrada'));
            
            const updatedTask = Task.fromDB(row);
            callback(null, updatedTask);
        });
    });
} 

  deleteTask(id, callback) {
    this.db.run("DELETE FROM tasks WHERE id = ?", [id], function(err) {
      if (err) return callback(err);
      callback(null, { changes: this.changes });
    });
  }

  reorderTasks(tasks, callback) {
    const stmt = this.db.prepare("UPDATE tasks SET status = ?, position = ? WHERE id = ?");
    
    this.db.serialize(() => {
      tasks.forEach(t => stmt.run([t.status, t.position, t.id]));
      stmt.finalize(err => {
        if (err) return callback(err);
        callback(null, { updated: tasks.length });
      });
    });
  }
}

// Inicializar TaskManager
const taskManager = new TaskManager(db);

// Endpoints de la API
app.get('/api/tasks', (req, res) => {
  taskManager.getAllTasks((err, tasks) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(tasks);
  });
});

app.post('/api/tasks', (req, res) => {
  const { title, description, priority, status } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: "El título es obligatorio" });
  }

  taskManager.createTask({ title, description, priority, status }, (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('task:created', task);
    res.json(task);
  });
});

app.put('/api/tasks/:id', (req, res) => {
  const id = req.params.id;
  taskManager.updateTask(id, req.body, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.changes === 0) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }
    
    // Obtener la tarea actualizada para emitir
    db.get("SELECT * FROM tasks WHERE id = ?", [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('task:updated', Task.fromDB(row));
      res.json(Task.fromDB(row));
    });
  });
});

app.delete('/api/tasks/:id', (req, res) => {
  const id = req.params.id;
  taskManager.deleteTask(id, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.changes === 0) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }
    io.emit('task:deleted', id);
    res.json({ message: "Tarea eliminada", id });
  });
});

app.put('/api/tasks/reorder', (req, res) => {
  const { tasks } = req.body;
  
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: "Se esperaba un array de tareas" });
  }

  taskManager.reorderTasks(tasks, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    taskManager.getAllTasks((err, allTasks) => {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('tasks:reordered', allTasks);
      res.json(allTasks);
    });
  });
});

// Servir archivos estáticos
app.use(express.static('public'));

// Socket.IO para tiempo real
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});