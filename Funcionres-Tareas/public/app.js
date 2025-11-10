// app.js - Versión simplificada y funcional
const socket = io();

class TaskBoard {
    constructor() {
        this.tasks = [];
        this.draggedTask = null;
    }

    setTasks(tasks) {
        this.tasks = tasks;
        this.render();
    }

    render() {
        this.renderColumn('todo');
        this.renderColumn('doing');
        this.renderColumn('done');
    }

    renderColumn(status) {
        const container = document.getElementById(`col-${status}`);
        if (!container) return;

        container.innerHTML = '';
        
        const tasks = this.tasks
            .filter(task => task.status === status)
            .sort((a, b) => a.position - b.position);

        tasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            container.appendChild(taskElement);
        });
    }

    createTaskElement(task) {
        const template = document.getElementById('task-template');
        const node = template.content.firstElementChild.cloneNode(true);
        
        node.setAttribute('data-task-id', task.id);
        node.querySelector('.task-title').textContent = task.title;
        node.querySelector('.task-desc').textContent = task.description || '';
        node.querySelector('.task-priority').textContent = this.getPriorityLabel(task.priority);
        node.style.borderLeft = `4px solid ${this.getPriorityColor(task.priority)}`;

        this.setupTaskEvents(node, task);
        return node;
    }

    getPriorityLabel(priority) {
        const labels = { high: '🔥 Alta', medium: '⚡ Media', low: '💚 Baja' };
        return labels[priority] || '⚡ Media';
    }

    getPriorityColor(priority) {
        const colors = { high: '#e74c3c', medium: '#f39c12', low: '#27ae60' };
        return colors[priority] || '#f39c12';
    }

    setupTaskEvents(taskElement, task) {
        // Drag events
        taskElement.addEventListener('dragstart', (e) => {
            this.draggedTask = task;
            taskElement.classList.add('dragging');
            e.dataTransfer.setData('text/plain', task.id.toString());
        });

        taskElement.addEventListener('dragend', () => {
            taskElement.classList.remove('dragging');
            this.draggedTask = null;
        });

        // Edit on double click
        taskElement.addEventListener('dblclick', () => {
            this.editTask(task);
        });

        // Delete on right click
        taskElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (confirm(`¿Eliminar "${task.title}"?`)) {
                this.deleteTask(task.id);
            }
        });
    }

    async editTask(task) {
        const newTitle = prompt('Título:', task.title);
        if (newTitle === null) return;

        const newDesc = prompt('Descripción:', task.description || '');
        const newPriority = prompt('Prioridad (high/medium/low):', task.priority);

        try {
            const response = await fetch(`/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newTitle,
                    description: newDesc,
                    priority: newPriority
                })
            });
            
            if (response.ok) {
                const updatedTask = await response.json();
                this.updateTaskInBoard(updatedTask);
            }
        } catch (error) {
            console.error('Error al editar:', error);
            alert('Error al editar la tarea');
        }
    }

    async deleteTask(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
            if (response.ok) {
                this.tasks = this.tasks.filter(t => t.id !== taskId);
                this.render();
            }
        } catch (error) {
            console.error('Error al eliminar:', error);
            alert('Error al eliminar la tarea');
        }
    }

    updateTaskInBoard(updatedTask) {
        const index = this.tasks.findIndex(t => t.id === updatedTask.id);
        if (index !== -1) {
            this.tasks[index] = updatedTask;
            this.render();
        }
    }

    addTaskToBoard(newTask) {
        this.tasks.push(newTask);
        this.render();
    }

    removeTaskFromBoard(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.render();
    }
}

// Inicialización y configuración
const taskBoard = new TaskBoard();

// Configurar dropzones
function setupDropZones() {
    const dropzones = document.querySelectorAll('.dropzone');
    
    dropzones.forEach(dropzone => {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');

            const taskId = e.dataTransfer.getData('text/plain');
            if (!taskId) return;

            const newStatus = dropzone.parentElement.getAttribute('data-status');
            
            try {
                // Actualizar en servidor
                const response = await fetch(`/api/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        status: newStatus 
                    })
                });

                if (response.ok) {
                    const updatedTask = await response.json();
                    // Actualizar localmente
                    const taskIndex = taskBoard.tasks.findIndex(t => t.id == taskId);
                    if (taskIndex !== -1) {
                        taskBoard.tasks[taskIndex].status = newStatus;
                        taskBoard.render();
                    }
                } else {
                    throw new Error('Error en la respuesta del servidor');
                }
            } catch (error) {
                console.error('Error al mover tarea:', error);
                alert('Error al mover la tarea');
                taskBoard.render(); // Revertir visualmente
            }
        });
    });
}

// Configurar botones de añadir
function setupAddButtons() {
    document.getElementById('add-todo').addEventListener('click', () => addTask('todo'));
    document.getElementById('add-doing').addEventListener('click', () => addTask('doing'));
    document.getElementById('add-done').addEventListener('click', () => addTask('done'));
}

async function addTask(status) {
    const title = prompt('Título de la tarea:');
    if (!title) return;

    const description = prompt('Descripción:') || '';
    const priority = prompt('Prioridad (high/medium/low):', 'medium') || 'medium';

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title.trim(),
                description: description.trim(),
                priority: priority.toLowerCase(),
                status: status
            })
        });

        if (response.ok) {
            const newTask = await response.json();
            taskBoard.addTaskToBoard(newTask);
        }
    } catch (error) {
        console.error('Error al crear tarea:', error);
        alert('Error al crear la tarea');
    }
}

// Socket events
socket.on('task:created', (task) => {
    taskBoard.addTaskToBoard(task);
});

socket.on('task:updated', (task) => {
    taskBoard.updateTaskInBoard(task);
});

socket.on('task:deleted', (taskId) => {
    taskBoard.removeTaskFromBoard(taskId);
});

socket.on('tasks:reordered', (tasks) => {
    taskBoard.setTasks(tasks);
});

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    setupDropZones();
    setupAddButtons();

    try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
            const tasks = await response.json();
            taskBoard.setTasks(tasks);
        }
    } catch (error) {
        console.error('Error al cargar tareas:', error);
        alert('Error al cargar las tareas');
    }
});