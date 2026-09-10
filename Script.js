// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = 'https://hgqzkbpqgdzdhplnszny.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9t4dDguOAnfn3l6EXlXY9A_z0CMMXTS';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUserSession = null;
let presenceChannel = null;

// ==========================================
// CONTROLE DE ACESSO (PERMISSÕES PARA SANIEL)
// ==========================================
function checkPermissions() {
    const currentUser = (localStorage.getItem('kanbanUser') || 'Saniel').trim();
    const isAdmin = currentUser.toLowerCase() === 'saniel';

    const addColBtn = document.getElementById('add-column-btn');
    if (addColBtn) addColBtn.style.display = isAdmin ? 'flex' : 'none';

    document.querySelectorAll('.column, .card').forEach(el => {
        if (isAdmin) {
            el.setAttribute('draggable', 'true');
        } else {
            el.removeAttribute('draggable');
        }
    });

    document.querySelectorAll('.add-btn, .column-header-actions, .card-actions').forEach(el => {
        el.style.display = isAdmin ? 'flex' : 'none';
    });

    document.querySelectorAll('.assignee-avatar, .due-badge').forEach(el => {
        el.style.pointerEvents = isAdmin ? 'auto' : 'none';
    });

    return isAdmin;
}

// ==========================================
// FLUXO DE AUTENTICAÇÃO POR E-MAIL E SENHA
// ==========================================
let isRegistering = false;
const loginOverlay = document.getElementById('login-overlay');
const usernameInputLogin = document.getElementById('login-username');
const emailInputLogin = document.getElementById('login-email');
const registerNameGroup = document.getElementById('register-name-group');
const passwordInput = document.getElementById('login-password');
const toggleRegisterBtn = document.getElementById('btn-toggle-register');
const submitLoginBtn = document.getElementById('btn-submit-login');
const errorMsg = document.getElementById('login-error-msg');

if (toggleRegisterBtn) {
    toggleRegisterBtn.addEventListener('click', () => {
        isRegistering = !isRegistering;
        toggleRegisterBtn.textContent = isRegistering ? 'Já tenho conta' : 'Criar Conta';
        submitLoginBtn.textContent = isRegistering ? 'Registrar' : 'Entrar';
        if (registerNameGroup) {
            registerNameGroup.style.display = isRegistering ? 'block' : 'none';
        }
        if (errorMsg) errorMsg.style.display = 'none';
    });
}

if (submitLoginBtn) {
    submitLoginBtn.addEventListener('click', async () => {
        const emailVal = emailInputLogin ? emailInputLogin.value.trim() : '';
        const password = passwordInput ? passwordInput.value.trim() : '';
        const rawUsername = usernameInputLogin ? usernameInputLogin.value.trim() : '';

        if (!emailVal || !password || (isRegistering && !rawUsername)) {
            if (errorMsg) {
                errorMsg.textContent = 'Preencha todos os campos obrigatórios.';
                errorMsg.style.display = 'block';
            }
            return;
        }

        if (errorMsg) errorMsg.style.display = 'none';

        if (isRegistering) {
            const { data, error } = await supabaseClient.auth.signUp({ 
                email: emailVal, 
                password: password 
            });
            
            if (error) {
                if (errorMsg) {
                    errorMsg.textContent = error.message;
                    errorMsg.style.display = 'block';
                }
                return;
            }

            if (data.user) {
                const displayName = rawUsername || emailVal.split('@')[0];
                const { error: profileError } = await supabaseClient.from('profiles').upsert([{ 
                    id: data.user.id, 
                    email: emailVal, 
                    username: displayName 
                }]);

                if (profileError) {
                    if (errorMsg) {
                        errorMsg.textContent = 'Erro ao salvar perfil: ' + profileError.message;
                        errorMsg.style.display = 'block';
                    }
                    return;
                }

                localStorage.setItem('kanbanUser', displayName);
                initAppSession(data.user, displayName);
            }
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ 
                email: emailVal, 
                password: password 
            });

            if (error) {
                if (errorMsg) {
                    errorMsg.textContent = 'E-mail ou senha incorretos.';
                    errorMsg.style.display = 'block';
                }
                return;
            }

            if (data.user) {
                const { data: profile } = await supabaseClient.from('profiles').select('username').eq('id', data.user.id).single();
                const displayName = profile && profile.username ? profile.username : emailVal.split('@')[0];
                localStorage.setItem('kanbanUser', displayName);
                initAppSession(data.user, displayName);
            }
        }
    });
}

