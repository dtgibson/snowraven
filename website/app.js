/* SnowRaven website — minimal progressive enhancement. No external requests. */
(function () {
  'use strict';
  var root = document.documentElement;

  /* ---- Theme toggle (persists explicit choice; otherwise follows OS) ---- */
  var toggle = document.getElementById('theme-toggle');
  function store(v) { try { localStorage.setItem('sr-site-theme', v); } catch (e) {} }
  function hasExplicit() { try { var s = localStorage.getItem('sr-site-theme'); return s === 'light' || s === 'dark'; } catch (e) { return false; } }
  function syncToggle() {
    if (!toggle) return;
    var dark = root.getAttribute('data-theme') === 'dark';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
  syncToggle();
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store(next);
      syncToggle();
    });
  }
  // Follow the OS until the user makes an explicit choice.
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var onScheme = function (e) { if (!hasExplicit()) { root.setAttribute('data-theme', e.matches ? 'dark' : 'light'); syncToggle(); } };
  if (mq.addEventListener) mq.addEventListener('change', onScheme);
  else if (mq.addListener) mq.addListener(onScheme);

  /* ---- Mobile menu ---- */
  var menuBtn = document.getElementById('menu-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  if (menuBtn && mobileNav) {
    var setOpen = function (open) {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (open) { mobileNav.hidden = false; mobileNav.setAttribute('data-open', ''); }
      else { mobileNav.removeAttribute('data-open'); mobileNav.hidden = true; }
    };
    menuBtn.addEventListener('click', function () {
      setOpen(menuBtn.getAttribute('aria-expanded') !== 'true');
    });
    mobileNav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setOpen(false); menuBtn.focus(); }
    });
    // Reset the menu when the viewport leaves the mobile breakpoint.
    var mqMobile = window.matchMedia('(max-width: 720px)');
    var onMqMobile = function (e) { if (!e.matches) setOpen(false); };
    if (mqMobile.addEventListener) mqMobile.addEventListener('change', onMqMobile);
    else if (mqMobile.addListener) mqMobile.addListener(onMqMobile);
  }

  /* ---- Header shadow on scroll ---- */
  var header = document.querySelector('.site-header');
  var onScroll = function () { if (header) header.classList.toggle('scrolled', window.scrollY > 8); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---- Copy the install command ---- */
  document.querySelectorAll('.copy-cmd').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy') || '';
      var done = function () {
        btn.classList.add('copied');
        setTimeout(function () { btn.classList.remove('copied'); }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  });

  /* ---- Scroll reveal (no-op under reduced motion) ---- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var targets = document.querySelectorAll('.feature-row, .privacy-points li, .install-card, .section-head');
  if (!reduce && 'IntersectionObserver' in window) {
    targets.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(function (el) { io.observe(el); });
  }
})();
