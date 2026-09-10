// ==========================================
// CONFIGURAÇÕES ESTILO DISCORD (PERFIL E ABAS)
// ==========================================

const settingsModal = document.getElementById('settings-modal');
const usernameInput = document.getElementById('settings-username');
const previewNameText = document.getElementById('preview-name-text');
const previewAvatarLetter = document.getElementById('preview-avatar-letter');

function openSettingsModal() {
    const savedUser = localStorage.getItem('kanbanUser') || 'Saniel';
    usernameInput.value = savedUser;
    previewNameText.textContent = savedUser;
    previewAvatarLetter.textContent = savedUser.charAt(0).toUpperCase();

    settingsModal.classList.add('active');
}

// Fechar (X) agora SÓ fecha, sem salvar — evita salvar acidentalmente
function closeSettingsModal() {
    settingsModal.classList.remove('active');
}

// Botão "Salvar Alterações" é quem persiste o nome de usuário
function saveProfileSettings() {
    const newName = usernameInput.value.trim();
    if (newName) {
        localStorage.setItem('kanbanUser', newName);
        previewNameText.textContent = newName;
        previewAvatarLetter.textContent = newName.charAt(0).toUpperCase();
    }
}

document.getElementById('open-settings-btn').addEventListener('click', openSettingsModal);
document.getElementById('btn-close-settings').addEventListener('click', closeSettingsModal);
document.getElementById('btn-save-profile').addEventListener('click', saveProfileSettings);

// Atualiza o preview (visual apenas) ao digitar o nome
usernameInput.addEventListener('input', () => {
    const val = usernameInput.value.trim() || 'Usuário';
    previewNameText.textContent = val;
    previewAvatarLetter.textContent = val.charAt(0).toUpperCase();
});

// Navegação entre as Abas do Discord
const sidebarTabs = document.querySelectorAll('.sidebar-tab[data-target]');
const settingsPanels = document.querySelectorAll('.settings-panel');

sidebarTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        sidebarTabs.forEach(t => t.classList.remove('active'));
        settingsPanels.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

// Lógica de Temas (agora as 3 opções têm classe explícita, incluindo "cosmic")
const themeCards = document.querySelectorAll('.theme-option-card');
themeCards.forEach(card => {
    const selectTheme = () => {
        const themeName = card.getAttribute('data-theme');
        applyTheme(themeName);
        localStorage.setItem('kanbanTheme', themeName);
    };
    card.addEventListener('click', selectTheme);
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectTheme();
        }
    });
});

function applyTheme(themeName) {
    document.body.className = '';
    document.body.classList.add('theme-' + themeName);
}

function loadUserSettings() {
    const savedTheme = localStorage.getItem('kanbanTheme') || 'sunset';
    applyTheme(savedTheme);
}


// ==========================================
// NAVEGAÇÃO ENTRE PAINÉIS (Board / Calendário / Chat)
// ==========================================

const viewNavBtns = document.querySelectorAll('.view-nav-btn');
const viewPanels = document.querySelectorAll('.view-panel');
const mainHeaderTitle = document.getElementById('main-header-title');

const VIEW_TITLES = {
    board: 'Loterica',
    calendar: 'Calendário',
    chat: 'Chat da Equipe'
};

function switchView(view) {
    viewNavBtns.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-view') === view));
    viewPanels.forEach(panel => panel.classList.toggle('active', panel.id === 'view-' + view));
    mainHeaderTitle.textContent = VIEW_TITLES[view] || 'Loterica';

    if (view === 'calendar') renderCalendar();
    if (view === 'chat') renderChatMessages();
}

viewNavBtns.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.getAttribute('data-view')));
});


// ==========================================
// EXPORTAR / IMPORTAR DADOS (BACKUP)
// ==========================================

function exportData() {
    const backup = {
        board: localStorage.getItem('kanbanDataPremium') || '[]',
        user: localStorage.getItem('kanbanUser') || 'Saniel',
        theme: localStorage.getItem('kanbanTheme') || 'sunset',
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kanban-backup.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function importDataFromFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const backup = JSON.parse(event.target.result);

            if (backup.board) {
                // Valida que é um JSON de quadro válido antes de gravar
                JSON.parse(backup.board);
                localStorage.setItem('kanbanDataPremium', backup.board);
            }
            if (backup.user) localStorage.setItem('kanbanUser', backup.user);
            if (backup.theme) localStorage.setItem('kanbanTheme', backup.theme);

            loadUserSettings();
            loadBoard();
            alert('Dados importados com sucesso!');
        } catch (err) {
            console.error('Falha ao importar backup:', err);
            alert('Não foi possível importar este arquivo. Verifique se é um backup válido do Kanban.');
        }
    };
    reader.readAsText(file);
}