const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (presenceChannel) await supabaseClient.removeChannel(presenceChannel);
        await supabaseClient.auth.signOut();
        localStorage.removeItem('kanbanUser');
        if (loginOverlay) loginOverlay.classList.add('active');
    });
}

async function checkActiveSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
        const { data: profile } = await supabaseClient.from('profiles').select('username').eq('id', session.user.id).single();
        const username = profile && profile.username ? profile.username : session.user.email.split('@')[0];
        localStorage.setItem('kanbanUser', username);
        initAppSession(session.user, username);
    } else {
        if (loginOverlay) loginOverlay.classList.add('active');
    }
}

function initAppSession(user, username) {
    currentUserSession = user;
    if (loginOverlay) loginOverlay.classList.remove('active');
    loadUserSettings();
    loadBoard();
    renderChatChannels();
    renderChatMessages();
    setupRealtimePresence(username);
}

// ==========================================
// SUPABASE REALTIME PRESENCE (ONLINE / OFFLINE)
// ==========================================
function setupRealtimePresence(username) {
    presenceChannel = supabaseClient.channel('workspace-presence', {
        config: { presence: { key: currentUserSession ? currentUserSession.id : username } }
    });

    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            updateMembersListUI(state);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await presenceChannel.track({ username, online_at: new Date().toISOString() });
            }
        });
}

async function updateMembersListUI(presenceState) {
    const onlineListEl = document.getElementById('members-online-list');
    const offlineListEl = document.getElementById('members-offline-list');
    const countEl = document.getElementById('online-count');
    
    if (!onlineListEl || !offlineListEl) return;
    onlineListEl.innerHTML = '';
    offlineListEl.innerHTML = '';

    const { data: allProfiles } = await supabaseClient.from('profiles').select('username');
    const profiles = allProfiles || [];

    const onlineKeys = Object.keys(presenceState);
    const onlineUsernames = [];

    onlineKeys.forEach(key => {
        const metas = presenceState[key];
        if (metas && metas.length > 0) {
            onlineUsernames.push(metas[0].username);
            onlineListEl.appendChild(createMemberItemElement(metas[0].username, true));
        }
    });

    if (countEl) countEl.textContent = onlineUsernames.length;

    const offlineProfiles = profiles.filter(p => !onlineUsernames.includes(p.username));
    offlineProfiles.forEach(p => {
        offlineListEl.appendChild(createMemberItemElement(p.username, false));
    });
}

function createMemberItemElement(name, isOnline) {
    const item = document.createElement('div');
    item.classList.add('member-item');
    if (!isOnline) item.classList.add('offline');

    const avatar = document.createElement('div');
    avatar.classList.add('member-avatar');
    avatar.textContent = getInitials(name);

    const indicator = document.createElement('span');
    indicator.classList.add('status-indicator', isOnline ? 'status-online' : 'status-offline');
    avatar.appendChild(indicator);

    const nameSpan = document.createElement('span');
    nameSpan.classList.add('member-name');
    nameSpan.textContent = name;

    item.appendChild(avatar);
    item.appendChild(nameSpan);
    return item;
}

// ==========================================
// CONFIGURAÇÕES ESTILO DISCORD
// ==========================================
const settingsModal = document.getElementById('settings-modal');
const usernameInput = document.getElementById('settings-username');
const previewNameText = document.getElementById('preview-name-text');
const previewAvatarLetter = document.getElementById('preview-avatar-letter');

