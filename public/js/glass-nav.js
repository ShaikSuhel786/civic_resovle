// Civic Resolve AI: Apple Liquid Glass Sliding Navbar Engine
// Extracted and synthesized from liquid-glass-react (refraction, chromatic aberration & fluid elasticity)

const LIQUID_GLASS_DISPLACEMENT_MAP = "data:image/jpeg;base64,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cUAUAkEkziomgGgkoxZGgxZFQFQlYnQHRdPfj/10KCSCKESCNiVkViPSLpD0h6I0Q0I0A2IoBWBIJIBKBIJoJIJ2R2J0JWBUJ0JUB0XTv479dFZDYiglYigkhEgjZFQjRFQjRFQjQigFYigHYigmgEgmglYlYnQlQlYlQHQlQnQ9P/kf1yVkNiNCNkNiVENiNiViNEViNkVCVgKCViViViSCViSCVgdCViVCViVCdgVCVCdD1D+U/XBWQ2I0I2Q2JUQ2I0JWQ0I2JUQ2JUI2J0JWJWJWA2R0BWJ0I2JUJ2BUJUJ0P//EABkQAQEBAQEBAAAAAAAAAAAAAAECABEDEP/aAAgBAQABAgB1atWrVq1atWrVq1atWrVq1atWrVq1atWrVq+OrVq1atWrVq1atWrVq1atWrVq1atWrVq1atXxVppppppdWrVq1atWrVq1NNNNNNNNNNNPVWmmmmms6tWrVq1atWpppppppppppppp6q0000uc51atWrVq1ammmmmmmmmmmmmt1Vpppc5znVq1atWrVqaaaaaaaaaaaaaeqtNLnOc51atWrVq1ammmmmmmmmmmmmnqrS5znOc6tWrVq16222mmmmmmlVppp6tKuc5znOrVq1a9TbbbbTTTTTSq000qtLnOc5zq1atWrW0222200000qqqtKqrnOc5zq1atTbbbbbbbbTTTSqqqqqq5znOc6tTTTbbbbbbbbTTTSqqqqrlVznOctNNNtttttttttNNNNKqqqrqznKqrTTTTbbbbbbbbbTTTSqqqqrqznOc5aaaabbbbbbbbbaaaaVVVVVdWc5znVq1NNttttttttttNNKqqqqudWc5znVq16tbbbbbbbbbbTTSqqqq5XVnOc6tWrVrb1tttttttttNNKqqqqrWrK5VWmmm2230bbbbbbaaaXOc5zlVa1KuVVppptttt9G22222mmlzlVznK6tWVVWmmmm2222222222mlznOc5znLWppVVWmmm22222229bTWrOc5znOcq1qaaVpWmm222222229erVqznOc5znKtatStK0rTbTTbbbberXr1as5znOc5aVpppppWlabaabbbb1ta9WrVnOc5znU0rTTTTTTTTTbTTbbbTWvVq1as5znOdTTStNNNNNNNNNtNNtttN6tWvVq1ZznOrU00rTTTTTTTTTTTTTbTWvVq1atWrOc6tTTTStNNNNNNNNNNtNNtNa9WrVq1Z1Z1NNNNNK1q1NNNNNNNNNNNtNatWrVq1atWrU00000rWrVq1atWrVq1alaaa1atWrVq1NNNammmmla1atWrVq1aterVq16tWrVnVqa1NK1qaaaVX/xAAWEAADAAAAAAAAAAAAAAAAAAAhgJD/2gAIAQEAAz8AaExf/8QAGhEBAQEBAQEBAAAAAAAAAAAAAQISEQADEP/aAAgBAgEBAgDx48ePHjx48ePHjx48ePHjx48ePHjx48ePHj86IiIiIiInjx48ePHjx48IiIiIj0oooooooooRERER73ve60UUUUUUVrWiiiiiihERERER73ve97ooooorRWiiiiihKERERER73ve973RRRRWtFFFFFFCIiIiIiPe973ve60UUVrRRRRRRQiIlCIiI973ve973pRRWiiiiiiiiiiiiiiihEe973ve973RRWtFFFFFFFFFFFFFFFFFFa13ve973WitaKKKKKKKKKKKKKKKKKK1rWtd1rutFa1oooooooooooosssooorWta1rWta1rRRRRRRRRRRZZZZZZZZZWta1rWta1rRRRRRRRRZZZZZZZZZZZZe9a1rWta1rWitaKLLLLLLLLLLLLLLLLL3rWta1rWtFbLLLLLLLLLLLLLLLLLLLL3vWta1rWita1ssssssss+hZZZZZZZZe961rWta0Vre97LLLLLLLLLLLPoWWWWWXrWta1oorWta3ssss+hZZZZ9Cyyyyyyyyiita1orWta1ve9llllllllllllllllFFa0VorWta1ve9llllllllllllllllllFFFaK1rWta1rWiyyyyyyyyyyyyiiiiiiitFFa1rWta1oosoosssssoooosoooorRRRWta1rWta0UUUUUWUUUUUUUUUUUVoooorWta1rWtaKKKKKKmiiiiiiiiiiiiiiitd73ve61oSiiipoqaKKKKKKKKKK0UUUVrve973vREREZoSihEooooorRRRRWtd73ve9EREREREoSiiiiitFllllla73ve9ERERERESiiiiiitH0PoWWWWVrXe96IiIiMoiJRRRRRRWjwlFFllllFFd6IiIiIlCUUUUUUUUUePHjx48ePCIiIiIiIiUUUUUUUUUUUePHjx48ePHjx48ePHjx48IiUUUUUUJRRRX//xAAWEQADAAAAAAAAAAAAAAAAAAABYJD/2gAIAQIBAz8AtEV7/8QAFxEBAQEBAAAAAAAAAAAAAAAAAAECEP/aAAgBAwEBAgCtNNNNNNNNNNNNNNNNNNNNNNNNNNNNNcrTTTTTTTTTTTTTTTTTTTTTTTTTTTTTXKrTTTTTTTU000000000000000000001FVpppppqampqaaaaaaaaaaaaaaaaaaaa5Vaaaaampqampqammmmmmmmmmmlaaaaaaiq0001NTU1NTU1NTTTTTTTTTTSqqtNNNcqtNNSyzU1LNTU1NTTTTTTTTTSqqq001ytNLLLLNTU1NTU1NTbbbTTTTTSqqq001ytNLLLLLNTU1NTU3NttttNNNNNKqq001KrSyyyyyzU1NTU3Nzc02220000qqqqrSqqyyyyyzU1NTU3Nzc3NttttNNNKqqqqqqssssss1NTU3Nzc3NzbbbbTTTSqqqqqqrLLLLLNTU1Nzc3Nzc22220000qqqqqqqqssss1NTU3Nzc3NzbbbbbTTSqqqqqqqqqqzU1NTc3Nzc3Nzbc22000qqqqqqqqqqqtTU3Nzc3Nzc3NtzbTTSqqqqrKqqqqqtNNzc23Nzc3Nzc3NTU1KqqqrKqqqqqtNNNNttzc3Nzc3NzU1NLLLLLKqqqqqqqq0022223Nzc3NzU1NSyyyyyyqqqqqqqrTTbbbbc3Nzc3NTU1LLLLLLKsqqqqqqrTTTTbbbc3Nzc1NTUsssssssqqqqqqrTTTTTbbbTc3NTU1NTUsssssqqqqqqqq0000222023NTU1NTUsssssqqqqqqqq000000003NTU1NTU1LLLLLNKrTSqqqqtNNNNNNtNNTU1NSzUssss00qq0qqqqrTTTTTTTTTU1NTUs1LLLNNNKrTTTSqqq00000000001NTU1LNTU0000qtNNNKqqqtNNNNNNNNTU1NTUs1NNNNNKss1NNNK00qtK0000001NNTU0s000000qq000001NKrStNNNNK1NNNNStNNNNNKqtNNNNNNNK0000000rU0000rTTTTTSq00000rTTTTTTTTTTTTTTTTStNNNNKr/xAAUEQEAAAAAAAAAAAAAAAAAAACg/9oACAEDAQM/AAAf/9k=";