document.getElementById('btn-export-data').addEventListener('click', exportData);
document.getElementById('import-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importDataFromFile(file);
    e.target.value = ''; // permite importar o mesmo arquivo novamente depois
});


// ==========================================
// MODAIS DE TAREFAS, COLUNAS E CONFIRMAÇÃO
// ==========================================

let currentTaskCallback = null;
const taskModal = document.getElementById('task-modal');
const taskTitleInput = document.getElementById('modal-task-text');
const taskAssigneeInput = document.getElementById('modal-task-assignee');
const taskDueDateInput = document.getElementById('modal-task-duedate');
const modalTitle = document.getElementById('modal-title');

function openTaskModal(title, defaultText, defaultAssignee, defaultDueDate, callback) {
    modalTitle.textContent = title;
    taskTitleInput.value = defaultText || '';
    const defaultUser = localStorage.getItem('kanbanUser') || 'Saniel';
    taskAssigneeInput.value = defaultAssignee || defaultUser;
    taskDueDateInput.value = defaultDueDate || '';

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
    const dueDate = taskDueDateInput.value; // formato yyyy-mm-dd, ou '' se não definido

    if (text !== '') {
        if (currentTaskCallback) currentTaskCallback(text, assignee, dueDate);
        closeTaskModal();
        saveBoard();
    }
});

// Colunas (mesmo modal serve para CRIAR e para RENOMEAR)
let currentColCallback = null;
const colModal = document.getElementById('column-modal');
const colModalTitle = document.getElementById('column-modal-title');
const colTitleInput = document.getElementById('modal-column-title');
const colSaveBtn = document.getElementById('btn-save-column');

function openColModal(defaultTitle, modalHeading, saveLabel, callback) {
    colTitleInput.value = defaultTitle || '';
    colModalTitle.textContent = modalHeading || 'Nome da coluna';
    colSaveBtn.textContent = saveLabel || 'Criar Coluna';
    currentColCallback = callback;
    colModal.classList.add('active');
    colTitleInput.focus();
}

function closeColModal() {
    colModal.classList.remove('active');
    currentColCallback = null;
}

document.getElementById('btn-cancel-column').addEventListener('click', closeColModal);
colSaveBtn.addEventListener('click', () => {
    const title = colTitleInput.value.trim();
    if (title !== '') {
        if (currentColCallback) currentColCallback(title);
        closeColModal();
    }
});

// Confirmação (Exclusão)
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
// ARRASTAR COLUNAS / CARTÕES E LOCALSTORAGE
// ==========================================
const boardElement = document.getElementById('board');

document.addEventListener('DOMContentLoaded', () => {
    loadUserSettings();
    loadBoard();
    document.getElementById('add-column-btn').addEventListener('click', () => {
        openColModal('', 'Nova Coluna', 'Criar Coluna', (title) => {
            const columnId = 'col-' + Date.now();
            createColumnElement(columnId, title);
            saveBoard();
        });
    });
});

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
// PRAZOS DE ENTREGA (SEMÁFORO VERDE / AMARELO / VERMELHO)
// ==========================================

function formatISODate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateBR(isoDateStr) {
    const [year, month, day] = isoDateStr.split('-');
    return `${day}/${month}`;
}

// Regra do semáforo: vermelho = atrasado ou hoje, amarelo = até 2 dias, verde = 3+ dias
function getDueDateInfo(dueDateStr) {
    if (!dueDateStr) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr + 'T00:00:00');
    if (isNaN(due.getTime())) return null;

    const diffDays = Math.round((due - today) / 86400000);

    if (diffDays < 0) return { level: 'red', label: 'Atrasado', diffDays };
    if (diffDays === 0) return { level: 'red', label: 'Hoje', diffDays };
    if (diffDays <= 2) return { level: 'yellow', label: formatDateBR(dueDateStr), diffDays };
    return { level: 'green', label: formatDateBR(dueDateStr), diffDays };
}

// Preenche o badge de prazo usando textContent (nunca innerHTML) e guarda
// a data crua em data-duedate, que é a fonte de verdade para editar depois.
function renderDueDate(badgeEl, dueDateStr) {
    badgeEl.dataset.duedate = dueDateStr || '';
    badgeEl.classList.remove('has-due', 'due-green', 'due-yellow', 'due-red');
    badgeEl.textContent = '';
    badgeEl.removeAttribute('aria-label');

    const info = getDueDateInfo(dueDateStr);
    if (!info) return;

    badgeEl.classList.add('has-due', 'due-' + info.level);
    badgeEl.textContent = '📅 ' + info.label;
    badgeEl.setAttribute('aria-label', `Prazo de entrega: ${info.label}`);
}