function openSettingsModal() {
    const savedUser = localStorage.getItem('kanbanUser') || 'Saniel';
    if (usernameInput) usernameInput.value = savedUser;
    if (previewNameText) previewNameText.textContent = savedUser;
    if (previewAvatarLetter) previewAvatarLetter.textContent = savedUser.charAt(0).toUpperCase();
    if (settingsModal) settingsModal.classList.add('active');
}

function closeSettingsModal() { 
    if (settingsModal) settingsModal.classList.remove('active'); 
}

async function saveProfileSettings() {
    const newName = usernameInput ? usernameInput.value.trim() : '';
    if (newName) {
        localStorage.setItem('kanbanUser', newName);
        if (previewNameText) previewNameText.textContent = newName;
        if (previewAvatarLetter) previewAvatarLetter.textContent = newName.charAt(0).toUpperCase();
        
        if (currentUserSession) {
            await supabaseClient.from('profiles').update({ username: newName }).eq('id', currentUserSession.id);
            if (presenceChannel) await presenceChannel.track({ username: newName, online_at: new Date().toISOString() });
        }

        checkPermissions();
        renderChatChannels(); 
    }
    closeSettingsModal();
}

const openSettingsBtn = document.getElementById('open-settings-btn');
if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettingsModal);

const closeSettingsBtn = document.getElementById('btn-close-settings');
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettingsModal);

const saveProfileBtn = document.getElementById('btn-save-profile');
if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfileSettings);

if (usernameInput) {
    usernameInput.addEventListener('input', () => {
        const val = usernameInput.value.trim() || 'Usuário';
        if (previewNameText) previewNameText.textContent = val;
        if (previewAvatarLetter) previewAvatarLetter.textContent = val.charAt(0).toUpperCase();
    });
}

const sidebarTabs = document.querySelectorAll('.sidebar-tab[data-target]');
const settingsPanels = document.querySelectorAll('.settings-panel');

sidebarTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        sidebarTabs.forEach(t => t.classList.remove('active'));
        settingsPanels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add('active');
    });
});

const themeCards = document.querySelectorAll('.theme-option-card');
themeCards.forEach(card => {
    const selectTheme = () => {
        const themeName = card.getAttribute('data-theme');
        applyTheme(themeName);
        localStorage.setItem('kanbanTheme', themeName);
    };
    card.addEventListener('click', selectTheme);
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTheme(); }
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
// NAVEGAÇÃO ENTRE PAINÉIS
// ==========================================
const viewNavBtns = document.querySelectorAll('.view-nav-btn');
const viewPanels = document.querySelectorAll('.view-panel');
const mainHeaderTitle = document.getElementById('main-header-title');

const VIEW_TITLES = { board: 'Loterica', calendar: 'Calendário', chat: 'Chat da Equipe' };

function switchView(view) {
    viewNavBtns.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-view') === view));
    viewPanels.forEach(panel => panel.classList.toggle('active', panel.id === 'view-' + view));
    if (mainHeaderTitle) mainHeaderTitle.textContent = VIEW_TITLES[view] || 'Loterica';

    if (view === 'calendar') renderCalendar();
    if (view === 'chat') renderChatMessages();
}

viewNavBtns.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.getAttribute('data-view')));
});

// ==========================================
// EXPORTAR / IMPORTAR DADOS
// ==========================================
function exportData() {
    const backup = {
        board: localStorage.getItem('kanbanDataPremium') || '[]',
        user: localStorage.getItem('kanbanUser') || 'Saniel',
        theme: localStorage.getItem('kanbanTheme') || 'sunset',
        chatChannels: localStorage.getItem('kanbanChatChannels') || '[]',
        chatMessages: localStorage.getItem('kanbanChatMessages') || '{}',
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
            if (backup.board) { JSON.parse(backup.board); localStorage.setItem('kanbanDataPremium', backup.board); }
            if (backup.user) localStorage.setItem('kanbanUser', backup.user);
            if (backup.theme) localStorage.setItem('kanbanTheme', backup.theme);
            if (backup.chatChannels) localStorage.setItem('kanbanChatChannels', backup.chatChannels);
            if (backup.chatMessages) localStorage.setItem('kanbanChatMessages', backup.chatMessages);
            
            loadUserSettings();
            loadBoard();
            renderChatChannels();
            renderChatMessages();
            alert('Dados importados com sucesso!');
        } catch (err) {
            console.error('Falha ao importar backup:', err);
            alert('Não foi possível importar este arquivo.');
        }
    };
    reader.readAsText(file);
}

