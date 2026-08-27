// utils.js - Вспомогательные функции

/**
 * Форматирование даты из различных форматов в YYYY-MM-DD
 * Поддерживает: DD.MM.YYYY, YYYY-MM-DD, Date объекты
 */
function parseDate(dateInput) {
    if (!dateInput) return '';
    
    if (dateInput instanceof Date) {
        return dateInput.toISOString().split('T')[0];
    }
    
    const str = String(dateInput).trim();
    
    // Формат DD.MM.YYYY
    const dmyMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dmyMatch) {
        const [, day, month, year] = dmyMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Формат YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
        const [, year, month, day] = ymdMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Попытка распарсить как Date
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }
    
    return str;
}

/**
 * Форматирование даты для отображения DD.MM.YYYY
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
}

/**
 * Форматирование суммы
 */
function formatMoney(amount) {
    return new Intl.NumberFormat('ru-RU', { 
        style: 'currency', 
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Генерация уникального ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Получение текущей даты в формате YYYY-MM-DD
 */
function getToday() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Добавление дней к дате
 */
function addDays(dateStr, days) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

/**
 * Разница в днях между датами
 */
function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = d2 - d1;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Проверка, просрочена ли дата
 */
function isOverdue(dateStr) {
    return new Date(dateStr) < new Date(getToday());
}

/**
 * Сохранение в localStorage с префиксом пользователя
 */
function saveToStorage(key, data) {
    const user = getCurrentUser();
    const fullKey = `paymemo_${user}_${key}`;
    localStorage.setItem(fullKey, JSON.stringify(data));
}

/**
 * Чтение из localStorage с префиксом пользователя
 */
function loadFromStorage(key, defaultValue = null) {
    const user = getCurrentUser();
    const fullKey = `paymemo_${user}_${key}`;
    const item = localStorage.getItem(fullKey);
    return item ? JSON.parse(item) : defaultValue;
}

/**
 * Очистка хранилища пользователя
 */
function clearUserStorage() {
    const user = getCurrentUser();
    const prefix = `paymemo_${user}_`;
    
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
        }
    });
}

/**
 * Получение текущего пользователя из sessionStorage
 */
function getCurrentUser() {
    return sessionStorage.getItem('paymemo_user') || 'guest';
}

/**
 * Проверка, является ли пользователь админом
 */
function isAdmin() {
    const user = getCurrentUser();
    const users = loadFromStorage('users', []);
    const userData = users.find(u => u.username === user);
    return userData?.role === 'admin';
}

/**
 * Показ уведомления
 */
function showNotification(message, type = 'info') {
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    
    const notif = document.createElement('div');
    notif.className = `${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg fixed top-20 right-4 z-50 transition-all transform translate-x-0`;
    notif.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} mr-2"></i>${message}`;
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

/**
 * Запрос разрешения на системные уведомления
 */
async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    return false;
}

/**
 * Отправка системного уведомления
 */
function sendSystemNotification(title, body, icon = null) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body,
            icon: icon || '/favicon.ico',
            badge: '/favicon.ico',
            requireInteraction: false,
            tag: 'paymemo-notification'
        });
    }
}