const GlassNav = {
  instances: [],

  init() {
    this.injectLiquidGlassDefs();
    const navLists = document.querySelectorAll('.nav-links');
    navLists.forEach(nav => {
      this.setupNav(nav);
    });
  },

  // Inject SVG chromatic displacement filter from liquid-glass-react
  injectLiquidGlassDefs() {
    if (document.getElementById('liquid-glass-svg-defs')) return;

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.id = 'liquid-glass-svg-defs';
    svg.setAttribute('style', 'position: absolute; width: 0; height: 0; pointer-events: none; overflow: hidden;');
    svg.setAttribute('aria-hidden', 'true');

    svg.innerHTML = `
      <defs>
        <filter id="liquid-glass-filter" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
          <feImage id="feimage" x="0" y="0" width="100%" height="100%" result="DISPLACEMENT_MAP" href="${LIQUID_GLASS_DISPLACEMENT_MAP}" preserveAspectRatio="xMidYMid slice" />
          <feColorMatrix in="DISPLACEMENT_MAP" type="matrix" values="0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0 0 0 1 0" result="EDGE_INTENSITY" />
          <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
            <feFuncA type="discrete" tableValues="0 0.08 1" />
          </feComponentTransfer>
          <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL" />
          <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale="-14" xChannelSelector="R" yChannelSelector="B" result="RED_DISPLACED" />
          <feColorMatrix in="RED_DISPLACED" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="RED_CHANNEL" />
          <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale="-12" xChannelSelector="R" yChannelSelector="B" result="GREEN_DISPLACED" />
          <feColorMatrix in="GREEN_DISPLACED" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="GREEN_CHANNEL" />
          <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale="-10" xChannelSelector="R" yChannelSelector="B" result="BLUE_DISPLACED" />
          <feColorMatrix in="BLUE_DISPLACED" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="BLUE_CHANNEL" />
          <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED" />
          <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED" />
          <feGaussianBlur in="RGB_COMBINED" stdDeviation="0.35" result="ABERRATED_BLURRED" />
          <feComposite in="ABERRATED_BLURRED" in2="EDGE_MASK" operator="in" result="EDGE_ABERRATION" />
          <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feComposite in="CENTER_ORIGINAL" in2="INVERTED_MASK" operator="in" result="CENTER_CLEAN" />
          <feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over" />
        </filter>
      </defs>
    `;

    document.body.appendChild(svg);
  },

  setupNav(nav) {
    // 1. Maintain sliding indicator element inside nav at all times
    const ensureIndicator = () => {
      let ind = nav.querySelector('.nav-sliding-indicator');
      if (!ind) {
        ind = document.createElement('div');
        ind.className = 'nav-sliding-indicator';
        ind.setAttribute('aria-hidden', 'true');
        nav.insertBefore(ind, nav.firstChild);
      }
      return ind;
    };

    let indicator = ensureIndicator();

    const getLinks = () => Array.from(nav.querySelectorAll('li > a'));

    // Determine current active item
    const getActiveLink = () => {
      const active = nav.querySelector('li > a.active');
      if (active) return active;

      // Fallback matching pathname
      const path = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
      const links = getLinks();
      for (const a of links) {
        const href = (a.getAttribute('href') || '').toLowerCase().replace(/\/$/, '') || '/';
        if (href === path || (href !== '/' && path.startsWith(href))) {
          return a;
        }
      }
      return links[0] || null;
    };

    let currentTarget = getActiveLink();

    // Original fluid sliding animation between tabs
    const moveTo = (target, animate = true) => {
      const ind = ensureIndicator();
      if (!target) {
        ind.style.opacity = '0';
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      // Relative coordinates
      const left = targetRect.left - navRect.left;
      const width = targetRect.width;

      if (!animate) {
        ind.style.transition = 'none';
      } else {
        ind.style.transition = 'left 0.32s cubic-bezier(0.16, 1, 0.3, 1), width 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease';
      }

      ind.style.left = `${left}px`;
      ind.style.width = `${width}px`;
      ind.style.opacity = '1';

      if (!animate) {
        void ind.offsetWidth;
        ind.style.transition = '';
      }
    };

    // Public method to switch active tab and slide indicator
    const setActiveTab = (targetOrHref, animate = true) => {
      const links = getLinks();
      let target = null;
      if (typeof targetOrHref === 'string') {
        const cleanHref = targetOrHref.toLowerCase().replace(/\/$/, '') || '/';
        target = links.find(l => {
          const h = (l.getAttribute('href') || '').toLowerCase().replace(/\/$/, '') || '/';
          return h === cleanHref || (h !== '/' && cleanHref.startsWith(h));
        });
      } else if (targetOrHref && targetOrHref.tagName === 'A') {
        target = targetOrHref;
      }

      if (target) {
        links.forEach(l => l.classList.remove('active'));
        target.classList.add('active');
        currentTarget = target;
        moveTo(target, animate);
      }
    };

    // Attach hover & click listeners to each link
    const attachItemListeners = () => {
      const links = getLinks();
      links.forEach(a => {
        if (a._glassEnter) a.removeEventListener('mouseenter', a._glassEnter);
        a._glassEnter = () => {
          moveTo(a, true);
        };
        a.addEventListener('mouseenter', a._glassEnter);

        if (a._glassClick) a.removeEventListener('click', a._glassClick);
        a._glassClick = (e) => {
          // Tactile tap feedback
          const ind = ensureIndicator();
          ind.style.transform = 'scale(0.96)';
          setTimeout(() => {
            ind.style.transform = 'scale(1)';
          }, 120);

          const href = a.getAttribute('href') || '';
          
          // Slide active tab indicator immediately to clicked tab
          setActiveTab(a, true);

          // If navigating across pages, record origin so the next page continues the slide seamlessly!
          if (!href.startsWith('#') && href !== window.location.pathname) {
            try {
              const navRect = nav.getBoundingClientRect();
              const aRect = a.getBoundingClientRect();
              sessionStorage.setItem('civic_nav_sliding_origin', JSON.stringify({
                fromHref: window.location.pathname,
                left: aRect.left - navRect.left,
                width: aRect.width,
                time: Date.now()
              }));
            } catch (err) {}
          }
        };
        a.addEventListener('click', a._glassClick);
      });
    };

    attachItemListeners();

    // Mouse movement: calculates dynamic specular highlight angle
    const handleMouseMove = (e) => {
      const rect = nav.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const offsetX = ((e.clientX - centerX) / rect.width) * 100;

      // Specular reflection gradient angle
      const angle = 135 + offsetX * 1.25;
      nav.style.setProperty('--liquid-angle', `${angle.toFixed(1)}deg`);
    };

    nav.addEventListener('mousemove', handleMouseMove);

    // On mouse leave, smoothly return indicator to the currently active tab
    nav.addEventListener('mouseleave', () => {
      nav.style.setProperty('--liquid-angle', '135deg');
      currentTarget = getActiveLink();
      moveTo(currentTarget, true);
    });

    // Initial position after render: check if user navigated from another tab
    const settle = () => {
      currentTarget = getActiveLink();
      if (!currentTarget) return;

      let fromOrigin = null;
      try {
        const stored = sessionStorage.getItem('civic_nav_sliding_origin');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Date.now() - parsed.time < 3500) {
            fromOrigin = parsed;
          }
          sessionStorage.removeItem('civic_nav_sliding_origin');
        }
      } catch (err) {}

      const ind = ensureIndicator();

      if (fromOrigin && typeof fromOrigin.left === 'number') {
        // Place indicator at the previous tab coordinates first (no animation)
        ind.style.transition = 'none';
        ind.style.left = `${fromOrigin.left}px`;
        ind.style.width = `${fromOrigin.width}px`;
        ind.style.opacity = '1';
        void ind.offsetWidth; // Force layout reflow

        // In next frame, smoothly slide to the new active tab!
        requestAnimationFrame(() => {
          moveTo(currentTarget, true);
        });
        return;
      }

      moveTo(currentTarget, false);
    };

    requestAnimationFrame(settle);
    setTimeout(settle, 60);
    setTimeout(settle, 250);

    // Store references
    nav._glassNavMoveTo = moveTo;
    nav._glassNavGetActive = getActiveLink;
    nav._glassNavAttach = attachItemListeners;
    nav._glassNavSetActive = setActiveTab;
    if (!this.instances.includes(nav)) {
      this.instances.push(nav);
    }
  },

  setActiveTab(targetOrHref, animate = true) {
    this.instances.forEach(nav => {
      if (nav._glassNavSetActive) nav._glassNavSetActive(targetOrHref, animate);
    });
  },

  refresh(specificNav) {
    const list = specificNav ? [specificNav] : this.instances;
    list.forEach(nav => {
      if (nav._glassNavAttach) nav._glassNavAttach();
      if (nav._glassNavMoveTo && nav._glassNavGetActive) {
        nav._glassNavMoveTo(nav._glassNavGetActive(), false);
      }
    });
  },

  updateScroll() {
    const isScrolled = window.scrollY > 8;
    const navbars = document.querySelectorAll('.navbar');
    navbars.forEach(nb => nb.classList.toggle('scrolled', isScrolled));
  }
};

window.GlassNav = GlassNav;

document.addEventListener('DOMContentLoaded', () => {
  GlassNav.init();
  GlassNav.updateScroll();
});

window.addEventListener('scroll', () => {
  GlassNav.updateScroll();
}, { passive: true });

window.addEventListener('resize', () => {
  GlassNav.refresh();
});