const exportBtn = document.getElementById('btn-export-data');
if (exportBtn) exportBtn.addEventListener('click', exportData);

const importInput = document.getElementById('import-file-input');
if (importInput) {
    importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) importDataFromFile(file);
        e.target.value = '';
    });
}

// ==========================================
// MODAIS
// ==========================================
let currentTaskCallback = null;
const taskModal = document.getElementById('task-modal');
const taskTitleInput = document.getElementById('modal-task-text');
const taskAssigneeInput = document.getElementById('modal-task-assignee');
const taskDueDateInput = document.getElementById('modal-task-duedate');
const modalTitle = document.getElementById('modal-title');

function openTaskModal(title, defaultText, defaultAssignee, defaultDueDate, callback) {
    if (modalTitle) modalTitle.textContent = title;
    if (taskTitleInput) taskTitleInput.value = defaultText || '';
    const defaultUser = localStorage.getItem('kanbanUser') || 'Saniel';
    if (taskAssigneeInput) taskAssigneeInput.value = defaultAssignee || defaultUser;
    if (taskDueDateInput) taskDueDateInput.value = defaultDueDate || '';
    currentTaskCallback = callback;
    if (taskModal) taskModal.classList.add('active');
    if (taskTitleInput) taskTitleInput.focus();
}

function closeTaskModal() { 
    if (taskModal) taskModal.classList.remove('active'); 
    currentTaskCallback = null; 
}

const cancelTaskBtn = document.getElementById('btn-cancel-task');
if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', closeTaskModal);

const saveTaskBtn = document.getElementById('btn-save-task');
if (saveTaskBtn) {
    saveTaskBtn.addEventListener('click', () => {
        const text = taskTitleInput ? taskTitleInput.value.trim() : '';
        const assignee = taskAssigneeInput ? taskAssigneeInput.value.trim() || 'Sem responsável' : 'Sem responsável';
        const dueDate = taskDueDateInput ? taskDueDateInput.value : ''; 
        if (text !== '') {
            if (currentTaskCallback) currentTaskCallback(text, assignee, dueDate);
            closeTaskModal();
            saveBoard();
        }
    });
}

let currentColCallback = null;
const colModal = document.getElementById('column-modal');
const colModalTitle = document.getElementById('column-modal-title');
const colTitleInput = document.getElementById('modal-column-title');
const colSaveBtn = document.getElementById('btn-save-column');

function openColModal(defaultTitle, modalHeading, saveLabel, callback) {
    if (colTitleInput) colTitleInput.value = defaultTitle || '';
    if (colModalTitle) colModalTitle.textContent = modalHeading || 'Nome da coluna';
    if (colSaveBtn) colSaveBtn.textContent = saveLabel || 'Criar Coluna';
    currentColCallback = callback;
    if (colModal) colModal.classList.add('active');
    if (colTitleInput) colTitleInput.focus();
}

function closeColModal() { 
    if (colModal) colModal.classList.remove('active'); 
    currentColCallback = null; 
}

const cancelColBtn = document.getElementById('btn-cancel-column');
if (cancelColBtn) cancelColBtn.addEventListener('click', closeColModal);

if (colSaveBtn) {
    colSaveBtn.addEventListener('click', () => {
        const title = colTitleInput ? colTitleInput.value.trim() : '';
        if (title !== '') {
            if (currentColCallback) currentColCallback(title);
            closeColModal();
        }
    });
}