// Como "dias restantes" muda com o tempo, recalcula as cores periodicamente
// e sempre que a aba volta a ficar visível — sem isso, um cartão "amarelo"
// aberto de véspera continuaria amarelo mesmo depois de virar "atrasado".
function refreshAllDueBadges() {
    document.querySelectorAll('.due-badge').forEach(badge => {
        renderDueDate(badge, badge.dataset.duedate);
    });
}

setInterval(refreshAllDueBadges, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshAllDueBadges();
});

// Monta o conteúdo do avatar do responsável com nós de DOM/textContent
// (nunca innerHTML) e guarda o nome real em data-assignee, que passa a
// ser a única fonte de verdade — nada mais é "lido de volta" do texto.
function renderAssignee(avatarEl, name) {
    avatarEl.dataset.assignee = name;
    avatarEl.textContent = '';

    const initialsSpan = document.createElement('span');
    initialsSpan.textContent = getInitials(name);

    avatarEl.appendChild(initialsSpan);
    avatarEl.appendChild(document.createTextNode(' ' + name));
    avatarEl.setAttribute('aria-label', `Alterar responsável, atualmente ${name}`);
}

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

    const actionsWrap = document.createElement('div');
    actionsWrap.classList.add('column-header-actions');

    const renameColBtn = document.createElement('button');
    renameColBtn.classList.add('icon-btn');
    renameColBtn.style.color = "white";
    renameColBtn.style.background = "transparent";
    renameColBtn.innerHTML = '✎';
    renameColBtn.setAttribute('aria-label', 'Renomear coluna');

    renameColBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openColModal(h2.textContent, 'Renomear Coluna', 'Salvar', (newTitle) => {
            h2.textContent = newTitle;
            saveBoard();
        });
    });

    const deleteColBtn = document.createElement('button');
    deleteColBtn.classList.add('icon-btn');
    deleteColBtn.style.color = "white";
    deleteColBtn.style.background = "transparent";
    deleteColBtn.innerHTML = '✖';
    deleteColBtn.setAttribute('aria-label', 'Excluir coluna');

    deleteColBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openConfirmModal('Excluir Coluna', `Tem certeza que deseja excluir a coluna "${h2.textContent}" e todas as suas tarefas?`, () => {
            column.remove();
            saveBoard();
        });
    });

    actionsWrap.appendChild(renameColBtn);
    actionsWrap.appendChild(deleteColBtn);
    header.appendChild(h2);
    header.appendChild(actionsWrap);

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
        const defaultUser = localStorage.getItem('kanbanUser') || 'Saniel';
        openTaskModal('Nova Tarefa', '', defaultUser, '', (text, assignee, dueDate) => {
            const card = createCardElement(text, assignee, dueDate);
            container.appendChild(card);
            saveBoard();
        });
    });

    form.appendChild(addBtn);
    column.appendChild(header);
    column.appendChild(container);
    column.appendChild(form);
    boardElement.appendChild(column);

    return container;
}

function createCardElement(text, assignee, dueDate) {
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
    editBtn.setAttribute('aria-label', 'Editar tarefa');
    editBtn.addEventListener('click', () => {
        // Lê responsável e prazo direto dos data-attributes, nunca do texto renderizado
        openTaskModal('Editar Tarefa', cardText.textContent, assigneeAvatar.dataset.assignee, dueBadge.dataset.duedate, (newText, newAssignee, newDueDate) => {
            cardText.textContent = newText;
            renderAssignee(assigneeAvatar, newAssignee);
            renderDueDate(dueBadge, newDueDate);
            saveBoard();
        });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('icon-btn');
    deleteBtn.innerHTML = '🗑';
    deleteBtn.setAttribute('aria-label', 'Excluir tarefa');

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

    const dueBadge = document.createElement('span');
    dueBadge.classList.add('due-badge');
    renderDueDate(dueBadge, dueDate);

    const assigneeAvatar = document.createElement('div');
    assigneeAvatar.classList.add('assignee-avatar');
    assigneeAvatar.setAttribute('role', 'button');
    assigneeAvatar.setAttribute('tabindex', '0');
    renderAssignee(assigneeAvatar, assignee);

    const openAssigneeEditor = () => {
        openTaskModal('Alterar Responsável', cardText.textContent, assigneeAvatar.dataset.assignee, dueBadge.dataset.duedate, (newText, newAssignee, newDueDate) => {
            cardText.textContent = newText;
            renderAssignee(assigneeAvatar, newAssignee);
            renderDueDate(dueBadge, newDueDate);
            saveBoard();
        });
    };

    assigneeAvatar.addEventListener('click', openAssigneeEditor);
    assigneeAvatar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openAssigneeEditor();
        }
    });

    footer.appendChild(dueBadge);
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

