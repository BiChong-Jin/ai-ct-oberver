const TOKEN_KEY = 'ct_analyzer_token';

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
}

async function login(username, password) {
    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });

        if (response.ok) {
            const data = await response.json();
            setToken(data.access_token);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Login error:', error);
        return false;
    }
}

async function register(username, password) {
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
            return { success: true };
        }
        const errorData = await response.json();
        return { success: false, error: errorData.detail || 'Registration failed' };
    } catch (error) {
        console.error('Register error:', error);
        return { success: false, error: 'Network error' };
    }
}

function logout() {
    removeToken();
    window.location.href = '/login';
}

async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    if (!token) {
        window.location.href = '/login';
        return null;
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        removeToken();
        window.location.href = '/login';
        return null;
    }

    return response;
}

async function getCurrentUser() {
    const response = await fetchWithAuth('/api/auth/me');
    if (response && response.ok) {
        return await response.json();
    }
    return null;
}

async function analyzeImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetchWithAuth('/api/analyze', {
        method: 'POST',
        body: formData,
    });

    if (response && response.ok) {
        return await response.json();
    } else if (response) {
        const error = await response.json();
        throw new Error(error.detail || 'Analysis failed');
    }
    throw new Error('Request failed');
}

async function getHistory() {
    const response = await fetchWithAuth('/api/history');
    if (response && response.ok) {
        return await response.json();
    }
    return [];
}

let selectedFile = null;

function initApp() {
    const token = getToken();
    if (!token) {
        window.location.href = '/login';
        return;
    }

    loadUserInfo();
    setupEventListeners();
    setupTabs();
}

async function loadUserInfo() {
    const user = await getCurrentUser();
    if (user) {
        document.getElementById('user-info').textContent = `Welcome, ${user.username}`;
    }
}

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    document.getElementById(`${tabName}-tab`).classList.add('active');

    if (tabName === 'history') {
        loadHistory();
    }
}

async function loadHistory() {
    const historyList = document.getElementById('history-list');
    const historyLoading = document.getElementById('history-loading');
    const historyEmpty = document.getElementById('history-empty');

    historyList.innerHTML = '';
    historyLoading.classList.remove('hidden');
    historyEmpty.classList.add('hidden');

    try {
        const history = await getHistory();

        historyLoading.classList.add('hidden');

        if (history.length === 0) {
            historyEmpty.classList.remove('hidden');
            return;
        }

        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-item-header">
                    <span class="history-item-filename">${escapeHtml(item.filename)}</span>
                    <span class="history-item-date">${formatDate(item.created_at)}</span>
                </div>
                <div class="history-item-preview">${escapeHtml(item.analysis.substring(0, 150))}...</div>
            `;
            div.addEventListener('click', () => showHistoryDetail(item));
            historyList.appendChild(div);
        });
    } catch (error) {
        historyLoading.classList.add('hidden');
        historyList.innerHTML = '<p class="error-message">Failed to load history</p>';
    }
}

function showHistoryDetail(item) {
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');

    historyEmpty.classList.add('hidden');
    historyList.innerHTML = `
        <button class="btn btn-secondary back-btn" onclick="loadHistory()">Back to History</button>
        <div class="history-detail">
            <h3>${escapeHtml(item.filename)}</h3>
            <p class="date">${formatDate(item.created_at)}</p>
            <div class="analysis">${escapeHtml(item.analysis)}</div>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

function setupEventListeners() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const newAnalysisBtn = document.getElementById('new-analysis-btn');
    const logoutBtn = document.getElementById('logout-btn');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    analyzeBtn.addEventListener('click', handleAnalyze);
    newAnalysisBtn.addEventListener('click', resetUI);
    logoutBtn.addEventListener('click', logout);
}

function handleFileSelect(file) {
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert('Please select a valid image file (PNG, JPG, JPEG, GIF, or WEBP)');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert('File is too large. Maximum size is 10MB.');
        return;
    }

    selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('image-preview').src = e.target.result;
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('preview-section').classList.remove('hidden');
        document.getElementById('results-section').classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

async function handleAnalyze() {
    if (!selectedFile) return;

    const analyzeBtn = document.getElementById('analyze-btn');
    const loading = document.getElementById('loading');
    const previewSection = document.getElementById('preview-section');
    const resultsSection = document.getElementById('results-section');

    analyzeBtn.disabled = true;
    loading.classList.remove('hidden');

    try {
        const result = await analyzeImage(selectedFile);

        document.getElementById('analysis-content').textContent = result.analysis;
        document.getElementById('disclaimer-text').textContent = result.disclaimer;

        previewSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        analyzeBtn.disabled = false;
        loading.classList.add('hidden');
    }
}

function resetUI() {
    selectedFile = null;
    document.getElementById('file-input').value = '';
    document.getElementById('preview-section').classList.add('hidden');
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('image-preview').src = '';
    document.getElementById('file-name').textContent = '';
}
