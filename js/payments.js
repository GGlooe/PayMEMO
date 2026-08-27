// payments.js - Управление платежами

let currentEditId = null;

/**
 * Отрисовка таблицы платежей
 */
function renderPaymentsTable() {
    const filters = getPaymentFilters();
    const payments = getPayments(filters);
    const tbody = document.getElementById('paymentsTableBody');
    
    if (!tbody) return;
    
    if (payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-gray-500 dark:text-gray-400">
                    <i class="fas fa-inbox text-3xl mb-2"></i>
                    <p>Платежей не найдено</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = payments.map(payment => {
        const statusClass = payment.status === 'paid' ? 'text-success' : 
                           payment.status === 'overdue' ? 'text-danger' : 'text-warning';
        const statusIcon = payment.status === 'paid' ? 'check-circle' : 
                          payment.status === 'overdue' ? 'exclamation-circle' : 'clock';
        
        return `
            <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                <td class="py-3">${formatDate(payment.date)}</td>
                <td class="py-3 font-medium">${payment.bank}</td>
                <td class="py-3">${payment.type}</td>
                <td class="py-3 text-right font-bold ${statusClass}">${formatMoney(payment.amount)}</td>
                <td class="py-3 text-center">
                    <span class="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-600 ${statusClass}">
                        <i class="fas fa-${statusIcon}"></i>
                        ${payment.status === 'paid' ? 'Оплачен' : payment.status === 'overdue' ? 'Просрочен' : 'Ожидается'}
                    </span>
                </td>
                <td class="py-3 text-center">
                    <div class="flex items-center justify-center space-x-2">
                        <button onclick="editPayment('${payment.id}')" class="text-blue-500 hover:text-blue-600 p-1">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deletePaymentById('${payment.id}')" class="text-red-500 hover:text-red-600 p-1">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Получение фильтров из UI
 */
function getPaymentFilters() {
    const bankFilter = document.getElementById('bankFilter')?.value || '';
    const typeFilter = document.getElementById('typeFilter')?.value || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    
    return {
        bank: bankFilter || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined
    };
}

/**
 * Открытие модального окна для добавления/редактирования
 */
function openPaymentModal(paymentId = null) {
    currentEditId = paymentId;
    const modal = document.getElementById('paymentModal');
    const title = document.getElementById('paymentModalTitle');
    const form = document.getElementById('paymentForm');
    
    // Заполнение селектов
    populatePaymentSelects();
    
    if (paymentId) {
        // Режим редактирования
        const payments = getPayments();
        const payment = payments.find(p => p.id === paymentId);
        
        if (payment) {
            title.textContent = 'Редактировать платеж';
            document.getElementById('paymentBank').value = payment.bank;
            document.getElementById('paymentType').value = payment.type;
            document.getElementById('paymentAmount').value = payment.amount;
            document.getElementById('paymentDate').value = payment.date;
            document.getElementById('paymentStatus').value = payment.status;
            document.getElementById('paymentComment').value = payment.comment || '';
            
            // Если типа нет в списке, добавляем его временно
            const typeSelect = document.getElementById('paymentType');
            if (!Array.from(typeSelect.options).some(opt => opt.value === payment.type)) {
                const option = document.createElement('option');
                option.value = payment.type;
                option.textContent = payment.type;
                option.selected = true;
                typeSelect.insertBefore(option, typeSelect.firstChild);
            }
        }
    } else {
        // Режим добавления
        title.textContent = 'Добавить платеж';
        form.reset();
        document.getElementById('paymentDate').value = getToday();
        document.getElementById('paymentStatus').value = 'pending';
    }
    
    openModal('paymentModal');
}

/**
 * Заполнение селектов типами и банками
 */
function populatePaymentSelects() {
    const settings = getSettings();
    const types = settings.paymentTypes || [];
    const banks = settings.banks || [];
    
    const typeSelect = document.getElementById('paymentType');
    const bankSelect = document.getElementById('paymentBank');
    
    if (typeSelect) {
        typeSelect.innerHTML = types.map(t => `<option value="${t}">${t}</option>`).join('');
    }
    
    if (bankSelect) {
        bankSelect.innerHTML = banks.map(b => `<option value="${b}">${b}</option>`).join('');
    }
}

/**
 * Сохранение платежа (добавление или обновление)
 */
function savePayment(event) {
    event.preventDefault();
    
    const bank = document.getElementById('paymentBank').value;
    const type = document.getElementById('paymentType').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const date = parseDate(document.getElementById('paymentDate').value);
    const status = document.getElementById('paymentStatus').value;
    const comment = document.getElementById('paymentComment').value;
    
    if (!bank || !type || !amount || !date) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }
    
    const paymentData = {
        bank,
        type,
        amount,
        date,
        status,
        comment
    };
    
    if (currentEditId) {
        updatePayment(currentEditId, paymentData);
        showNotification('Платеж обновлен', 'success');
    } else {
        addPayment(paymentData);
        showNotification('Платеж добавлен', 'success');
    }
    
    closeModal('paymentModal');
    renderPaymentsTable();
    updateDashboard();
}

/**
 * Редактирование платежа
 */
function editPayment(id) {
    openPaymentModal(id);
}

/**
 * Удаление платежа
 */
function deletePaymentById(id) {
    if (confirm('Вы уверены, что хотите удалить этот платеж?')) {
        deletePayment(id);
        renderPaymentsTable();
        updateDashboard();
        showNotification('Платеж удален в архив', 'info');
    }
}

/**
 * Обработка импорта Excel
 */
function handleImport(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: false });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            // Пропускаем заголовок
            const rows = jsonData.slice(1);
            let imported = 0;
            
            rows.forEach(row => {
                if (row.length >= 4) {
                    const [bank, type, amountStr, dateStr, comment] = row;
                    
                    // Парсим сумму (удаляем пробелы и ₽)
                    const amount = parseFloat(String(amountStr).replace(/[^0-9.-]/g, ''));
                    
                    // Парсим дату в любом формате
                    const date = parseDate(dateStr);
                    
                    if (bank && amount && date) {
                        addPayment({
                            bank: String(bank).trim(),
                            type: String(type || 'Прочее').trim(),
                            amount,
                            date,
                            status: 'pending',
                            comment: String(comment || '').trim()
                        });
                        imported++;
                    }
                }
            });
            
            showNotification(`Импортировано платежей: ${imported}`, 'success');
            renderPaymentsTable();
            updateDashboard();
            
        } catch (error) {
            console.error('Ошибка импорта:', error);
            showNotification('Ошибка при импорте файла', 'error');
        }
    };
    
    reader.readAsArrayBuffer(file);
    input.value = '';
}

/**
 * Скачивание шаблона Excel
 */
function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    
    const data = [
        ['Банк', 'Тип платежа', 'Сумма', 'Дата платежа (ДД.ММ.ГГГГ)', 'Комментарий'],
        ['Сбербанк', 'Интернет', 500, '28.08.2026', 'Домашний интернет'],
        ['Тинькофф', 'ЖКУ', 3500, '15.09.2026', 'Квартплата'],
        ['', '', '', '', '']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
    XLSX.writeFile(wb, 'PayMEMO_Шаблон.xlsx');
}

/**
 * Инициализация страницы платежей
 */
function initPaymentsPage() {
    // Навешиваем обработчики фильтров
    const bankFilter = document.getElementById('bankFilter');
    const typeFilter = document.getElementById('typeFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    if (bankFilter) bankFilter.addEventListener('change', renderPaymentsTable);
    if (typeFilter) typeFilter.addEventListener('change', renderPaymentsTable);
    if (statusFilter) statusFilter.addEventListener('change', renderPaymentsTable);
    
    // Заполняем фильтры
    populateFilterSelects();
    
    renderPaymentsTable();
}

/**
 * Заполнение селектов фильтров
 */
function populateFilterSelects() {
    const settings = getSettings();
    const types = settings.paymentTypes || [];
    const banks = settings.banks || [];
    
    const bankFilter = document.getElementById('bankFilter');
    const typeFilter = document.getElementById('typeFilter');
    
    if (bankFilter) {
        bankFilter.innerHTML = '<option value="">Все банки</option>' + 
            banks.map(b => `<option value="${b}">${b}</option>`).join('');
    }
    
    if (typeFilter) {
        typeFilter.innerHTML = '<option value="">Все типы</option>' + 
            types.map(t => `<option value="${t}">${t}</option>`).join('');
    }
}
