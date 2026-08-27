// db.js - Работа с базой данных (localStorage)

/**
 * Инициализация базы данных
 */
function initDB() {
    // Инициализация пользователей по умолчанию
    let users = loadFromStorage('users', null);
    if (!users) {
        users = [{
            id: generateId(),
            username: 'admin',
            password: 'admin',
            role: 'admin',
            createdAt: getToday()
        }];
        saveToStorage('users', users);
    }
    
    // Инициализация настроек по умолчанию
    let settings = loadFromStorage('settings', null);
    if (!settings) {
        settings = {
            paymentTypes: ['Интернет', 'Телефон', 'ТВ', 'ЖКУ', 'Кредит', 'Прочее'],
            banks: ['Сбербанк', 'Тинькофф', 'ВТБ', 'Альфа-Банк'],
            notifications: {
                enabled: true,
                times: ['09:00', '18:00'],
                daysBefore: [0],
                notifyOnDay: true
            }
        };
        saveToStorage('settings', settings);
    }
    
    // Инициализация платежей
    let payments = loadFromStorage('payments', null);
    if (!payments) {
        saveToStorage('payments', []);
    }
    
    // Инициализация архива
    let archive = loadFromStorage('archive', null);
    if (!archive) {
        saveToStorage('archive', []);
    }
    
    // Инициализация журнала событий
    let logs = loadFromStorage('logs', null);
    if (!logs) {
        saveToStorage('logs', []);
    }
}

/**
 * Логирование событий
 */
function logEvent(action, details = '') {
    const logs = loadFromStorage('logs', []);
    const user = getCurrentUser();
    
    logs.unshift({
        id: generateId(),
        timestamp: new Date().toISOString(),
        user,
        action,
        details
    });
    
    // Храним последние 100 записей
    if (logs.length > 100) logs.splice(100);
    
    saveToStorage('logs', logs);
}

/**
 * Получение всех платежей с фильтрацией по пользователю
 */