let currentConfirmCallback = null;
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');

function openConfirmModal(title, message, callback) {
    if (confirmTitle) confirmTitle.textContent = title;
    if (confirmMessage) confirmMessage.textContent = message;
    currentConfirmCallback = callback;
    if (confirmModal) confirmModal.classList.add('active');
}

function closeConfirmModal() { 
    if (confirmModal) confirmModal.classList.remove('active'); 
    currentConfirmCallback = null; 
}

const cancelConfirmBtn = document.getElementById('btn-cancel-confirm');
if (cancelConfirmBtn) cancelConfirmBtn.addEventListener('click', closeConfirmModal);

const saveConfirmBtn = document.getElementById('btn-save-confirm');
if (saveConfirmBtn) {
    saveConfirmBtn.addEventListener('click', () => {
        if (currentConfirmCallback) currentConfirmCallback();
        closeConfirmModal();
    });
}

// ==========================================
// ARRASTAR KANBAN E LOCALSTORAGE
// ==========================================
const boardElement = document.getElementById('board');

document.addEventListener('DOMContentLoaded', () => {
    checkActiveSession();

    const addColMainBtn = document.getElementById('add-column-btn');
    if (addColMainBtn) {
        addColMainBtn.addEventListener('click', () => {
            openColModal('', 'Nova Coluna', 'Criar Coluna', (title) => {
                const columnId = 'col-' + Date.now();
                createColumnElement(columnId, title);
                saveBoard();
            });
        });
    }
});

if (boardElement) {
    boardElement.addEventListener('dragover', e => {
        e.preventDefault();
        const draggingColumn = document.querySelector('.dragging-column');
        if (draggingColumn) {
            const afterElement = getDragAfterColumn(boardElement, e.clientX);
            if (afterElement == null) boardElement.appendChild(draggingColumn);
            else boardElement.insertBefore(draggingColumn, afterElement);
        }
    });
}

function getDragAfterColumn(container, x) {
    const draggableColumns = [...container.querySelectorAll('.column:not(.dragging-column)')];
    return draggableColumns.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getDragAfterCard(container, y) {
    const draggableCards = [...container.querySelectorAll('.card:not(.dragging)')];
    return draggableCards.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getInitials(name) {
    if (!name || name === 'Sem responsável') return '👤';
    return name.charAt(0).toUpperCase();
}

// ==========================================
// PRAZOS DE ENTREGA
// ==========================================
function formatISODate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateBR(isoDateStr) {
    const [year, month, day] = isoDateStr.split('-');
    return `${day}/${month}`;
}

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

function renderDueDate(badgeEl, dueDateStr) {
    badgeEl.dataset.duedate = dueDateStr || '';
    badgeEl.classList.remove('has-due', 'due-green', 'due-yellow', 'due-red');
    badgeEl.textContent = '';
    badgeEl.removeAttribute('aria-label');

    const info = getDueDateInfo(dueDateStr);
    if (!info) return;

    badgeEl.classList.add('has-due', 'due-' + info.level);
    badgeEl.textContent = '⏱ ' + info.label;
    badgeEl.setAttribute('aria-label', `Prazo de entrega: ${info.label}`);
}

function refreshAllDueBadges() {
    document.querySelectorAll('.due-badge').forEach(badge => {
        renderDueDate(badge, badge.dataset.duedate);
    });
}
setInterval(refreshAllDueBadges, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAllDueBadges(); });

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
    renameColBtn.innerHTML = '✏️';
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
    deleteColBtn.innerHTML = '🗑️';
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
            if (afterElement == null) container.appendChild(draggingCard);
            else container.insertBefore(draggingCard, afterElement);
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
            checkPermissions();
        });
    });
    form.appendChild(addBtn);

    column.appendChild(header);
    column.appendChild(container);
    column.appendChild(form);
    if (boardElement) boardElement.appendChild(column);
    checkPermissions();
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
    editBtn.innerHTML = '✏️';
    editBtn.addEventListener('click', () => {
        openTaskModal('Editar Tarefa', cardText.textContent, assigneeAvatar.dataset.assignee, dueBadge.dataset.duedate, (newText, newAssignee, newDueDate) => {
            cardText.textContent = newText;
            renderAssignee(assigneeAvatar, newAssignee);
            renderDueDate(dueBadge, newDueDate);
            saveBoard();
        });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('icon-btn');
    deleteBtn.innerHTML = '🗑️';
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
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAssigneeEditor(); }
    });

    footer.appendChild(dueBadge);
    footer.appendChild(assigneeAvatar);
    card.appendChild(header);
    card.appendChild(footer);

    card.addEventListener('dragstart', (e) => { e.stopPropagation(); card.classList.add('dragging'); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); saveBoard(); });

    return card;
}