function saveBoard() {
    const columnsData = [];
    document.querySelectorAll('.column').forEach(column => {
        const cardsData = [];
        column.querySelectorAll('.card').forEach(card => {
            const assigneeName = card.querySelector('.assignee-avatar').dataset.assignee || 'Sem responsável';
            const dueDate = card.querySelector('.due-badge').dataset.duedate || '';

            cardsData.push({
                text: card.querySelector('.card-text').textContent,
                assignee: assigneeName,
                dueDate: dueDate
            });
        });

        columnsData.push({
            id: column.id,
            title: column.querySelector('h2').textContent,
            cards: cardsData
        });
    });

    try {
        localStorage.setItem('kanbanDataPremium', JSON.stringify(columnsData));
    } catch (err) {
        console.error('Não foi possível salvar o quadro no localStorage:', err);
    }
}

function loadBoard() {
    boardElement.innerHTML = '';
    const savedData = localStorage.getItem('kanbanDataPremium');
    if (!savedData) return;

    let columnsData;
    try {
        columnsData = JSON.parse(savedData);
    } catch (err) {
        console.error('Dados do quadro corrompidos, iniciando um quadro vazio.', err);
        return;
    }

    if (!Array.isArray(columnsData)) return;

    columnsData.forEach(colData => {
        if (!colData || !colData.id || !colData.title) return;
        const container = createColumnElement(colData.id, colData.title);
        (colData.cards || []).forEach(cardData => {
            if (!cardData || typeof cardData.text !== 'string') return;
            container.appendChild(createCardElement(cardData.text, cardData.assignee, cardData.dueDate));
        });
    });
}


// ==========================================
// PAINEL: CALENDÁRIO DE PRAZOS
// ==========================================

let calendarViewDate = new Date();
let selectedCalendarDay = null;

