// State
let currentDate = new Date(); // Represents the currently viewed month
let today = new Date(); // Actual today
today.setHours(0,0,0,0);

// Admin Models
let categories = ['A棟', 'B棟', '公共區域'];
let taskTemplates = [
    { id: 't1', category: 'A棟', name: '男淋浴間', count: 4, order: 0 },
    { id: 't2', category: 'A棟', name: '女淋浴間', count: 4, order: 1 },
    { id: 't3', category: 'B棟', name: 'B棟淋浴間', count: 4, order: 0 },
    { id: 't4', category: 'A棟', name: 'A廁地板', count: 1, order: 2 },
];
let currentAdminCategory = categories[0];

// Default pool tasks initially empty, generated from templates
let poolTasks = [];

let scheduledTasks = [];

// DOM Elements
const taskPoolEl = document.getElementById('task-pool');
const calendarDaysEl = document.getElementById('calendar-days');
const monthLabel = document.getElementById('current-month-label');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');
const todayBtn = document.getElementById('today-btn');
const trashZone = document.getElementById('trash-zone');

// View Toggle Elements
const toggleViewBtn = document.getElementById('toggle-view-btn');
const calendarView = document.getElementById('calendar-view');
const adminView = document.getElementById('admin-view');

// Admin Elements
const areaListEl = document.getElementById('area-list');
const addAreaBtn = document.getElementById('add-area-btn');
const adminTasksContainer = document.getElementById('admin-tasks-container');
const addAdminTaskBtn = document.getElementById('add-task-btn');
const generatePoolBtn = document.getElementById('generate-pool-btn');

// View Toggle Logic
let isAdminView = false;
toggleViewBtn.addEventListener('click', () => {
    isAdminView = !isAdminView;
    if (isAdminView) {
        calendarView.style.display = 'none';
        adminView.style.display = 'block';
        toggleViewBtn.textContent = '返回日曆';
        renderAdminAreas();
        renderAdminTasks();
    } else {
        calendarView.style.display = 'block';
        adminView.style.display = 'none';
        toggleViewBtn.textContent = '編輯任務';
    }
});

// Event Listeners for Nav
prevBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
nextBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
todayBtn.addEventListener('click', () => { currentDate = new Date(); renderCalendar(); });

function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDate(str) {
    const [y, m, d] = str.split('-');
    return new Date(y, m-1, d);
}

// Drag & Drop Globals
let draggedItemData = null;
let dragSourceType = null; 
let wasDroppedSuccessfully = false;

function renderPool() {
    taskPoolEl.innerHTML = '';
    poolTasks.forEach(task => {
        const el = createTaskCard(task, 'pool');
        taskPoolEl.appendChild(el);
    });
}

function createTaskCard(task, source) {
    const card = document.createElement('div');
    card.className = `task-card ${source === 'calendar' ? 'calendar-card' : ''}`;
    card.draggable = true;
    card.dataset.id = task.id;
    if(task.status) card.dataset.status = task.status;
    
    // Check if overdue
    if (source === 'calendar' && task.status !== 'completed') {
        const tDate = parseDate(task.date);
        if (tDate < today) {
            card.classList.add('overdue');
        }
    }
    
    card.innerHTML = `<div class="task-name">${task.name}</div>`;
    
    if (source === 'calendar') {
        card.addEventListener('click', (e) => {
            toggleTaskStatus(task.id);
        });
    }
    
    // Drag Events
    card.addEventListener('dragstart', (e) => {
        draggedItemData = task;
        dragSourceType = source;
        wasDroppedSuccessfully = false;
        setTimeout(() => card.classList.add('dragging'), 0);
    });
    
    card.addEventListener('dragend', (e) => {
        card.classList.remove('dragging');
        
        // If it wasn't dropped in a valid zone and it's from calendar, return it to pool
        if (!wasDroppedSuccessfully && source === 'calendar') {
            scheduledTasks = scheduledTasks.filter(t => t.id !== task.id);
            poolTasks.push({ id: task.id, name: task.name });
            renderPool();
            renderCalendar();
        }
        
        draggedItemData = null;
        dragSourceType = null;
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    
    return card;
}

window.toggleTaskStatus = function(taskId) {
    const task = scheduledTasks.find(t => t.id === taskId);
    if (task) {
        task.status = task.status === 'completed' ? 'pending' : 'completed';
        renderCalendar();
    }
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    monthLabel.textContent = `${year}年 ${month + 1}月`;
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay();
    
    calendarDaysEl.innerHTML = '';
    
    const totalCells = daysInMonth + startingDayOfWeek;
    const rows = Math.ceil(totalCells / 7);
    calendarDaysEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    
    // Prev month filler
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = 0; i < startingDayOfWeek; i++) {
        const d = prevMonthLastDay - startingDayOfWeek + i + 1;
        const cellDate = new Date(year, month - 1, d);
        calendarDaysEl.appendChild(createDayCell(cellDate, true));
    }
    
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
        const cellDate = new Date(year, month, i);
        calendarDaysEl.appendChild(createDayCell(cellDate, false));
    }
    
    // Next month filler
    const remainingCells = (rows * 7) - totalCells;
    for (let i = 1; i <= remainingCells; i++) {
        const cellDate = new Date(year, month + 1, i);
        calendarDaysEl.appendChild(createDayCell(cellDate, true));
    }
}

