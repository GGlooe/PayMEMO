// app.js - Основное приложение

/**
 * Инициализация приложения
 */
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация БД
    initDB();
    
    // Инициализация экрана входа
    initLoginScreen();
    
    // Проверка сессии
    const user = getCurrentUser();
    if (user && user !== 'guest') {
        showMainApp();
    }
});

/**
 * Переключение темы
 */
function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('paymemo_theme', isDark ? 'dark' : 'light');
}

// Применение сохраненной темы
const savedTheme = localStorage.getItem('paymemo_theme');
if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
}

/**
 * Переключение бокового меню на мобильных
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    sidebar.classList.toggle('mobile-menu-open');
    sidebar.classList.toggle('mobile-menu-closed');
    overlay.classList.toggle('hidden');
}

/**
 * Открытие модального окна
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

/**
 * Закрытие модального окна
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

/**
 * Переключение страницы
 */
function showPage(pageId) {
    // Скрываем все страницы
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('hidden');
    });
    
    // Показываем нужную
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    // Обновляем заголовок
    const titles = {
        dashboard: 'Дашборд',
        payments: 'Платежи',
        archive: 'Архив',
        analytics: 'Аналитика',
        logs: 'Журнал событий',
        users: 'Пользователи',
        settings: 'Настройки'
    };
    document.getElementById('pageTitle').textContent = titles[pageId] || '';
    
    // Обновляем активный пункт меню
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active-nav', 'bg-blue-50', 'dark:bg-gray-700', 'text-primary');
    });
    event.target.closest('.nav-item')?.classList.add('active-nav', 'bg-blue-50', 'dark:bg-gray-700', 'text-primary');
    
    // Инициализация специфичных страниц
    if (pageId === 'payments') {
        initPaymentsPage();
    } else if (pageId === 'analytics') {
        initAnalyticsPage();
    } else if (pageId === 'users') {
        initUsersPage();
    } else if (pageId === 'settings') {
        initSettingsPage();
    } else if (pageId === 'dashboard') {
        updateDashboard();
    }
    
    // На мобильных закрываем меню после выбора
    if (window.innerWidth < 768) {
        toggleSidebar();
    }
}

/**
 * Отрисовка журнала событий
 */
function renderLogs() {
    const tbody = document.getElementById('logsTableBody');
    if (!tbody) return;
    
    const logs = loadFromStorage('logs', []).slice(0, 50);
    
    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="py-4 text-center text-gray-500 dark:text-gray-400">
                    Записей не найдено
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = logs.map(log => `
        <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
            <td class="py-3 text-sm">${new Date(log.timestamp).toLocaleString('ru-RU')}</td>
            <td class="py-3 font-medium">${log.user}</td>
            <td class="py-3">${log.action}</td>
            <td class="py-3 text-gray-500 dark:text-gray-400 text-sm">${log.details}</td>
        </tr>
    `).join('');
}

/**
 * Отрисовка архива
 */
function renderArchive() {
    const tbody = document.getElementById('archiveTableBody');
    if (!tbody) return;
    
    const archive = getArchive();
    
    if (archive.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-4 text-center text-gray-500 dark:text-gray-400">
                    Архив пуст
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = archive.map(item => `
        <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
            <td class="py-3">${formatDate(item.date)}</td>
            <td class="py-3 font-medium">${item.bank}</td>
            <td class="py-3">${item.type}</td>
            <td class="py-3 text-right font-bold">${formatMoney(item.amount)}</td>
            <td class="py-3 text-center">
                <button onclick="restoreFromArchiveById('${item.id}')" class="text-green-500 hover:text-green-600 p-1" title="Восстановить">
                    <i class="fas fa-undo"></i>
                </button>
            </td>
            <td class="py-3 text-center">
                <button onclick="permanentlyDeleteById('${item.id}')" class="text-red-500 hover:text-red-600 p-1" title="Удалить навсегда">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function restoreFromArchiveById(id) {
    if (restoreFromArchive(id)) {
        showNotification('Платеж восстановлен', 'success');
        renderArchive();
    }
}

function permanentlyDeleteById(id) {
    if (confirm('Удалить эту запись навсегда? Это действие нельзя отменить.')) {
        if (permanentlyDeleteFromArchive(id)) {
            showNotification('Запись удалена', 'info');
            renderArchive();
        }
    }
}
