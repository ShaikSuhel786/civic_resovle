/**
 * Civic Resolve AI — The Resolution Journey
 * Interactive, scroll-driven civic resolution lifecycle engine.
 * Coordinates SVG route drawing, traveling packet tracer, destination markers,
 * and contextual stage telemetry panels.
 */

(function () {
  'use strict';

  let initialized = false;
  let scrollTrack = null;
  let stickyStage = null;
  let routePath = null;
  let routeGlow = null;
  let routeTracer = null;
  let stepButtons = [];
  let stagePanels = [];
  let markers = [];
  let pathLength = 0;
  let currentStage = 1;
  let isReducedMotion = false;
  let isMobile = false;
  let isManualNavigating = false;
  let manualNavTimeout = null;

  // Destination ratios along the SVG route (normalized 0 to 1)
  const STAGE_PROGRESS_POINTS = {
    1: 0.02,
    2: 0.35,
    3: 0.68,
    4: 1.00
  };

  function checkMediaQueries() {
    isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    isMobile = window.innerWidth <= 900;
  }

  function setStage(stageNum, smoothScroll = false) {
    if (stageNum < 1) stageNum = 1;
    if (stageNum > 4) stageNum = 4;
    currentStage = stageNum;

    // 1. Update Step Nav Buttons
    stepButtons.forEach((btn) => {
      const step = parseInt(btn.getAttribute('data-step'), 10);
      const isCurrent = step === stageNum;
      const isPast = step < stageNum;

      btn.classList.toggle('active', isCurrent);
      btn.classList.toggle('completed', isPast);
      btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
      btn.tabIndex = isCurrent ? 0 : -1;
    });

    // 2. Update Contextual Panels
    stagePanels.forEach((panel) => {
      const step = parseInt(panel.getAttribute('data-stage'), 10);
      const isCurrent = step === stageNum;
      panel.classList.toggle('active', isCurrent);
      panel.setAttribute('aria-hidden', isCurrent ? 'false' : 'true');
    });

    // 3. Update Destination Markers in SVG
    markers.forEach((marker) => {
      const step = parseInt(marker.getAttribute('data-stage'), 10);
      const isCurrent = step === stageNum;
      const isPast = step < stageNum;

      marker.classList.toggle('active', isCurrent);
      marker.classList.toggle('completed', isPast);
    });

    // 4. Update SVG Route & Tracer if reduced motion or manual
    if (routePath && pathLength > 0) {
      const targetRatio = STAGE_PROGRESS_POINTS[stageNum];
      const targetOffset = pathLength * (1 - targetRatio);

      if (isReducedMotion || isMobile) {
        routePath.style.strokeDashoffset = targetOffset;
        if (routeGlow) routeGlow.style.strokeDashoffset = targetOffset;
        updateTracer(targetRatio);
      }
    }

    // 5. If smoothScroll requested on desktop, scroll track to stage
    if (smoothScroll && !isMobile && scrollTrack) {
      const trackRect = scrollTrack.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const trackTop = trackRect.top + scrollTop;
      const trackHeight = scrollTrack.offsetHeight;
      const viewportHeight = window.innerHeight;
      const maxScroll = trackHeight - viewportHeight;

      if (maxScroll > 0) {
        isManualNavigating = true;
        clearTimeout(manualNavTimeout);

        const targetProgress = (stageNum - 1) / 3.0; // 0, 0.33, 0.66, 1.0
        const targetY = trackTop + (maxScroll * targetProgress);

        window.scrollTo({
          top: targetY,
          behavior: 'smooth'
        });

        manualNavTimeout = setTimeout(() => {
          isManualNavigating = false;
        }, 800);
      }
    }
  }

  function updateTracer(ratio) {
    if (!routePath || !routeTracer || pathLength <= 0) return;
    try {
      const clampedRatio = Math.max(0, Math.min(1, ratio));
      const distance = pathLength * clampedRatio;
      const pt = routePath.getPointAtLength(distance);
      routeTracer.setAttribute('transform', `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
    } catch (_) {}
  }

  function onScroll() {
    if (isReducedMotion || isMobile || isManualNavigating || !scrollTrack) return;

    const trackRect = scrollTrack.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const trackHeight = scrollTrack.offsetHeight;
    const maxScroll = trackHeight - viewportHeight;

    if (maxScroll <= 0) return;

    // Progress through the track: 0 when top enters/reaches top, 1 when bottom reached
    const scrolled = -trackRect.top;
    const rawProgress = scrolled / maxScroll;
    const progress = Math.max(0, Math.min(1, rawProgress));

    // Update SVG Route Path & Tracer continuously
    if (routePath && pathLength > 0) {
      const offset = pathLength * (1 - progress);
      routePath.style.strokeDashoffset = offset;
      if (routeGlow) routeGlow.style.strokeDashoffset = offset;
      updateTracer(progress);
    }

    // Map progress to Stage:
    // Stage 1: 0.00 - 0.25
    // Stage 2: 0.25 - 0.50
    // Stage 3: 0.50 - 0.75
    // Stage 4: 0.75 - 1.00
    let detectedStage = 1;
    if (progress >= 0.75) {
      detectedStage = 4;
    } else if (progress >= 0.50) {
      detectedStage = 3;
    } else if (progress >= 0.25) {
      detectedStage = 2;
    } else {
      detectedStage = 1;
    }

    if (detectedStage !== currentStage) {
      setStage(detectedStage, false);
    }
  }

  function setupRouteSVG() {
    if (!routePath) return;
    try {
      pathLength = routePath.getTotalLength();
      routePath.style.strokeDasharray = pathLength;
      routePath.style.strokeDashoffset = pathLength;

      if (routeGlow) {
        routeGlow.style.strokeDasharray = pathLength;
        routeGlow.style.strokeDashoffset = pathLength;
      }

      // Initial tracer position
      updateTracer(STAGE_PROGRESS_POINTS[1]);
    } catch (e) {
      console.warn('SVG path measurement error:', e);
    }
  }

  function bindEvents() {
    // Stepper Button Clicks
    stepButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const step = parseInt(btn.getAttribute('data-step'), 10);
        setStage(step, true);
      });

      // Keyboard arrow navigation on tabs
      btn.addEventListener('keydown', (e) => {
        const step = parseInt(btn.getAttribute('data-step'), 10);
        let targetStep = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          targetStep = step < 4 ? step + 1 : 1;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          targetStep = step > 1 ? step - 1 : 4;
        } else if (e.key === 'Home') {
          targetStep = 1;
        } else if (e.key === 'End') {
          targetStep = 4;
        }

        if (targetStep !== null) {
          e.preventDefault();
          const targetBtn = document.querySelector(`.journey-step-btn[data-step="${targetStep}"]`);
          if (targetBtn) {
            targetBtn.focus();
            setStage(targetStep, true);
          }
        }
      });
    });

    // Destination Pin Clicks in SVG
    markers.forEach((marker) => {
      marker.addEventListener('click', () => {
        const step = parseInt(marker.getAttribute('data-stage'), 10);
        setStage(step, true);
      });
      marker.style.cursor = 'pointer';
    });

    // Next / Previous Action Buttons inside Panels
    document.querySelectorAll('.btn-journey-nav').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.getAttribute('data-action');
        if (action === 'next' && currentStage < 4) {
          setStage(currentStage + 1, true);
        } else if (action === 'prev' && currentStage > 1) {
          setStage(currentStage - 1, true);
        } else if (action === 'restart') {
          setStage(1, true);
        }
      });
    });

    // Window Scroll Listener with RequestAnimationFrame
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          onScroll();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // Resize Listener
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        checkMediaQueries();
        setupRouteSVG();
        setStage(currentStage, false);
      }, 150);
    });
  }

  function init() {
    if (initialized) return;

    scrollTrack = document.getElementById('journey-scroll-track');
    stickyStage = document.getElementById('journey-sticky-stage');
    routePath = document.getElementById('journey-route-path');
    routeGlow = document.getElementById('journey-route-glow');
    routeTracer = document.getElementById('journey-route-tracer');
    stepButtons = Array.from(document.querySelectorAll('.journey-step-btn'));
    stagePanels = Array.from(document.querySelectorAll('.journey-stage-panel'));
    markers = Array.from(document.querySelectorAll('.journey-marker'));

    if (!scrollTrack || stepButtons.length === 0) {
      return;
    }

    checkMediaQueries();
    setupRouteSVG();
    bindEvents();

    // Default to Stage 1
    setStage(1, false);

    initialized = true;
    console.log('[CivicResolve] Resolution Journey interactive engine initialized.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export helper globally
  window.CivicResolutionJourney = {
    setStage: setStage,
    getCurrentStage: () => currentStage
  };
})();

