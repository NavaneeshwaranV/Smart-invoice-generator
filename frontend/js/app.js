/**
 * Smart Invoice Generator - Core Frontend Engine
 */

const API_BASE = '/api';

// Currency and Date Formatters
export const formatCurrency = (amount, symbol = '₹') => {
  const num = Number(amount) || 0;
  return symbol + ' ' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Session & Auth Management
export const getAuthToken = async () => {
  let token = localStorage.getItem('smart_invoice_token');
  if (token) return token;

  try {
    const res = await fetch(`${API_BASE}/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'billing@sharmaelectronics.in', name: 'Rajesh Sharma' }),
    });
    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem('smart_invoice_token', data.token);
      localStorage.setItem('smart_invoice_user', JSON.stringify(data.user));
      return data.token;
    }
  } catch (err) {
    console.error('Failed to establish session token:', err);
  }
  return null;
};

// Unified Authenticated API Requester
export const api = async (endpoint, options = {}) => {
  let token = await getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    let res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      // Re-issue token and retry once
      localStorage.removeItem('smart_invoice_token');
      token = await getAuthToken();
      headers.Authorization = `Bearer ${token}`;
      res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    }

    // For file / blob downloads
    if (options.responseType === 'blob') {
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to download file`);
      return await res.blob();
    }

    const json = await res.json();
    return json;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
};

// Toast Notifications
export const showToast = (message, type = 'success') => {
  let container = document.querySelector('.toast-container-fixed');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container-fixed';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-success text-white' : type === 'danger' ? 'bg-danger text-white' : 'bg-primary text-white';
  const icon = type === 'success' ? 'bi-check-circle-fill' : type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill';

  toastEl.className = `toast align-items-center ${bgClass} border-0 shadow-lg mb-2`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2 py-2 px-3 fw-medium">
        <i class="bi ${icon} fs-5"></i>
        <span>${message}</span>
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  container.appendChild(toastEl);
  if (window.bootstrap && window.bootstrap.Toast) {
    const bsToast = new window.bootstrap.Toast(toastEl, { delay: 3500 });
    bsToast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  } else {
    setTimeout(() => toastEl.remove(), 3500);
  }
};

// Common Layout Initializer (Sidebar, Topbar, User profile)
export const initLayout = async (activePage) => {
  // Mobile sidebar toggle
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebar = document.querySelector('.app-sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');

  if (toggleBtn && sidebar && backdrop) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('show');
      backdrop.classList.toggle('show');
    });

    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('show');
      backdrop.classList.remove('show');
    });
  }

  // Active navigation link
  document.querySelectorAll('.sidebar-link').forEach((link) => {
    if (link.getAttribute('data-page') === activePage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Load business name in topbar / brand if available
  try {
    const res = await api('/business');
    if (res.success && res.data) {
      const b = res.data;
      const bTitle = document.getElementById('topbarBusinessName');
      if (bTitle) bTitle.textContent = b.businessName || 'Smart Invoice Generator';
      const bGstin = document.getElementById('topbarGstin');
      if (bGstin && b.gstin) bGstin.textContent = `GSTIN: ${b.gstin}`;
    }
  } catch (e) {
    // silently fallback to default
  }
};
