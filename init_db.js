// init_db.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./kanban.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insertar demo si no hay tareas
  db.get("SELECT COUNT(*) as cnt FROM tasks", (err, row) => {
    if (err) throw err;
    if (row.cnt === 0) {
      const stmt = db.prepare("INSERT INTO tasks (title, description, status, position) VALUES (?, ?, ?, ?)");
      stmt.run("Planificar Sprint", "Definir alcance y objetivos", "todo", 1);
      stmt.run("Diseñar esquema DB", "Modelo entidades", "todo", 2);
      stmt.run("Implementar API", "Endpoints iniciales", "doing", 1);
      stmt.run("Tests unitarios", "Agregar pruebas", "doing", 2);
      stmt.run("Deploy staging", "Preparar despliegue", "done", 1);
      stmt.finalize(() => {
        console.log("Tareas demo creadas.");
        db.close();
      });
    } else {
      console.log("La base de datos ya tiene tareas.");
      db.close();
    }
  });
});
