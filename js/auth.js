// auth.js - Аутентификация и управление пользователями

/**
 * Инициализация экрана входа
 */
function initLoginScreen() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

/**
 * Обработка входа
 */
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');
    
    const result = authenticate(username, password);
    
    if (result.success) {
        errorEl.classList.add('hidden');
        showMainApp();
    } else {
        errorEl.textContent = result.message;
        errorEl.classList.remove('hidden');
    }
}

/**
 * Показ основного приложения после входа
 */
function showMainApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    // Обновление информации о пользователе
    updateUserDisplay();
    
    // Запрос разрешения на уведомления
    requestNotificationPermission();
    
    // Инициализация дашборда
    updateDashboard();
    
    // Запуск проверки уведомлений
    startNotificationChecker();
}

/**
 * Обновление отображения пользователя
 */
function updateUserDisplay() {
    const user = getCurrentUser();
    const isAdminUser = isAdmin();
    
    // Отображение имени
    document.getElementById('currentUserDisplay').textContent = user;
    document.getElementById('userAvatar').textContent = user.charAt(0).toUpperCase();
    
    // Показ/скрытие админских меню
    const logsNav = document.getElementById('logsNav');
    const usersNav = document.getElementById('usersNav');
    
    if (logsNav) logsNav.classList.toggle('hidden', !isAdminUser);
    if (usersNav) usersNav.classList.toggle('hidden', !isAdminUser);
}

/**
 * Выход из системы
 */
function logout() {
    logout();
    location.reload();
}

/**
 * Инициализация страницы пользователей (для админа)
 */
function initUsersPage() {
    renderUsersTable();
}

/**
 * Отрисовка таблицы пользователей
 */
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    const users = getUsers();
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-4 text-center text-gray-500 dark:text-gray-400">
                    Пользователей не найдено
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
            <td class="py-3">${user.username}</td>
            <td class="py-3">
                <span class="px-2 py-1 rounded-full text-xs ${user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}">
                    ${user.role === 'admin' ? 'Администратор' : 'Пользователь'}
                </span>
            </td>
            <td class="py-3">${formatDate(user.createdAt)}</td>
            <td class="py-3 text-center">
                <div class="flex items-center justify-center space-x-2">
                    <button onclick="editUser('${user.username}')" class="text-blue-500 hover:text-blue-600 p-1">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${user.username !== 'admin' ? `
                    <button onclick="deleteUserByName('${user.username}')" class="text-red-500 hover:text-red-600 p-1">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Открытие модального окна пользователя
 */
function openUserModal(username = null) {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    
    if (username) {
        const users = getUsers();
        const user = users.find(u => u.username === username);
        
        if (user) {
            title.textContent = 'Редактировать пользователя';
            document.getElementById('userUsername').value = user.username;
            document.getElementById('userUsername').disabled = true;
            document.getElementById('userPassword').value = user.password;
            document.getElementById('userRole').value = user.role;
        }
    } else {
        title.textContent = 'Добавить пользователя';
        form.reset();
        document.getElementById('userUsername').disabled = false;
    }
    
    openModal('userModal');
}

/**
 * Сохранение пользователя
 */
function saveUser(event) {
    event.preventDefault();
    
    const username = document.getElementById('userUsername').value;
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;
    
    if (!username || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    const userData = { username, password, role };
    
    if (document.getElementById('userUsername').disabled) {
        // Редактирование
        const result = updateUser(username, userData);
        if (result.success) {
            showNotification('Пользователь обновлен', 'success');
        } else {
            showNotification(result.message, 'error');
        }
    } else {
        // Добавление
        const result = addUser(userData);
        if (result.success) {
            showNotification('Пользователь добавлен', 'success');
        } else {
            showNotification(result.message, 'error');
        }
    }
    
    closeModal('userModal');
    renderUsersTable();
}

/**
 * Удаление пользователя по имени
 */
function deleteUserByName(username) {
    if (confirm(`Вы уверены, что хотите удалить пользователя "${username}"?`)) {
        const result = deleteUser(username);
        if (result.success) {
            showNotification('Пользователь удален', 'success');
            renderUsersTable();
        } else {
            showNotification(result.message, 'error');
        }
    }
}

/**
 * Редактирование пользователя
 */
function editUser(username) {
    openUserModal(username);
}