function createDayCell(dateObj, isOtherMonth) {
    const cell = document.createElement('div');
    cell.className = `day-cell ${isOtherMonth ? 'other-month' : ''}`;
    
    const dateStr = formatDate(dateObj);
    cell.dataset.date = dateStr;
    
    const isToday = dateStr === formatDate(today);
    
    // Render tasks for this day (sorted so completed are at bottom)
    const dayTasks = scheduledTasks.filter(t => t.date === dateStr);
    dayTasks.sort((a,b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0));
    
    const dateHeader = document.createElement('div');
    dateHeader.className = 'day-header';
    
    const uniqueNames = new Set(dayTasks.map(t => t.name));
    const peopleCount = uniqueNames.size;
    
    const countSpan = document.createElement('span');
    countSpan.className = `day-people-count ${peopleCount === 0 ? 'empty' : ''}`;
    countSpan.textContent = peopleCount > 0 ? `👤 ${peopleCount}` : '';
    dateHeader.appendChild(countSpan);
    
    const dateSpan = document.createElement('div');
    dateSpan.className = `day-date ${isToday ? 'today' : ''}`;
    dateSpan.textContent = dateObj.getDate();
    dateHeader.appendChild(dateSpan);
    
    cell.appendChild(dateHeader);
    
    dayTasks.forEach(task => {
        cell.appendChild(createTaskCard(task, 'calendar'));
    });
    
    // Drop logic
    cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        cell.classList.add('drag-over');
    });
    
    cell.addEventListener('dragleave', () => {
        cell.classList.remove('drag-over');
    });
    
    cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        if (!draggedItemData || dragSourceType === 'admin') return;
        
        wasDroppedSuccessfully = true;
        handleDropOnDate(draggedItemData, dragSourceType, dateStr);
    });
    
    return cell;
}

function handleDropOnDate(taskData, source, targetDateStr) {
    if (source === 'pool') {
        const poolIndex = poolTasks.findIndex(t => t.id === taskData.id);
        if (poolIndex > -1) {
            const task = poolTasks.splice(poolIndex, 1)[0];
            scheduledTasks.push({
                id: task.id,
                name: task.name,
                date: targetDateStr,
                status: 'pending'
            });
        }
    } else if (source === 'calendar') {
        const taskInstance = scheduledTasks.find(t => t.id === taskData.id);
        if (taskInstance) taskInstance.date = targetDateStr;
    }
    renderPool();
    renderCalendar();
}

// Trash logic
trashZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    trashZone.classList.add('drag-over');
});
trashZone.addEventListener('dragleave', () => {
    trashZone.classList.remove('drag-over');
});
trashZone.addEventListener('drop', (e) => {
    e.preventDefault();
    trashZone.classList.remove('drag-over');
    if (!draggedItemData || dragSourceType === 'admin') return;
    
    wasDroppedSuccessfully = true;
    if (dragSourceType === 'calendar') {
        scheduledTasks = scheduledTasks.filter(t => t.id !== draggedItemData.id);
        poolTasks.push({
            id: draggedItemData.id,
            name: draggedItemData.name
        });
        renderPool();
        renderCalendar();
    }
});

/* =========================================
   Admin Logic
========================================= */

