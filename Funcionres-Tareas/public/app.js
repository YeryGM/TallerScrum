// app.js - Versión con modal para creación de tareas
const socket = io();

/**
 * Clase para gestionar el formulario modal de creación de tareas.
 * Sigue el patrón de diseño de Módulo, encapsulando toda la lógica del formulario.
 */
class TaskForm {
    constructor(formId) {
        this.formElement = document.getElementById(formId);
        this.modalOverlay = this.formElement.closest('.modal-overlay');
        
        if (!this.formElement || !this.modalOverlay) {
            throw new Error("No se encontraron los elementos del formulario o el modal.");
        }

        this.titleInput = this.formElement.querySelector('#task-title-input');
        this.descInput = this.formElement.querySelector('#task-desc-input');
        this.priorityInput = this.formElement.querySelector('#task-priority-input');

        this._setupEventListeners();
    }

    _setupEventListeners() {
        document.getElementById('open-modal-btn').addEventListener('click', () => this.open());
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) this.close();
        });
        this.formElement.querySelector('.cancel-btn').addEventListener('click', () => this.close());
        this.formElement.addEventListener('submit', (e) => this._handleSave(e));
    }

    open() {
        this.modalOverlay.classList.remove('hidden');
        this.titleInput.focus();
    }

    close() {
        this.modalOverlay.classList.add('hidden');
        this.formElement.reset();
    }

    _validate() {
        if (!this.titleInput.value.trim()) {
            alert('El campo "Título" es obligatorio.');
            this.titleInput.focus();
            return false;
        }
        return true;
    }

    async _handleSave(e) {
        e.preventDefault();
        if (!this._validate()) return;

        const taskData = {
            title: this.titleInput.value.trim(),
            description: this.descInput.value.trim(),
            priority: this.priorityInput.value,
            status: 'todo' // Las nuevas tareas siempre van a "To Do"
        };

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });

            if (response.ok) {
                // El servidor emitirá 'task:created', y el listener se encargará de actualizar la UI.
                this.close();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error en el servidor');
            }
        } catch (error) {
            console.error('Error al crear la tarea:', error);
            alert(`No se pudo crear la tarea: ${error.message}`);
        }
    }
}


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
        taskElement.addEventListener('dragstart', (e) => {
            this.draggedTask = task;
            taskElement.classList.add('dragging');
            e.dataTransfer.setData('text/plain', task.id.toString());
        });

        taskElement.addEventListener('dragend', () => {
            taskElement.classList.remove('dragging');
            this.draggedTask = null;
        });

        taskElement.addEventListener('dblclick', () => this.editTask(task));
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
                // El evento 'task:deleted' actualizará el tablero
            }
        } catch (error)
 {
            console.error('Error al eliminar:', error);
            alert('Error al eliminar la tarea');
        }
    }

    updateTaskInBoard(updatedTask) {
        const index = this.tasks.findIndex(t => t.id === updatedTask.id);
        if (index !== -1) {
            this.tasks[index] = updatedTask;
        } else {
            this.tasks.push(updatedTask);
        }
        this.render();
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

function setupDropZones() {
    document.querySelectorAll('.dropzone').forEach(dropzone => {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));

        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');

            const taskId = e.dataTransfer.getData('text/plain');
            if (!taskId) return;

            const newStatus = dropzone.parentElement.getAttribute('data-status');
            
            try {
                const response = await fetch(`/api/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });

                if (!response.ok) throw new Error('Error en la respuesta del servidor');
                
            } catch (error) {
                console.error('Error al mover tarea:', error);
                alert('Error al mover la tarea');
                taskBoard.render();
            }
        });
    });
}

// Socket events
socket.on('task:created', (task) => taskBoard.addTaskToBoard(task));
socket.on('task:updated', (task) => taskBoard.updateTaskInBoard(task));
socket.on('task:deleted', (taskId) => taskBoard.removeTaskFromBoard(taskId));
socket.on('tasks:reordered', (tasks) => taskBoard.setTasks(tasks));

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    setupDropZones();
    new TaskForm('task-form'); // Inicializa el manejador del formulario modal

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