function saveBoard() {
    const columnsData = [];
    document.querySelectorAll('.column').forEach(column => {
        const cardsData = [];
        column.querySelectorAll('.card').forEach(card => {
            const assigneeName = card.querySelector('.assignee-avatar').dataset.assignee || 'Sem responsável';
            const dueDate = card.querySelector('.due-badge').dataset.duedate || '';
            cardsData.push({ text: card.querySelector('.card-text').textContent, assignee: assigneeName, dueDate: dueDate });
        });
        columnsData.push({ id: column.id, title: column.querySelector('h2').textContent, cards: cardsData });
    });
    try { localStorage.setItem('kanbanDataPremium', JSON.stringify(columnsData)); } catch (err) { console.error(err); }
}

function loadBoard() {
    if (!boardElement) return;
    boardElement.innerHTML = '';
    const savedData = localStorage.getItem('kanbanDataPremium');
    if (!savedData) { checkPermissions(); return; }
    
    let columnsData;
    try { columnsData = JSON.parse(savedData); } catch (err) { checkPermissions(); return; }
    if (!Array.isArray(columnsData)) return;

    columnsData.forEach(colData => {
        if (!colData || !colData.id || !colData.title) return;
        const container = createColumnElement(colData.id, colData.title);
        (colData.cards || []).forEach(cardData => {
            if (!cardData || typeof cardData.text !== 'string') return;
            container.appendChild(createCardElement(cardData.text, cardData.assignee, cardData.dueDate));
        });
    });
    checkPermissions();
}