const CALENDAR_MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Percorre o quadro atual (já em memória no DOM) e reúne as tarefas que têm prazo
function collectTasksWithDueDates() {
    const tasks = [];
    document.querySelectorAll('.column').forEach(column => {
        const columnTitle = column.querySelector('h2').textContent;
        column.querySelectorAll('.card').forEach(card => {
            const dueBadge = card.querySelector('.due-badge');
            const dueDate = dueBadge.dataset.duedate;
            if (!dueDate) return;

            const info = getDueDateInfo(dueDate);
            tasks.push({
                text: card.querySelector('.card-text').textContent,
                assignee: card.querySelector('.assignee-avatar').dataset.assignee || 'Sem responsável',
                dueDate,
                columnTitle,
                level: info ? info.level : 'green'
            });
        });
    });
    return tasks;
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('calendar-month-label');
    grid.innerHTML = '';

    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    label.textContent = `${CALENDAR_MONTH_NAMES[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay(); // 0 = Domingo
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const tasksByDate = {};
    collectTasksWithDueDates().forEach(task => {
        (tasksByDate[task.dueDate] = tasksByDate[task.dueDate] || []).push(task);
    });

    const todayStr = formatISODate(new Date());

    for (let i = 0; i < startWeekday; i++) {
        const empty = document.createElement('div');
        empty.classList.add('calendar-cell', 'calendar-cell-empty');
        grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayTasks = tasksByDate[dateStr] || [];

        const cell = document.createElement('button');
        cell.type = 'button';
        cell.classList.add('calendar-cell');
        if (dateStr === todayStr) cell.classList.add('calendar-cell-today');
        if (dateStr === selectedCalendarDay) cell.classList.add('calendar-cell-selected');
        cell.setAttribute('aria-label', `Dia ${day}, ${dayTasks.length} tarefa(s) com prazo`);

        const dayNumber = document.createElement('span');
        dayNumber.classList.add('calendar-day-number');
        dayNumber.textContent = day;
        cell.appendChild(dayNumber);

        if (dayTasks.length > 0) {
            const dotsWrap = document.createElement('div');
            dotsWrap.classList.add('calendar-dots');
            dayTasks.slice(0, 4).forEach(task => {
                const dot = document.createElement('span');
                dot.classList.add('calendar-dot', 'due-' + task.level);
                dotsWrap.appendChild(dot);
            });
            cell.appendChild(dotsWrap);
        }

        cell.addEventListener('click', () => {
            selectedCalendarDay = dateStr;
            grid.querySelectorAll('.calendar-cell-selected').forEach(c => c.classList.remove('calendar-cell-selected'));
            cell.classList.add('calendar-cell-selected');
            renderCalendarDayTasks(dateStr, dayTasks);
        });

        grid.appendChild(cell);
    }

    if (selectedCalendarDay) {
        renderCalendarDayTasks(selectedCalendarDay, tasksByDate[selectedCalendarDay] || []);
    } else {
        renderCalendarDayTasks(null, []);
    }
}

function renderCalendarDayTasks(dateStr, tasks) {
    const list = document.getElementById('calendar-day-list');
    const heading = document.getElementById('calendar-day-heading');
    list.innerHTML = '';

    if (!dateStr) {
        heading.textContent = 'Selecione um dia para ver as tarefas';
        return;
    }

    const [year, month, day] = dateStr.split('-');
    heading.textContent = `Tarefas de ${day}/${month}/${year}`;

    if (tasks.length === 0) {
        const empty = document.createElement('li');
        empty.classList.add('calendar-day-empty');
        empty.textContent = 'Nenhuma tarefa com prazo neste dia.';
        list.appendChild(empty);
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement('li');
        item.classList.add('calendar-task-item', 'due-' + task.level);

        const taskText = document.createElement('span');
        taskText.classList.add('calendar-task-text');
        taskText.textContent = task.text;

        const meta = document.createElement('span');
        meta.classList.add('calendar-task-meta');
        meta.textContent = `${task.columnTitle} · ${task.assignee}`;

        item.appendChild(taskText);
        item.appendChild(meta);
        list.appendChild(item);
    });
}

document.getElementById('calendar-prev-month').addEventListener('click', () => {
    calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById('calendar-next-month').addEventListener('click', () => {
    calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
    renderCalendar();
});

document.getElementById('calendar-today-btn').addEventListener('click', () => {
    calendarViewDate = new Date();
    selectedCalendarDay = formatISODate(new Date());
    renderCalendar();
});


// ==========================================
// PAINEL: CHAT DA EQUIPE (wireframe)
// Mensagens ficam salvas apenas neste navegador (localStorage), por canal.
// Para virar um chat em tempo real entre pessoas diferentes, seria
// necessário um servidor/backend — isto é a interface e o comportamento
// local prontos para conectar a um backend no futuro.
// ==========================================

const CHAT_STORAGE_KEY = 'kanbanChatMessages';
let currentChatChannel = 'geral';

function loadChatMessages() {
    try {
        return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || {};
    } catch (err) {
        console.error('Histórico do chat corrompido, iniciando vazio.', err);
        return {};
    }
}

function saveChatMessages(data) {
    try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
        console.error('Não foi possível salvar as mensagens do chat:', err);
    }
}

function renderChatMessages() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    const allMessages = loadChatMessages();
    const messages = allMessages[currentChatChannel] || [];

    if (messages.length === 0) {
        const empty = document.createElement('div');
        empty.classList.add('chat-empty-state');
        empty.textContent = 'Nenhuma mensagem ainda neste canal. Diga oi! 👋';
        container.appendChild(empty);
        return;
    }

    messages.forEach(msg => {
        const bubble = document.createElement('div');
        bubble.classList.add('chat-bubble');

        const author = document.createElement('span');
        author.classList.add('chat-bubble-author');
        author.textContent = msg.author;

        const text = document.createElement('span');
        text.classList.add('chat-bubble-text');
        text.textContent = msg.text;

        const time = document.createElement('span');
        time.classList.add('chat-bubble-time');
        time.textContent = msg.time;

        bubble.appendChild(author);
        bubble.appendChild(text);
        bubble.appendChild(time);
        container.appendChild(bubble);
    });

    container.scrollTop = container.scrollHeight;
}

document.querySelectorAll('.chat-channel').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.chat-channel').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentChatChannel = btn.dataset.channel;
        document.getElementById('chat-channel-title').textContent = '# ' + currentChatChannel;
        renderChatMessages();
    });
});

document.getElementById('chat-input-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const author = localStorage.getItem('kanbanUser') || 'Saniel';
    const allMessages = loadChatMessages();
    if (!allMessages[currentChatChannel]) allMessages[currentChatChannel] = [];

    allMessages[currentChatChannel].push({
        author,
        text,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });

    saveChatMessages(allMessages);
    input.value = '';
    renderChatMessages();
});