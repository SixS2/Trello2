// ==========================================
// SISTEMA DE MODAIS (JANELAS FLUTUANTES)
// ==========================================

// --- Modal de Tarefas ---
let currentTaskCallback = null; 
const taskModal = document.getElementById('task-modal');
const taskTitleInput = document.getElementById('modal-task-text');
const taskAssigneeInput = document.getElementById('modal-task-assignee');
const modalTitle = document.getElementById('modal-title');

function openTaskModal(title, defaultText, defaultAssignee, callback) {
    modalTitle.textContent = title;
    taskTitleInput.value = defaultText || '';
    taskAssigneeInput.value = defaultAssignee || 'Saniel';
    currentTaskCallback = callback;
    
    taskModal.classList.add('active');
    taskTitleInput.focus();
}

function closeTaskModal() {
    taskModal.classList.remove('active');
    currentTaskCallback = null;
}

document.getElementById('btn-cancel-task').addEventListener('click', closeTaskModal);
document.getElementById('btn-save-task').addEventListener('click', () => {
    const text = taskTitleInput.value.trim();
    const assignee = taskAssigneeInput.value.trim() || 'Sem responsável';
    
    if (text !== '') {
        if (currentTaskCallback) currentTaskCallback(text, assignee);
        closeTaskModal();
        saveBoard();
    }
});


// --- Modal de Colunas ---
const colModal = document.getElementById('column-modal');
const colTitleInput = document.getElementById('modal-column-title');

function openColModal() {
    colTitleInput.value = '';
    colModal.classList.add('active');
    colTitleInput.focus();
}

function closeColModal() {
    colModal.classList.remove('active');
}

document.getElementById('btn-cancel-column').addEventListener('click', closeColModal);
document.getElementById('btn-save-column').addEventListener('click', () => {
    const title = colTitleInput.value.trim();
    if (title !== '') {
        const columnId = 'col-' + Date.now();
        createColumnElement(columnId, title);
        saveBoard();
        closeColModal();
    }
});


// --- Modal de Confirmação (Exclusão) ---
let currentConfirmCallback = null;
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');

function openConfirmModal(title, message, callback) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    currentConfirmCallback = callback;
    confirmModal.classList.add('active');
}

function closeConfirmModal() {
    confirmModal.classList.remove('active');
    currentConfirmCallback = null;
}

document.getElementById('btn-cancel-confirm').addEventListener('click', closeConfirmModal);
document.getElementById('btn-save-confirm').addEventListener('click', () => {
    if (currentConfirmCallback) currentConfirmCallback();
    closeConfirmModal();
});


// ==========================================
// INICIALIZAÇÃO E ARRASTAR COLUNAS/CARTÕES
// ==========================================

const boardElement = document.getElementById('board');

document.addEventListener('DOMContentLoaded', () => {
    loadBoard();
    document.getElementById('add-column-btn').addEventListener('click', openColModal);
});

// Lógica de Drag and Drop para COLUNAS
boardElement.addEventListener('dragover', e => {
    e.preventDefault();
    const draggingColumn = document.querySelector('.dragging-column');
    if (draggingColumn) {
        const afterElement = getDragAfterColumn(boardElement, e.clientX);
        if (afterElement == null) {
            boardElement.appendChild(draggingColumn);
        } else {
            boardElement.insertBefore(draggingColumn, afterElement);
        }
    }
});

function getDragAfterColumn(container, x) {
    const draggableColumns = [...container.querySelectorAll('.column:not(.dragging-column)')];
    return draggableColumns.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getDragAfterCard(container, y) {
    const draggableCards = [...container.querySelectorAll('.card:not(.dragging)')];
    return draggableCards.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getInitials(name) {
    if (!name || name === 'Sem responsável') return '👤';
    return name.charAt(0).toUpperCase();
}


// ==========================================
// CONSTRUTOR DE COLUNAS
// ==========================================
function createColumnElement(id, title) {
    const column = document.createElement('div');
    column.classList.add('column');
    column.id = id;
    column.setAttribute('draggable', 'true');

    column.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('column')) column.classList.add('dragging-column');
    });
    column.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('column')) {
            column.classList.remove('dragging-column');
            saveBoard();
        }
    });

    const header = document.createElement('div');
    header.classList.add('column-header');
    
    const h2 = document.createElement('h2');
    h2.textContent = title;
    
    const deleteColBtn = document.createElement('button');
    deleteColBtn.classList.add('icon-btn');
    deleteColBtn.style.color = "white"; 
    deleteColBtn.style.background = "transparent";
    deleteColBtn.innerHTML = '✖';
    
    // Substituindo o confirm() nativo pelo nosso Modal Bonito!
    deleteColBtn.addEventListener('click', () => {
        openConfirmModal('Excluir Coluna', `Tem certeza que deseja excluir a coluna "${title}" e todas as suas tarefas?`, () => {
            column.remove();
            saveBoard();
        });
    });

    header.appendChild(h2);
    header.appendChild(deleteColBtn);

    const container = document.createElement('div');
    container.classList.add('cards-container');
    
    container.addEventListener('dragover', e => {
        e.preventDefault();
        const draggingCard = document.querySelector('.dragging');
        if (draggingCard) {
            const afterElement = getDragAfterCard(container, e.clientY);
            if (afterElement == null) {
                container.appendChild(draggingCard);
            } else {
                container.insertBefore(draggingCard, afterElement);
            }
        }
    });

    const form = document.createElement('div');
    form.classList.add('add-card-form');
    
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Adicionar Tarefa';
    addBtn.classList.add('add-btn');
    
    addBtn.addEventListener('click', () => {
        openTaskModal('Nova Tarefa', '', 'Saniel', (text, assignee) => {
            const card = createCardElement(text, assignee);
            container.appendChild(card);
        });
    });

    form.appendChild(addBtn);
    column.appendChild(header);
    column.appendChild(container);
    column.appendChild(form);
    boardElement.appendChild(column);

    return container;
}