// ==========================================
// CALENDÁRIO
// ==========================================
let calendarViewDate = new Date();
let selectedCalendarDay = null;
const CALENDAR_MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

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
                dueDate, columnTitle, level: info ? info.level : 'green'
            });
        });
    });
    return tasks;
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('calendar-month-label');
    if (!grid || !label) return;
    grid.innerHTML = '';
    
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    label.textContent = `${CALENDAR_MONTH_NAMES[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay(); 
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

    if (selectedCalendarDay) renderCalendarDayTasks(selectedCalendarDay, tasksByDate[selectedCalendarDay] || []);
    else renderCalendarDayTasks(null, []);
}

function renderCalendarDayTasks(dateStr, tasks) {
    const list = document.getElementById('calendar-day-list');
    const heading = document.getElementById('calendar-day-heading');
    if (!list || !heading) return;
    list.innerHTML = '';
    
    if (!dateStr) { heading.textContent = 'Selecione um dia para ver as tarefas'; return; }
    
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
        meta.textContent = `${task.columnTitle} • ${task.assignee}`;
        item.appendChild(taskText);
        item.appendChild(meta);
        list.appendChild(item);
    });
}

const prevMonthBtn = document.getElementById('calendar-prev-month');
if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => { calendarViewDate.setMonth(calendarViewDate.getMonth() - 1); renderCalendar(); });

const nextMonthBtn = document.getElementById('calendar-next-month');
if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => { calendarViewDate.setMonth(calendarViewDate.getMonth() + 1); renderCalendar(); });

const todayBtn = document.getElementById('calendar-today-btn');
if (todayBtn) todayBtn.addEventListener('click', () => { calendarViewDate = new Date(); selectedCalendarDay = formatISODate(new Date()); renderCalendar(); });

// ==========================================
// CHAT DA EQUIPE
// ==========================================
const CHAT_STORAGE_KEY = 'kanbanChatMessages';
let currentChatChannel = 'geral';

function loadChatMessages() {
    try { return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || {}; } catch (err) { return {}; }
}
function saveChatMessages(data) {
    try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(data)); } catch (err) {}
}

function renderChatChannels() {
    const container = document.getElementById('chat-channels-container');
    if (!container) return;
    container.innerHTML = '';
    
    let channels = JSON.parse(localStorage.getItem('kanbanChatChannels'));
    if (!channels || channels.length === 0) {
        channels = ['geral', 'equipe', 'avisos'];
        localStorage.setItem('kanbanChatChannels', JSON.stringify(channels));
    }

    const isAdmin = checkPermissions();
    const addChannelBtn = document.getElementById('add-channel-btn');
    if (addChannelBtn) addChannelBtn.style.display = isAdmin ? 'block' : 'none';

    if (!channels.includes(currentChatChannel) && channels.length > 0) currentChatChannel = channels[0];

    channels.forEach(ch => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('chat-channel-wrapper');

        const btn = document.createElement('button');
        btn.classList.add('chat-channel');
        if (currentChatChannel === ch) btn.classList.add('active');
        btn.dataset.channel = ch;
        btn.textContent = '# ' + ch;
        
        btn.addEventListener('click', () => {
            currentChatChannel = ch;
            const titleEl = document.getElementById('chat-channel-title');
            if (titleEl) titleEl.textContent = '# ' + ch;
            renderChatChannels();
            renderChatMessages();
        });
        wrapper.appendChild(btn);

        if (isAdmin) {
            const delBtn = document.createElement('button');
            delBtn.classList.add('icon-btn', 'delete-channel-btn');
            delBtn.innerHTML = '🗑️';
            delBtn.style.display = 'block';
            delBtn.title = "Excluir canal";
            
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openConfirmModal('Excluir Canal', `Tem certeza que deseja excluir #${ch}?`, () => {
                    channels = channels.filter(c => c !== ch);
                    localStorage.setItem('kanbanChatChannels', JSON.stringify(channels));
                    const allMessages = loadChatMessages();
                    delete allMessages[ch];
                    saveChatMessages(allMessages);
                    renderChatChannels();
                    renderChatMessages();
                });
            });
            wrapper.appendChild(delBtn);
        }
        container.appendChild(wrapper);
    });
    
    const titleEl = document.getElementById('chat-channel-title');
    if (titleEl) titleEl.textContent = '# ' + currentChatChannel;
}

const addChannelBtn = document.getElementById('add-channel-btn');
if (addChannelBtn) {
    addChannelBtn.addEventListener('click', () => {
        openColModal('', 'Nome do Novo Canal', 'Criar Canal', (title) => {
            const safeTitle = title.trim().toLowerCase().replace(/\s+/g, '-');
            if (safeTitle === '') return;
            
            let channels = JSON.parse(localStorage.getItem('kanbanChatChannels')) || [];
            if (!channels.includes(safeTitle)) {
                channels.push(safeTitle);
                localStorage.setItem('kanbanChatChannels', JSON.stringify(channels));
                currentChatChannel = safeTitle;
                renderChatChannels();
                renderChatMessages();
            }
        });
    });
}

function renderChatMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
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

const chatInputForm = document.getElementById('chat-input-form');
if (chatInputForm) {
    chatInputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input ? input.value.trim() : '';
        if (!text) return;

        const author = localStorage.getItem('kanbanUser') || 'Saniel';
        const allMessages = loadChatMessages();
        if (!allMessages[currentChatChannel]) allMessages[currentChatChannel] = [];
        
        allMessages[currentChatChannel].push({
            author, text,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        });
        
        saveChatMessages(allMessages);
        if (input) input.value = '';
        renderChatMessages();
    });
}