function renderAdminAreas() {
    areaListEl.innerHTML = '';
    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = `area-item ${cat === currentAdminCategory ? 'active' : ''}`;
        div.textContent = cat;
        div.addEventListener('click', () => {
            currentAdminCategory = cat;
            renderAdminAreas();
            renderAdminTasks();
        });
        areaListEl.appendChild(div);
    });
}

addAreaBtn.addEventListener('click', () => {
    const newCat = prompt('請輸入新區域名稱：');
    if (newCat && newCat.trim() && !categories.includes(newCat.trim())) {
        categories.push(newCat.trim());
        currentAdminCategory = newCat.trim();
        renderAdminAreas();
        renderAdminTasks();
    }
});

function renderAdminTasks() {
    adminTasksContainer.innerHTML = '';
    const catTasks = taskTemplates.filter(t => t.category === currentAdminCategory).sort((a,b) => a.order - b.order);
    
    catTasks.forEach((t, i) => {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.draggable = true;
        card.dataset.id = t.id;
        card.innerHTML = `
            <div class="template-info">
                <div class="template-name">${t.name}</div>
                <div class="template-count">每月 ${t.count} 次</div>
            </div>
            <div class="template-actions">
                <button onclick="editAdminTask('${t.id}')">✏️</button>
                <button onclick="deleteAdminTask('${t.id}')">🗑️</button>
            </div>
        `;
        
        // Admin Drag to Reorder
        card.addEventListener('dragstart', (e) => {
            draggedItemData = t;
            dragSourceType = 'admin';
            setTimeout(() => card.classList.add('dragging'), 0);
        });
        
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            draggedItemData = null;
            dragSourceType = null;
            document.querySelectorAll('.drag-placeholder').forEach(el => el.remove());
        });
        
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (dragSourceType !== 'admin') return;
            const draggingEl = document.querySelector('.template-card.dragging');
            if (draggingEl && draggingEl !== card) {
                const rect = card.getBoundingClientRect();
                const offset = e.clientY - rect.top - (rect.height / 2);
                if (offset < 0) {
                    adminTasksContainer.insertBefore(draggingEl, card);
                } else {
                    adminTasksContainer.insertBefore(draggingEl, card.nextSibling);
                }
            }
        });
        
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dragSourceType === 'admin') updateTemplateOrder();
        });
        
        adminTasksContainer.appendChild(card);
    });
}

function updateTemplateOrder() {
    const cards = adminTasksContainer.querySelectorAll('.template-card');
    cards.forEach((card, index) => {
        const t = taskTemplates.find(tpl => tpl.id === card.dataset.id);
        if (t) t.order = index;
    });
}

addAdminTaskBtn.addEventListener('click', () => {
    const name = prompt('新增任務名稱：');
    if (!name) return;
    const count = parseInt(prompt('每月次數：', '1')) || 1;
    
    const maxOrder = Math.max(...taskTemplates.filter(t => t.category === currentAdminCategory).map(t => (typeof t.order === 'number' ? t.order : -1)), -1);
    
    taskTemplates.push({
        id: 'tpl_' + Date.now(),
        category: currentAdminCategory,
        name: name.trim(),
        count: count,
        order: maxOrder + 1
    });
    renderAdminTasks();
});

window.editAdminTask = function(id) {
    const t = taskTemplates.find(x => x.id === id);
    if(!t) return;
    const newName = prompt('修改任務名稱：', t.name);
    if(newName === null) return;
    const newCount = parseInt(prompt('修改每月次數：', t.count)) || 1;
    
    t.name = newName.trim();
    t.count = newCount;
    renderAdminTasks();
};

window.deleteAdminTask = function(id) {
    if(confirm('確定要刪除此任務範本嗎？')) {
        taskTemplates = taskTemplates.filter(x => x.id !== id);
        renderAdminTasks();
    }
};

adminTasksContainer.addEventListener('dragover', e => {
    e.preventDefault();
});
adminTasksContainer.addEventListener('drop', e => {
    e.preventDefault();
    if (dragSourceType === 'admin') updateTemplateOrder();
});

generatePoolBtn.addEventListener('click', () => {
    if(confirm('這將產生所有的任務卡到任務池，確定嗎？')) {
        taskTemplates.forEach(t => {
            for(let i=0; i<t.count; i++) {
                poolTasks.push({
                    id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    name: t.name
                });
            }
        });
        renderPool();
        alert('任務已成功產生至清單！請返回日曆查看。');
    }
});

// Init
renderPool();
renderCalendar();
