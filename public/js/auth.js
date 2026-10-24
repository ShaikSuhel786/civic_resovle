// Civic Resolve AI: Client Authentication, Session Management & Role-Based Navigation
// Production-grade: prevents role cross-contamination, flash, and nav jumping.

const CivicAuth = {
  getToken() {
    return localStorage.getItem('civic_resolve_token') || localStorage.getItem('civic_sync_token');
  },

  getUser() {
    const raw = localStorage.getItem('civic_resolve_user') || localStorage.getItem('civic_sync_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  setSession(token, user) {
    localStorage.setItem('civic_resolve_token', token);
    localStorage.setItem('civic_sync_token', token);

    // Respect existing central language state — NEVER overwrite it
    const currentCentralLang = (window.CivicI18n && CivicI18n.getLanguage)
      ? CivicI18n.getLanguage()
      : (localStorage.getItem('civic_resolve_lang') || 'en');

    if (user) {
      user.preferredLanguage = currentCentralLang;
    }

    localStorage.setItem('civic_resolve_user', JSON.stringify(user));
    localStorage.setItem('civic_sync_user', JSON.stringify(user));
  },

  logout() {
    // Preserve central language state across logout — always
    const preservedLang = (window.CivicI18n && CivicI18n.getLanguage)
      ? CivicI18n.getLanguage()
      : (localStorage.getItem('civic_resolve_lang') || 'en');

    localStorage.removeItem('civic_resolve_token');
    localStorage.removeItem('civic_resolve_user');
    localStorage.removeItem('civic_sync_token');
    localStorage.removeItem('civic_sync_user');

    // Re-stamp language immediately after clearing
    localStorage.setItem('civic_resolve_lang', preservedLang);
    sessionStorage.setItem('civic_resolve_lang', preservedLang);
    document.cookie = `civic_resolve_lang=${preservedLang};path=/;max-age=31536000;SameSite=Lax`;

    window.location.href = '/login';
  },

  isAuthenticated() {
    return Boolean(this.getToken() && this.getUser());
  },

  /**
   * Returns the canonical home URL for a given role.
   */
  getRoleDashboard(role) {
    if (role === 'admin') return '/admin';
    if (role === 'staff') return '/staff';
    return '/dashboard';
  },

  /**
   * Production-grade role guard.
   * - Shows body ONLY if auth passes (body starts as visibility:hidden via inline style).
   * - Silently redirects without alert().
   * - Returns true when the guard passes, false when a redirect was issued.
   */
  requireAuth(allowedRoles) {
    if (!this.isAuthenticated()) {
      window.location.replace('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return false;
    }

    const user = this.getUser();

    if (allowedRoles) {
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      if (!roles.includes(user.role)) {
        // Silent role-correct redirect — no alert(), no flash
        window.location.replace(this.getRoleDashboard(user.role));
        return false;
      }
    }

    // Auth passed — reveal the page body
    document.body.style.visibility = 'visible';
    return true;
  },

  /**
   * Builds role-specific navigation links and injects them into #nav-links-dynamic.
   * Falls back gracefully if the element doesn't exist.
   */
  renderNavLinks() {
    const user = this.getUser();
    const navUl = document.getElementById('nav-links-dynamic');
    if (!navUl) return;

    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

    const isActive = (href) => {
      const h = href.replace(/\/$/, '') || '/';
      return h === currentPath || (h !== '/' && currentPath.startsWith(h));
    };

    let links = [];

    if (!user) {
      // Public pages
      links = [
        { href: '/', label: 'Home', i18n: 'nav_home' },
        { href: '/report', label: 'Report Issue', i18n: 'nav_report' },
        { href: '/analytics', label: 'Impact', i18n: 'nav_impact' },
      ];
    } else if (user.role === 'admin') {
      links = [
        { href: '/', label: 'Home', i18n: 'nav_home' },
        { href: '/admin', label: 'Admin Operations', i18n: 'nav_admin' },
        { href: '/analytics', label: 'Aggregate Analytics', i18n: 'nav_impact' },
      ];
    } else if (user.role === 'staff') {
      links = [
        { href: '/', label: 'Home', i18n: 'nav_home' },
        { href: '/staff', label: 'My Tasks', i18n: 'nav_staff' },
        { href: '/analytics', label: 'Impact', i18n: 'nav_impact' },
      ];
    } else {
      // Citizen
      links = [
        { href: '/', label: 'Home', i18n: 'nav_home' },
        { href: '/dashboard', label: 'My Reports', i18n: 'nav_dashboard' },
        { href: '/report', label: 'Report Issue', i18n: 'nav_report' },
        { href: '/analytics', label: 'Impact', i18n: 'nav_impact' },
      ];
    }

    // Maintain the active tab sliding indicator element inside the nav
    const indicatorHtml = '<div class="nav-sliding-indicator" aria-hidden="true"></div>';
    navUl.innerHTML = indicatorHtml + links.map(l => `
      <li><a href="${l.href}" data-i18n="${l.i18n}"${isActive(l.href) ? ' class="active"' : ''}>${l.label}</a></li>
    `).join('');

    // Re-run i18n translations on freshly-rendered nav items
    if (window.CivicI18n && typeof CivicI18n.apply === 'function') {
      CivicI18n.apply();
    }

    // Re-initialise the glass sliding indicator for the updated links
    if (window.GlassNav) {
      GlassNav.init();
    }
  },

  /**
   * Renders the user action area (avatar, bell, lang toggle, sign-out).
   */
  renderUserNav() {
    const user = this.getUser();
    const navActions = document.getElementById('nav-user-actions');
    if (!navActions) return;

    const currentLang = (window.CivicI18n && CivicI18n.getLanguage)
      ? CivicI18n.getLanguage()
      : (localStorage.getItem('civic_resolve_lang') || 'en');
    const toggleLabel = currentLang === 'en' ? 'తెలుగు' : 'English';
    const toggleTitle = currentLang === 'en' ? 'Switch to Telugu' : 'Switch to English';

    if (!user) {
      navActions.innerHTML = `
        <div class="lang-switcher">
          <button class="btn btn-secondary btn-sm" id="lang-toggle-btn" onclick="CivicI18n.toggle()" title="${toggleTitle}">${toggleLabel}</button>
        </div>
        <a href="/login" class="btn btn-secondary btn-sm" data-i18n="nav_login">Sign In</a>
        <a href="/report" class="btn btn-primary btn-sm" data-i18n="nav_report">Report Issue</a>
      `;
      if (window.CivicI18n && typeof CivicI18n.apply === 'function') CivicI18n.apply();
      return;
    }

    let roleBadge = '<span class="badge badge-submitted">Citizen</span>';
    if (user.role === 'admin') roleBadge = '<span class="badge badge-urgent">Admin</span>';
    else if (user.role === 'staff') roleBadge = '<span class="badge badge-assigned">Staff</span>';

    const roleDashboardLink = this.getRoleDashboard(user.role);

    navActions.innerHTML = `
      <div class="lang-switcher">
        <button class="btn btn-secondary btn-sm" id="lang-toggle-btn" onclick="CivicI18n.toggle()" title="${toggleTitle}">${toggleLabel}</button>
      </div>
      <div style="position: relative;">
        <button class="notif-bell" id="notif-bell-btn" onclick="CivicNotifications.toggleDropdown()" title="Notifications">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          <span class="notif-badge" id="notif-badge-count" style="display: none;">0</span>
        </button>
        <div class="notif-dropdown" id="notif-dropdown-menu">
          <div class="notif-header">
            <strong>Notifications</strong>
            <button class="btn btn-sm btn-secondary" onclick="CivicNotifications.markAllRead()" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Mark all read</button>
          </div>
          <div class="notif-list" id="notif-items-list">
            <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Loading notifications...</div>
          </div>
        </div>
      </div>
      <div class="nav-user-chip">
        <a href="${roleDashboardLink}" style="display: flex; align-items: center; gap: 0.5rem; text-decoration: none;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--interactive-blue) 0%, #1D4ED8 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.82rem; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);">
            ${user.displayName.charAt(0)}
          </div>
          <span style="font-size: 0.88rem; font-weight: 600; color: var(--text-main);">${user.displayName.split(' ')[0]}</span>
        </a>
        ${roleBadge}
        <button onclick="CivicAuth.logout()" class="btn btn-secondary btn-sm" style="padding: 0.28rem 0.55rem; border-radius: 9999px;" title="Sign Out">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </div>
    `;

    if (window.CivicI18n && typeof CivicI18n.apply === 'function') CivicI18n.apply();

    // Initialize notification polling
    if (window.CivicNotifications && typeof CivicNotifications.fetchUnread === 'function') {
      CivicNotifications.fetchUnread();
    }
  },

  /**
   * Full nav bootstrap: renders both nav links and user actions, then reveals body.
   * Call this from DOMContentLoaded AFTER requireAuth() passes.
   */
  bootNav() {
    this.renderNavLinks();
    this.renderUserNav();
  }
};
