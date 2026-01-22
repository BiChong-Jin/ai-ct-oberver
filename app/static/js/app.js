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

        console.log('Attempting login for:', username);
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });

        console.log('Response status:', response.status);
        if (response.ok) {
            const data = await response.json();
            console.log('Login successful, token received');
            setToken(data.access_token);
            return true;
        }
        const errorData = await response.text();
        console.error('Login failed:', response.status, errorData);
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

let selectedFile = null;

function initApp() {
    const token = getToken();
    if (!token) {
        window.location.href = '/login';
        return;
    }

    loadUserInfo();
    setupEventListeners();
}

async function loadUserInfo() {
    const user = await getCurrentUser();
    if (user) {
        document.getElementById('user-info').textContent = `Welcome, ${user.username}`;
    }
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
