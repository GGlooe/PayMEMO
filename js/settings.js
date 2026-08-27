// settings.js - Настройки и уведомления

/**
 * Инициализация страницы настроек
 */
function initSettingsPage() {
    renderSettings();
}

/**
 * Отрисовка настроек
 */
function renderSettings() {
    const settings = getSettings();
    
    // Типы платежей
    renderPaymentTypes(settings.paymentTypes || []);
    
    // Банки
    renderBanks(settings.banks || []);
    
    // Уведомления
    renderNotifications(settings.notifications || {});
}

/**
 * Отрисовка типов платежей
 */
function renderPaymentTypes(types) {
    const container = document.getElementById('paymentTypesList');
    if (!container) return;
    
    container.innerHTML = types.map((type, index) => `
        <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-lg mb-2">
            <span>${type}</span>
            <button onclick="removePaymentType(${index})" class="text-red-500 hover:text-red-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

/**
 * Отрисовка банков
 */
function renderBanks(banks) {
    const container = document.getElementById('banksList');
    if (!container) return;
    
    container.innerHTML = banks.map((bank, index) => `
        <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-lg mb-2">
            <span>${bank}</span>
            <button onclick="removeBank(${index})" class="text-red-500 hover:text-red-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

/**
 * Отрисовка настроек уведомлений
 */
function renderNotifications(notifications) {
    const enabledCheckbox = document.getElementById('notifEnabled');
    const notifyOnDayCheckbox = document.getElementById('notifyOnDay');
    const timesInput = document.getElementById('notifTimes');
    const daysBeforeInput = document.getElementById('notifDaysBefore');
    
    if (enabledCheckbox) enabledCheckbox.checked = notifications.enabled !== false;
    if (notifyOnDayCheckbox) notifyOnDayCheckbox.checked = notifications.notifyOnDay !== false;
    if (timesInput) timesInput.value = (notifications.times || ['09:00', '18:00']).join(',');
    if (daysBeforeInput) daysBeforeInput.value = (notifications.daysBefore || [0]).join(',');
}

/**
 * Добавление типа платежа
 */
function addPaymentType() {
    const input = document.getElementById('newPaymentType');
    if (!input) return;
    
    const type = input.value.trim();
    if (!type) return;
    
    const settings = getSettings();
    if (!settings.paymentTypes) settings.paymentTypes = [];
    
    if (!settings.paymentTypes.includes(type)) {
        settings.paymentTypes.push(type);
        saveSettings(settings);
        renderPaymentTypes(settings.paymentTypes);
        input.value = '';
        showNotification('Тип платежа добавлен', 'success');
    } else {
        showNotification('Такой тип уже существует', 'warning');
    }
}

/**
 * Удаление типа платежа
 */
function removePaymentType(index) {
    const settings = getSettings();
    settings.paymentTypes.splice(index, 1);
    saveSettings(settings);
    renderPaymentTypes(settings.paymentTypes);
}

/**
 * Добавление банка
 */
function addBank() {
    const input = document.getElementById('newBank');
    if (!input) return;
    
    const bank = input.value.trim();
    if (!bank) return;
    
    const settings = getSettings();
    if (!settings.banks) settings.banks = [];
    
    if (!settings.banks.includes(bank)) {
        settings.banks.push(bank);
        saveSettings(settings);
        renderBanks(settings.banks);
        input.value = '';
        showNotification('Банк добавлен', 'success');
    } else {
        showNotification('Такой банк уже существует', 'warning');
    }
}

/**
 * Удаление банка
 */
function removeBank(index) {
    const settings = getSettings();
    settings.banks.splice(index, 1);
    saveSettings(settings);
    renderBanks(settings.banks);
}

/**
 * Сохранение настроек уведомлений
 */
function saveNotificationSettings() {
    const enabled = document.getElementById('notifEnabled')?.checked !== false;
    const notifyOnDay = document.getElementById('notifyOnDay')?.checked !== false;
    const timesStr = document.getElementById('notifTimes')?.value || '09:00,18:00';
    const daysBeforeStr = document.getElementById('notifDaysBefore')?.value || '0';
    
    const times = timesStr.split(',').map(t => t.trim()).filter(t => t);
    const daysBefore = daysBeforeStr.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    
    const settings = getSettings();
    settings.notifications = {
        enabled,
        notifyOnDay,
        times: times.length > 0 ? times : ['09:00', '18:00'],
        daysBefore: daysBefore.length > 0 ? daysBefore : [0]
    };
    
    saveSettings(settings);
    showNotification('Настройки уведомлений сохранены', 'success');
}

/**
 * Тестирование системных уведомлений
 */
async function testNotification() {
    const granted = await requestNotificationPermission();
    
    if (granted) {
        sendSystemNotification(
            'PayMEMO: Тест уведомлений',
            'Системные уведомления работают корректно!',
            null
        );
        showNotification('Уведомление отправлено', 'success');
    } else {
        showNotification('Разрешение на уведомления не получено', 'error');
    }
}

/**
 * Очистка всех данных
 */
function clearAllData() {
    if (confirm('ВНИМАНИЕ: Это удалит ВСЕ данные (платежи, пользователей, настройки). Продолжить?')) {
        if (confirm('Вы абсолютно уверены? Это действие нельзя отменить!')) {
            localStorage.clear();
            sessionStorage.clear();
            location.reload();
        }
    }
}

/**
 * Экспорт данных в JSON
 */
function exportData() {
    const data = {
        payments: getPayments(),
        archive: getArchive(),
        users: getUsers(),
        settings: getSettings(),
        logs: loadFromStorage('logs', []),
        exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paymemo_backup_${getToday()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Данные экспортированы', 'success');
}

/**
 * Импорт данных из JSON
 */
function importData(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.payments) saveToStorage('payments', data.payments);
            if (data.archive) saveToStorage('archive', data.archive);
            if (data.users) saveToStorage('users', data.users);
            if (data.settings) saveToStorage('settings', data.settings);
            if (data.logs) saveToStorage('logs', data.logs);
            
            showNotification('Данные импортированы', 'success');
            setTimeout(() => location.reload(), 1000);
            
        } catch (error) {
            console.error('Ошибка импорта:', error);
            showNotification('Ошибка при импорте файла', 'error');
        }
    };
    
    reader.readAsText(file);
    input.value = '';
}
