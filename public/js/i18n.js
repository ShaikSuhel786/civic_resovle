// Civic Resolve AI: Central Persistent Bilingual State Engine (Telugu & English)
// Maintains central state to track language selection across all navigations, tabs, reloads, and sessions.

(function() {
  function getCentralStoredLang() {
    // 1. URL Parameter check: ?lang=te or ?lang=en
    try {
      if (typeof window !== 'undefined' && window.location) {
        const params = new URLSearchParams(window.location.search);
        const urlLang = params.get('lang');
        if (urlLang === 'en' || urlLang === 'te') {
          try {
            localStorage.setItem('civic_resolve_lang', urlLang);
            sessionStorage.setItem('civic_resolve_lang', urlLang);
            document.cookie = `civic_resolve_lang=${urlLang};path=/;max-age=31536000;SameSite=Lax`;
          } catch (_) {}
          return urlLang;
        }
      }
    } catch (_) {}

    // 2. Primary LocalStorage check
    try {
      const local = localStorage.getItem('civic_resolve_lang') || localStorage.getItem('civic_sync_lang');
      if (local === 'en' || local === 'te') return local;
    } catch (_) {}

    // 3. SessionStorage check
    try {
      const session = sessionStorage.getItem('civic_resolve_lang');
      if (session === 'en' || session === 'te') return session;
    } catch (_) {}

    // 4. User profile object preference in LocalStorage
    try {
      const userRaw = localStorage.getItem('civic_resolve_user') || localStorage.getItem('civic_sync_user');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        if (u && (u.preferredLanguage === 'te' || u.preferredLanguage === 'en')) {
          return u.preferredLanguage;
        }
      }
    } catch (_) {}

    // 5. Cookie check
    try {
      const match = document.cookie.match(/(?:^|;\s*)civic_resolve_lang=(en|te)/);
      if (match) return match[1];
    } catch (_) {}

    return 'en';
  }

  let broadcastChannel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('civic_resolve_i18n_bus');
    }
  } catch (_) {}

  const CivicI18n = {
    currentLang: getCentralStoredLang(),

    translations: {
      en: {
        brand: 'CIVIC RESOLVE AI',
        nav_home: 'Home',
        nav_how_it_works: 'How It Works',
        nav_impact: 'Impact',
        nav_login: 'Sign In',
        nav_report: 'Report an Issue',
        nav_dashboard: 'My Reports',
        nav_admin: 'Admin Operations',
        nav_staff: 'Staff Tasks',
        nav_home_back: '← Back to Home',
        nav_back_dashboard: '← Back to My Reports',
        btn_report_issue: 'Report Issue',
        btn_report_new: 'Report New Issue',
        btn_sign_out: 'Sign Out',
        hero_title: 'Smarter Cities, Happier Communities',
        hero_sub: 'AI-powered civic issue reporting and resolution for cleaner, safer, and more sustainable cities.',
        hero_btn_report: 'Report an Issue',
        hero_btn_dashboard: 'Explore Dashboard',
        stat_reported: 'Issues Reported',
        stat_resolved: 'Resolved',
        stat_rate: 'Resolution Rate',
        stat_days: 'Avg. Days',
        step_1_title: '1. Report',
        step_1_desc: 'Submit civic issues with location, address and photos.',
        step_2_title: '2. AI Analyses',
        step_2_desc: 'Smart categorisation, severity score & duplicate check.',
        step_3_title: '3. Assign',
        step_3_desc: 'Forwarded directly to the responsible municipal department.',
        step_4_title: '4. Track',
        step_4_desc: 'Real-time progress updates with complete transparency.',
        report_page_heading: 'Report a Civic Issue',
        report_page_sub: 'Help us build a cleaner, safer, and more sustainable city.',
        my_reports_heading: 'My Reported Issues',
        login_title: 'Welcome Back',
        login_sub: 'Sign in to your registered citizen or municipal account',
        login_btn: 'Sign In',
        tab_signin: 'Sign In',
        tab_register: 'Create Account',
        reg_title: 'Create Citizen Account',
        reg_sub: 'Register to report issues, track live municipal progress, and receive updates',
        reg_btn: 'Create Citizen Account',
        toggle_label: 'తెలుగు',
        toggle_title: 'Switch to Telugu'
      },
      te: {
        brand: 'సివిక్ రిసాల్వ్ AI',
        nav_home: 'హోమ్',
        nav_how_it_works: 'ఎలా పనిచేస్తుంది',
        nav_impact: 'ప్రభావం',
        nav_login: 'లాగిన్',
        nav_report: 'సమస్యను నివేదించండి',
        nav_dashboard: 'నా నివేదికలు',
        nav_admin: 'నిర్వాహక పనులు',
        nav_staff: 'సిబ్బంది పనులు',
        nav_home_back: '← హోమ్‌కి తిరిగి వెళ్ళండి',
        nav_back_dashboard: '← నా నివేదికలకు వెళ్ళండి',
        btn_report_issue: 'సమస్యను నివేదించండి',
        btn_report_new: 'కొత్త సమస్యను నివేదించండి',
        btn_sign_out: 'లాగ్ అవుట్',
        hero_title: 'స్మార్ట్ నగరాలు, సంతోషకరమైన సమాజాలు',
        hero_sub: 'పరిశుభ్రమైన, సురక్షితమైన మరియు స్థిరమైన నగరాల కోసం AI- ఆధారిత పౌర సమస్యల పరిష్కార వేదిక.',
        hero_btn_report: 'సమస్యను నివేదించండి',
        hero_btn_dashboard: 'డ్యాష్‌బోర్డ్ చూడండి',
        stat_reported: 'నివేదించబడిన సమస్యలు',
        stat_resolved: 'పరిష్కరించబడినవి',
        stat_rate: 'పరిష్కార రేటు',
        stat_days: 'సగటు రోజులు',
        step_1_title: '1. నివేదించండి',
        step_1_desc: 'లొకేషన్ మరియు ఫోటోలతో పౌర సమస్యలను నివేదించండి.',
        step_2_title: '2. AI విశ్లేషణ',
        step_2_desc: 'స్మార్ట్ వర్గీకరణ, తీవ్రత స్కోర్ మరియు డూప్లికేట్ తనిఖీ.',
        step_3_title: '3. అప్పగింత',
        step_3_desc: 'సంబంధిత మునిసిపల్ విభాగానికి నేరుగా పంపబడుతుంది.',
        step_4_title: '4. ట్రాక్ చేయండి',
        step_4_desc: 'పరిష్కారం వరకు నిజ-సమయ పురోగతి అప్‌డేట్‌లు.',
        report_page_heading: 'పౌర సమస్యను నివేదించండి',
        report_page_sub: 'పరిశుభ్రమైన మరియు సురక్షితమైన నగరాన్ని నిర్మించడంలో సహాయపడండి.',
        my_reports_heading: 'నా నివేదికలు',
        login_title: 'స్వాగతం',
        login_sub: 'మీ నమోదిత పౌర లేదా మునిసిపల్ ఖాతాలోకి లాగిన్ అవ్వండి',
        login_btn: 'లాగిన్',
        tab_signin: 'లాగిన్',
        tab_register: 'ఖాతాను సృష్టించండి',
        reg_title: 'పౌర ఖాతాను సృష్టించండి',
        reg_sub: 'సమస్యలను నివేదించడానికి మరియు ప్రత్యక్ష పురోగతిని ట్రాక్ చేయడానికి నమోదు చేసుకోండి',
        reg_btn: 'పౌర ఖాతాను సృష్టించండి',
        toggle_label: 'English',
        toggle_title: 'Switch to English'
      }
    },

    getLanguage() {
      return this.currentLang;
    },

    setLanguage(lang, syncServer = true, notifyChannel = true) {
      if (lang !== 'en' && lang !== 'te') return;
      this.currentLang = lang;

      // 1. Persist across all central client stores
      try {
        localStorage.setItem('civic_resolve_lang', lang);
        localStorage.setItem('civic_sync_lang', lang);
        sessionStorage.setItem('civic_resolve_lang', lang);
        document.cookie = `civic_resolve_lang=${lang};path=/;max-age=31536000;SameSite=Lax`;
      } catch (_) {}

      // 2. Set html lang attribute
      if (document.documentElement) {
        document.documentElement.lang = lang;
      }

      // 3. Broadcast to all open tabs and windows
      if (notifyChannel && broadcastChannel) {
        try {
          broadcastChannel.postMessage({ lang });
        } catch (_) {}
      }

      // 4. Sync with authenticated user session & server if logged in
      if (syncServer) {
        try {
          const userRaw = localStorage.getItem('civic_resolve_user');
          if (userRaw) {
            const user = JSON.parse(userRaw);
            user.preferredLanguage = lang;
            localStorage.setItem('civic_resolve_user', JSON.stringify(user));
            if (window.CivicAPI && window.CivicAuth && CivicAuth.getToken()) {
              CivicAPI.request('/api/auth/profile', {
                method: 'PUT',
                body: JSON.stringify({ preferredLanguage: lang })
              }).catch(() => {});
            }
          }
        } catch (_) {}
      }

      // 5. Apply translations to current DOM
      this.apply();

      // 6. Dispatch custom event
      window.dispatchEvent(new CustomEvent('civic:languageChange', { detail: { lang } }));
    },

    toggle() {
      const next = this.currentLang === 'en' ? 'te' : 'en';
      this.setLanguage(next, true, true);
    },

    applyCurrentTranslations() {
      const dict = this.translations[this.currentLang] || this.translations.en;
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key] !== undefined) {
          el.textContent = dict[key];
        }
      });

      // Update toggle buttons across the UI
      const toggleLabel = this.currentLang === 'en' ? 'తెలుగు' : 'English';
      const toggleTitle = this.currentLang === 'en' ? 'Switch to Telugu' : 'Switch to English';
      document.querySelectorAll('#lang-toggle-btn, .lang-toggle-btn').forEach(btn => {
        btn.textContent = toggleLabel;
        btn.setAttribute('title', toggleTitle);
      });

      // Refresh sliding navbar indicator if GlassNav is available
      if (window.GlassNav && typeof window.GlassNav.refresh === 'function') {
        setTimeout(() => window.GlassNav.refresh(), 30);
      }
    },

    apply() {
      this.applyCurrentTranslations();
    }
  };

  // Immediate execution on script evaluation to set html lang attribute
  if (document.documentElement) {
    document.documentElement.lang = CivicI18n.currentLang;
  }

  // Cross-tab real-time storage event listener
  window.addEventListener('storage', (e) => {
    if ((e.key === 'civic_resolve_lang' || e.key === 'civic_sync_lang') && (e.newValue === 'en' || e.newValue === 'te')) {
      if (CivicI18n.currentLang !== e.newValue) {
        CivicI18n.setLanguage(e.newValue, false, false);
      }
    }
  });

  // Cross-tab BroadcastChannel listener
  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      if (event.data && (event.data.lang === 'en' || event.data.lang === 'te')) {
        if (CivicI18n.currentLang !== event.data.lang) {
          CivicI18n.setLanguage(event.data.lang, false, false);
        }
      }
    };
  }

  // MutationObserver to automatically translate newly added DOM nodes
  let mutationObserver = null;
  function observeMutations() {
    if (typeof MutationObserver === 'undefined') return;
    if (mutationObserver) mutationObserver.disconnect();
    mutationObserver = new MutationObserver((mutations) => {
      let needsTranslate = false;
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) { // ELEMENT_NODE
              if (node.hasAttribute && node.hasAttribute('data-i18n')) {
                needsTranslate = true;
                break;
              }
              if (node.querySelector && node.querySelector('[data-i18n], #lang-toggle-btn, .lang-toggle-btn')) {
                needsTranslate = true;
                break;
              }
            }
          }
        }
        if (needsTranslate) break;
      }
      if (needsTranslate) {
        CivicI18n.applyCurrentTranslations();
      }
    });

    const target = document.body || document.documentElement;
    if (target) {
      mutationObserver.observe(target, { childList: true, subtree: true });
    }
  }

  window.CivicI18n = CivicI18n;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      CivicI18n.apply();
      observeMutations();
    });
  } else {
    CivicI18n.apply();
    observeMutations();
  }
})();
