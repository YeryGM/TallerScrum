// init_db.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./kanban.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium',
      status TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insertar datos de ejemplo si no hay tareas
  db.get("SELECT COUNT(*) as cnt FROM tasks", (err, row) => {
    if (err) throw err;
    if (row.cnt === 0) {
      const stmt = db.prepare("INSERT INTO tasks (title, description, priority, status, position) VALUES (?, ?, ?, ?, ?)");
      stmt.run("Planificar Sprint", "Definir alcance y objetivos del próximo sprint", "high", "todo", 1);
      stmt.run("Diseñar esquema DB", "Modelo de entidades y relaciones", "medium", "todo", 2);
      stmt.run("Implementar API", "Desarrollar endpoints iniciales", "high", "doing", 1);
      stmt.run("Tests unitarios", "Agregar pruebas unitarias para componentes", "low", "doing", 2);
      stmt.run("Deploy staging", "Preparar despliegue en ambiente de staging", "medium", "done", 1);
      stmt.run("Documentación", "Escribir documentación técnica", "low", "done", 2);
      stmt.finalize(() => {
        console.log("Tareas demo creadas con prioridades.");
        db.close();
      });
    } else {
      console.log("La base de datos ya tiene tareas.");
      db.close();
    }
  });
});