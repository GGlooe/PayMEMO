// analytics.js - Аналитика и графики

let mainChartInstance = null;
let typeChartInstance = null;
let monthChartInstance = null;
let bankChartInstance = null;
let typeTrendChartInstance = null;

/**
 * Обновление дашборда
 */
function updateDashboard() {
    const payments = getPayments();
    const today = getToday();
    const currentMonth = today.substring(0, 7); // YYYY-MM
    
    // Фильтрация по текущему месяцу
    const monthPayments = payments.filter(p => p.date.startsWith(currentMonth));
    
    // Расчет статистики
    const monthTotal = monthPayments.reduce((sum, p) => sum + (p.status === 'paid' ? p.amount : 0), 0);
    const paidTotal = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    
    // Ближайшие платежи (7 дней)
    const upcoming = payments.filter(p => {
        if (p.status === 'paid') return false;
        const days = daysBetween(today, p.date);
        return days >= 0 && days <= 7;
    });
    
    // Просроченные
    const overdue = payments.filter(p => 
        p.status !== 'paid' && new Date(p.date) < new Date(today)
    );
    
    // Обновление карточек
    document.getElementById('dashMonthTotal').textContent = formatMoney(monthTotal);
    document.getElementById('dashUpcomingCount').textContent = upcoming.length;
    document.getElementById('dashOverdueCount').textContent = overdue.length;
    document.getElementById('dashPaidTotal').textContent = formatMoney(paidTotal);
    
    // Таблица ближайших платежей
    renderUpcomingTable(upcoming.slice(0, 5));
    
    // Графики
    renderMainChart(payments);
    renderTypeChart(payments);
}

/**
 * Отрисовка таблицы ближайших платежей
 */
function renderUpcomingTable(payments) {
    const tbody = document.getElementById('dashUpcomingTable');
    if (!tbody) return;
    
    if (payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-4 text-center text-gray-500 dark:text-gray-400">
                    Нет ближайших платежей
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = payments.map(p => {
        const daysLeft = daysBetween(getToday(), p.date);
        const statusClass = daysLeft < 0 ? 'text-danger' : daysLeft <= 3 ? 'text-warning' : 'text-success';
        
        return `
            <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                <td class="py-3">${formatDate(p.date)}</td>
                <td class="py-3 font-medium">${p.bank}</td>
                <td class="py-3">${p.type}</td>
                <td class="py-3 text-right font-bold ${statusClass}">${formatMoney(p.amount)}</td>
                <td class="py-3 text-center">
                    <span class="px-2 py-1 rounded-full text-xs ${daysLeft < 0 ? 'bg-red-100 text-red-600' : daysLeft <= 3 ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}">
                        ${daysLeft < 0 ? Math.abs(daysLeft) + ' дн. назад' : daysLeft === 0 ? 'Сегодня' : 'Через ' + daysLeft + ' дн.'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Главный график - динамика по месяцам
 */
function renderMainChart(payments) {
    const ctx = document.getElementById('mainChart');
    if (!ctx) return;
    
    // Группировка по месяцам за последние 6 месяцев
    const months = [];
    const data = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().substring(0, 7);
        const monthName = date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
        
        months.push(monthName);
        
        const monthPayments = payments.filter(p => 
            p.date.startsWith(monthKey) && p.status === 'paid'
        );
        const total = monthPayments.reduce((sum, p) => sum + p.amount, 0);
        data.push(total);
    }
    
    if (mainChartInstance) mainChartInstance.destroy();
    
    mainChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Расходы (₽)',
                data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

/**
 * График структуры по типам платежей
 */
function renderTypeChart(payments) {
    const ctx = document.getElementById('typeChart');
    if (!ctx) return;
    
    // Группировка по типам
    const types = {};
    payments.filter(p => p.status === 'paid').forEach(p => {
        types[p.type] = (types[p.type] || 0) + p.amount;
    });
    
    const labels = Object.keys(types);
    const data = Object.values(types);
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    
    if (typeChartInstance) typeChartInstance.destroy();
    
    typeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

/**
 * Инициализация страницы аналитики
 */
function initAnalyticsPage() {
    renderAnalyticsCharts();
}

/**
 * Отрисовка всех графиков аналитики
 */
function renderAnalyticsCharts() {
    const payments = getPayments();
    
    renderMonthChart(payments);
    renderBankChart(payments);
    renderTypeTrendChart(payments);
}

/**
 * График расходов по месяцам (столбчатый)
 */
function renderMonthChart(payments) {
    const ctx = document.getElementById('monthChart');
    if (!ctx) return;
    
    const months = [];
    const data = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().substring(0, 7);
        const monthName = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        
        months.push(monthName.charAt(0).toUpperCase() + monthName.slice(1));
        
        const monthPayments = payments.filter(p => 
            p.date.startsWith(monthKey) && p.status === 'paid'
        );
        const total = monthPayments.reduce((sum, p) => sum + p.amount, 0);
        data.push(total);
    }
    
    if (monthChartInstance) monthChartInstance.destroy();
    
    monthChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Расходы (₽)',
                data,
                backgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

/**
 * График расходов по банкам (круговой)
 */
function renderBankChart(payments) {
    const ctx = document.getElementById('bankChart');
    if (!ctx) return;
    
    const banks = {};
    payments.filter(p => p.status === 'paid').forEach(p => {
        banks[p.bank] = (banks[p.bank] || 0) + p.amount;
    });
    
    const labels = Object.keys(banks);
    const data = Object.values(banks);
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    
    if (bankChartInstance) bankChartInstance.destroy();
    
    bankChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

/**
 * График динамики по типам платежей (линейный)
 */
function renderTypeTrendChart(payments) {
    const ctx = document.getElementById('typeTrendChart');
    if (!ctx) return;
    
    // Получаем уникальные типы
    const types = [...new Set(payments.map(p => p.type))];
    
    // Последние 6 месяцев
    const months = [];
    const datasets = [];
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().substring(0, 7);
        const monthName = date.toLocaleDateString('ru-RU', { month: 'short' });
        months.push(monthName);
    }
    
    types.forEach((type, index) => {
        const data = [];
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthKey = date.toISOString().substring(0, 7);
            
            const typePayments = payments.filter(p => 
                p.type === type && 
                p.date.startsWith(monthKey) && 
                p.status === 'paid'
            );
            const total = typePayments.reduce((sum, p) => sum + p.amount, 0);
            data.push(total);
        }
        
        datasets.push({
            label: type,
            data,
            borderColor: colors[index % colors.length],
            tension: 0.4
        });
    });
    
    if (typeTrendChartInstance) typeTrendChartInstance.destroy();
    
    typeTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}
