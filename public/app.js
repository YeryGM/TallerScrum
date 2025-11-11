// app.js
const socket = io();

async function fetchTasks() {
  const res = await fetch('/api/tasks');
  const tasks = await res.json();
  return tasks;
}

function groupByStatus(tasks) {
  const groups = { todo: [], doing: [], done: [] };
  tasks.forEach(t => {
    if (!groups[t.status]) groups[t.status] = [];
    groups[t.status].push(t);
  });
  // ordenar por position
  Object.keys(groups).forEach(k => groups[k].sort((a,b)=> a.position - b.position));
  return groups;
}

const template = document.getElementById('task-template');
const dropzones = document.querySelectorAll('.dropzone');

let dragEl = null;
let dragSourceStatus = null;

function renderTasks(tasks) {
  const groups = groupByStatus(tasks);
  document.getElementById('col-todo').innerHTML = '';
  document.getElementById('col-doing').innerHTML = '';
  document.getElementById('col-done').innerHTML = '';

  const mappings = { todo: 'col-todo', doing: 'col-doing', done: 'col-done' };

  Object.keys(groups).forEach(status => {
    const container = document.getElementById(mappings[status]);
    groups[status].forEach(task => {
      const node = template.content.firstElementChild.cloneNode(true);
      node.dataset.id = task.id;
      node.querySelector('.task-title').textContent = task.title;
      node.querySelector('.task-desc').textContent = task.description || '';
      addDragHandlers(node);
      container.appendChild(node);
    });
  });
}

// Drag handlers
function addDragHandlers(node) {
  node.addEventListener('dragstart', (e) => {
    dragEl = node;
    dragEl.classList.add('dragging');
    dragSourceStatus = node.closest('.column').dataset.status;
    e.dataTransfer.effectAllowed = 'move';
    // set drag data for Firefox
    e.dataTransfer.setData('text/plain', node.dataset.id);
  });

  node.addEventListener('dragend', async (e) => {
    if (dragEl) {
      dragEl.classList.remove('dragging');
      dragEl = null;
      dragSourceStatus = null;
    }
  });
}

// Setup dropzones
dropzones.forEach(zone => {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('over');
    e.dataTransfer.dropEffect = 'move';
  });

  zone.addEventListener('dragleave', (e) => {
    zone.classList.remove('over');
  });

  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    const id = e.dataTransfer.getData('text/plain') || (dragEl && dragEl.dataset.id);

    if (!id) return;

    // Append element visually at drop place (end)
    const taskNode = document.querySelector(`.task[data-id='${id}']`);
    if (!taskNode) return;

    // Append at the dropzone
    zone.appendChild(taskNode);

    // Build new ordering for that status (recalculate positions)
    const status = zone.closest('.column').dataset.status;
    const nodes = Array.from(zone.querySelectorAll('.task'));
    // assign positions starting at 1
    const updatedTasks = nodes.map((n, idx) => ({ id: Number(n.dataset.id), status, position: idx + 1 }));

    // Send reorder to server (reorder endpoint)
    try {
      const res = await fetch('/api/tasks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks })
      });
      if (!res.ok) throw new Error('Error al reordenar');
      // server emitirá events que actualizarán otros clientes
    } catch (err) {
      console.error(err);
      alert('Error al actualizar posición en el servidor');
    }
  });
});

// Add new task button handlers
document.getElementById('add-todo').addEventListener('click', () => addTaskPrompt('todo'));
document.getElementById('add-doing').addEventListener('click', () => addTaskPrompt('doing'));
document.getElementById('add-done').addEventListener('click', () => addTaskPrompt('done'));

async function addTaskPrompt(status) {
  const title = prompt('Título de la tarea:');
  if (!title) return;
  const description = prompt('Descripción (opcional):') || '';
  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, status })
    });
    const created = await res.json();
    // server emite evento y será reflejado por socket listener
  } catch (err) {
    console.error(err);
    alert('No se pudo crear la tarea');
  }
}

// Socket listeners para tiempo real
socket.on('task:created', (task) => {
  // recargar la lista completa (podríamos optimizar)
  loadAndRender();
});

socket.on('task:moved', (task) => {
  loadAndRender();
});

socket.on('tasks:reordered', (rows) => {
  loadAndRender();
});

async function loadAndRender() {
  const tasks = await fetchTasks();
  renderTasks(tasks);
}

// Inicializar
loadAndRender();