function getPayments(filters = {}) {
    let payments = loadFromStorage('payments', []);
    const user = getCurrentUser();
    const isAdminUser = isAdmin();
    
    // Фильтрация по владельцу
    if (!isAdminUser) {
        payments = payments.filter(p => p.owner === user);
    }
    
    // Применение фильтров
    if (filters.bank) {
        payments = payments.filter(p => p.bank === filters.bank);
    }
    
    if (filters.type) {
        payments = payments.filter(p => p.type === filters.type);
    }
    
    if (filters.status) {
        payments = payments.filter(p => p.status === filters.status);
    }
    
    if (filters.month) {
        payments = payments.filter(p => p.date.startsWith(filters.month));
    }
    
    return payments.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Добавление платежа
 */
function addPayment(payment) {
    const payments = loadFromStorage('payments', []);
    const user = getCurrentUser();
    
    const newPayment = {
        id: generateId(),
        ...payment,
        owner: user,
        createdAt: new Date().toISOString()
    };
    
    payments.push(newPayment);
    saveToStorage('payments', payments);
    
    logEvent('add_payment', `Добавлен платеж: ${payment.bank} - ${formatMoney(payment.amount)}`);
    
    // Проверка уведомлений
    checkNotifications(newPayment);
    
    return newPayment;
}

/**
 * Обновление платежа
 */
function updatePayment(id, updates) {
    const payments = loadFromStorage('payments', []);
    const index = payments.findIndex(p => p.id === id);
    
    if (index === -1) {
        showNotification('Платеж не найден', 'error');
        return null;
    }
    
    payments[index] = { ...payments[index], ...updates };
    saveToStorage('payments', payments);
    
    logEvent('update_payment', `Обновлен платеж: ${payments[index].bank}`);
    
    return payments[index];
}

/**
 * Удаление платежа (перемещение в архив)
 */
function deletePayment(id) {
    const payments = loadFromStorage('payments', []);
    const index = payments.findIndex(p => p.id === id);
    
    if (index === -1) {
        showNotification('Платеж не найден', 'error');
        return false;
    }
    
    const payment = payments[index];
    payments.splice(index, 1);
    saveToStorage('payments', payments);
    
    // Перемещение в архив
    const archive = loadFromStorage('archive', []);
    archive.unshift({
        ...payment,
        archivedAt: new Date().toISOString(),
        archivedBy: getCurrentUser()
    });
    saveToStorage('archive', archive);
    
    logEvent('delete_payment', `Удален платеж: ${payment.bank}`);
    
    return true;
}

/**
 * Восстановление из архива
 */
function restoreFromArchive(id) {
    const archive = loadFromStorage('archive', []);
    const index = archive.findIndex(p => p.id === id);
    
    if (index === -1) {
        showNotification('Запись не найдена в архиве', 'error');
        return false;
    }
    
    const payment = archive[index];
    archive.splice(index, 1);
    saveToStorage('archive', archive);
    
    const payments = loadFromStorage('payments', []);
    const { archivedAt, archivedBy, ...restoredPayment } = payment;
    payments.push(restoredPayment);
    saveToStorage('payments', payments);
    
    logEvent('restore_payment', `Восстановлен платеж: ${payment.bank}`);
    
    return true;
}

/**
 * Получение архивных записей
 */
function getArchive(filters = {}) {
    let archive = loadFromStorage('archive', []);
    const user = getCurrentUser();
    const isAdminUser = isAdmin();
    
    if (!isAdminUser) {
        archive = archive.filter(p => p.owner === user);
    }
    
    return archive.sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
}

/**
 * Полное удаление из архива
 */
function permanentlyDeleteFromArchive(id) {
    const archive = loadFromStorage('archive', []);
    const index = archive.findIndex(p => p.id === id);
    
    if (index === -1) return false;
    
    archive.splice(index, 1);
    saveToStorage('archive', archive);
    
    logEvent('permanent_delete', `Удалено из архива: ${id}`);
    
    return true;
}

/**
 * Получение настроек
 */
function getSettings() {
    return loadFromStorage('settings', {});
}

/**
 * Сохранение настроек
 */
function saveSettings(settings) {
    saveToStorage('settings', settings);
    logEvent('update_settings', 'Настройки обновлены');
}

/**
 * Получение пользователей
 */
function getUsers() {
    return loadFromStorage('users', []);
}

/**
 * Добавление пользователя
 */
function addUser(userData) {
    const users = loadFromStorage('users', []);
    
    if (users.find(u => u.username === userData.username)) {
        return { success: false, message: 'Пользователь уже существует' };
    }
    
    const newUser = {
        id: generateId(),
        ...userData,
        createdAt: getToday()
    };
    
    users.push(newUser);
    saveToStorage('users', users);
    
    logEvent('add_user', `Добавлен пользователь: ${userData.username}`);
    
    return { success: true, user: newUser };
}

/**
 * Обновление пользователя
 */
function updateUser(username, updates) {
    const users = loadFromStorage('users', []);
    const index = users.findIndex(u => u.username === username);
    
    if (index === -1) {
        return { success: false, message: 'Пользователь не найден' };
    }
    
    users[index] = { ...users[index], ...updates };
    saveToStorage('users', users);
    
    logEvent('update_user', `Обновлен пользователь: ${username}`);
    
    return { success: true, user: users[index] };
}

/**
 * Удаление пользователя
 */
function deleteUser(username) {
    const users = loadFromStorage('users', []);
    
    if (users.length <= 1) {
        return { success: false, message: 'Нельзя удалить последнего пользователя' };
    }
    
    const index = users.findIndex(u => u.username === username);
    if (index === -1) return { success: false, message: 'Пользователь не найден' };
    
    users.splice(index, 1);
    saveToStorage('users', users);
    
    logEvent('delete_user', `Удален пользователь: ${username}`);
    
    return { success: true };
}

/**
 * Аутентификация пользователя
 */
function authenticate(username, password) {
    const users = loadFromStorage('users', []);
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        sessionStorage.setItem('paymemo_user', username);
        logEvent('login', `Вход пользователя: ${username}`);
        return { success: true, user };
    }
    
    return { success: false, message: 'Неверный логин или пароль' };
}

/**
 * Выход пользователя
 */
function logout() {
    logEvent('logout', `Выход пользователя: ${getCurrentUser()}`);
    sessionStorage.removeItem('paymemo_user');
}

/**
 * Проверка уведомлений для платежа
 */
function checkNotifications(payment) {
    const settings = getSettings();
    if (!settings.notifications?.enabled) return;
    
    const { daysBefore, notifyOnDay } = settings.notifications;
    const today = getToday();
    const paymentDate = parseDate(payment.date);
    
    // Уведомление в день платежа
    if (notifyOnDay && paymentDate === today) {
        sendSystemNotification(
            'PayMEMO: Платеж сегодня!',
            `${payment.bank}: ${formatMoney(payment.amount)} (${payment.type})`
        );
    }
    
    // Уведомления за N дней
    if (daysBefore && Array.isArray(daysBefore)) {
        daysBefore.forEach(days => {
            if (days > 0) {
                const notifyDate = addDays(today, days);
                if (paymentDate === notifyDate) {
                    sendSystemNotification(
                        `PayMEMO: Платеж через ${days} дн.`,
                        `${payment.bank}: ${formatMoney(payment.amount)} (${payment.type})`
                    );
                }
            }
        });
    }
}

/**
 * Запуск проверки уведомлений (вызывать периодически)
 */
function startNotificationChecker() {
    // Проверка каждые 30 секунд
    setInterval(() => {
        const payments = getPayments({ status: 'active' });
        payments.forEach(payment => checkNotifications(payment));
    }, 30000);
}
