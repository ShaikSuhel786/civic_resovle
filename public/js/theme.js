// Theme engine removed as requested — clean normal theme restored
(function() {
  try {
    localStorage.removeItem('civic_resolve_theme');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('bw-mode');
    const floatBtn = document.getElementById('theme-floating-bulb-btn');
    if (floatBtn) floatBtn.remove();
    const floatToggle = document.getElementById('floating-glass-toggle');
    if (floatToggle) floatToggle.remove();
  } catch(e) {}
})();
