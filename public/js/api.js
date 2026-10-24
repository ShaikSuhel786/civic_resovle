// Civic Resolve AI: API Client & Notification Engine

const CivicAPI = {
  async request(endpoint, options = {}) {
    const token = CivicAuth.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      if (response.status === 401) {
        // If unauthorized, clear invalid session and prompt login
        if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
          CivicAuth.logout();
        }
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Request failed with status ' + response.status);
      }
      return data;
    } catch (err) {
      console.error('[API Error]', endpoint, err);
      throw err;
    }
  }
};

const CivicNotifications = {
  isOpen: false,

  async fetchUnread() {
    if (!CivicAuth.isAuthenticated()) return;
    try {
      const res = await CivicAPI.request('/api/notifications');
      const badge = document.getElementById('notif-badge-count');
      if (badge) {
        if (res.unreadCount > 0) {
          badge.textContent = res.unreadCount > 9 ? '9+' : res.unreadCount;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }

      const listContainer = document.getElementById('notif-items-list');
      if (listContainer && res.notifications) {
        if (res.notifications.length === 0) {
          listContainer.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No notifications yet.</div>';
        } else {
          listContainer.innerHTML = res.notifications.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'}" onclick="CivicNotifications.openNotif('${n.id}', '${n.report_id || ''}')" style="cursor: pointer;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.2rem;">
                <strong style="color: var(--primary-deep); font-size: 0.88rem;">${n.title}</strong>
                <span style="font-size: 0.72rem; color: var(--text-light);">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style="font-size: 0.82rem; color: var(--text-muted);">${n.message}</div>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.warn('Notification poll error:', err);
    }
  },

  toggleDropdown() {
    const menu = document.getElementById('notif-dropdown-menu');
    if (!menu) return;
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      menu.classList.add('show');
      this.fetchUnread();
    } else {
      menu.classList.remove('show');
    }
  },

  async openNotif(notifId, reportId) {
    try {
      await CivicAPI.request(`/api/notifications/${notifId}/read`, { method: 'POST' });
    } catch (e) {}
    if (reportId) {
      window.location.href = `/reports/${reportId}`;
    } else {
      this.fetchUnread();
    }
  },

  async markAllRead() {
    try {
      await CivicAPI.request('/api/notifications/mark-all-read', { method: 'POST' });
      this.fetchUnread();
    } catch (e) {
      console.error(e);
    }
  }
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const bell = document.getElementById('notif-bell-btn');
  const menu = document.getElementById('notif-dropdown-menu');
  if (menu && bell && !bell.contains(e.target) && !menu.contains(e.target)) {
    menu.classList.remove('show');
    CivicNotifications.isOpen = false;
  }
});