// ==========================================
// CONSTRUTOR DE CARTÕES
// ==========================================
function createCardElement(text, assignee) {
    const card = document.createElement('div');
    card.classList.add('card');
    card.setAttribute('draggable', 'true');

    const header = document.createElement('div');
    header.classList.add('card-header');

    const cardText = document.createElement('span');
    cardText.classList.add('card-text');
    cardText.textContent = text;

    const actions = document.createElement('div');
    actions.classList.add('card-actions');

    const editBtn = document.createElement('button');
    editBtn.classList.add('icon-btn');
    editBtn.innerHTML = '✎';
    editBtn.addEventListener('click', () => {
        const currentAssignee = assigneeAvatar.textContent.substring(1).trim();
        openTaskModal('Editar Tarefa', cardText.textContent, currentAssignee, (newText, newAssignee) => {
            cardText.textContent = newText;
            assigneeAvatar.innerHTML = `<span>${getInitials(newAssignee)}</span> ${newAssignee}`;
        });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('icon-btn');
    deleteBtn.innerHTML = '🗑';
    
    // Substituindo o confirm() nativo pelo nosso Modal Bonito!
    deleteBtn.addEventListener('click', () => {
        openConfirmModal('Excluir Tarefa', `Tem certeza que deseja excluir a tarefa "${cardText.textContent}"?`, () => {
            card.remove();
            saveBoard();
        });
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(cardText);
    header.appendChild(actions);

    const footer = document.createElement('div');
    footer.classList.add('card-footer');

    const assigneeAvatar = document.createElement('div');
    assigneeAvatar.classList.add('assignee-avatar');
    
    const inicial = getInitials(assignee);
    assigneeAvatar.innerHTML = `<span>${inicial}</span> ${assignee}`;
    
    assigneeAvatar.addEventListener('click', () => {
        const currentAssignee = assigneeAvatar.textContent.substring(1).trim();
        openTaskModal('Alterar Responsável', cardText.textContent, currentAssignee, (newText, newAssignee) => {
            cardText.textContent = newText;
            assigneeAvatar.innerHTML = `<span>${getInitials(newAssignee)}</span> ${newAssignee}`;
        });
    });

    footer.appendChild(assigneeAvatar);
    card.appendChild(header);
    card.appendChild(footer);

    card.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        card.classList.add('dragging');
    });
    
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        saveBoard();
    });

    return card;
}


// ==========================================
// SALVAR E CARREGAR (LOCALSTORAGE)
// ==========================================
function saveBoard() {
    const columnsData = [];
    document.querySelectorAll('.column').forEach(column => {
        const cardsData = [];
        column.querySelectorAll('.card').forEach(card => {
            const fullAssigneeText = card.querySelector('.assignee-avatar').textContent.trim();
            const assigneeName = fullAssigneeText.substring(1).trim(); 

            cardsData.push({
                text: card.querySelector('.card-text').textContent,
                assignee: assigneeName
            });
        });
        
        columnsData.push({
            id: column.id,
            title: column.querySelector('h2').textContent,
            cards: cardsData
        });
    });
    localStorage.setItem('kanbanDataPremium', JSON.stringify(columnsData));
}

function loadBoard() {
    const savedData = localStorage.getItem('kanbanDataPremium');
    boardElement.innerHTML = ''; 
    
    if (savedData) {
        const columnsData = JSON.parse(savedData);
        columnsData.forEach(colData => {
            const container = createColumnElement(colData.id, colData.title);
            colData.cards.forEach(cardData => {
                container.appendChild(createCardElement(cardData.text, cardData.assignee));
            });
        });
    } 
}