(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const motion = !reduce && hasGsap;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const VIMEO_ID = '1246214587';
  const EMBED_URL = `https://player.vimeo.com/video/${VIMEO_ID}?autoplay=1&title=0&byline=0&portrait=0&color=d4ff3a`;

  if (!motion) root.classList.add('no-motion');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis smooth scroll ---------- */
  let lenis = null;
  if (motion && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const scrollToTarget = (target) => {
    if (lenis) return lenis.scrollTo(target, { duration: 1.4 });
    const behavior = reduce ? 'auto' : 'smooth';
    if (typeof target === 'number') window.scrollTo({ top: target, behavior });
    else target.scrollIntoView({ behavior });
  };

  /* ---------- Split text helper (chars / words) ---------- */
  function split(el, mode) {
    const out = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'word';
            if (mode === 'chars') {
              [...part].forEach((ch) => {
                const c = document.createElement('span');
                c.className = 'char';
                c.textContent = ch;
                w.appendChild(c);
                out.push(c);
              });
            } else {
              w.textContent = part;
              out.push(w);
            }
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    };
    walk(el);
    return out;
  }

  /* ---------- Nav: hide on scroll down, mobile menu ---------- */
  const nav = $('#nav');
  const burger = $('.nav-burger');
  const menu = $('#mobile-menu');
  let lastY = window.scrollY;
  let scrollDir = 1;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y !== lastY) scrollDir = y > lastY ? 1 : -1;
    nav.classList.toggle('is-hidden', scrollDir === 1 && y > 120 && !root.classList.contains('menu-open'));
    lastY = y;
  }, { passive: true });

  function openMenu() {
    root.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    menu.setAttribute('aria-hidden', 'false');
    nav.classList.remove('is-hidden');
    lenis?.stop();
    if (motion) {
      gsap.fromTo('.mobile-menu nav > *', { yPercent: 60, opacity: 0 },
        { yPercent: 0, opacity: 1, stagger: 0.06, duration: 0.6, ease: 'power3.out', delay: 0.1 });
    }
  }
  function closeMenu() {
    if (!root.classList.contains('menu-open')) return;
    root.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    menu.setAttribute('aria-hidden', 'true');
    lenis?.start();
  }
  burger.addEventListener('click', () => (root.classList.contains('menu-open') ? closeMenu() : openMenu()));

  $$('a[href^="#"]:not(.skip-link)').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      closeMenu();
      scrollToTarget(target);
    });
  });

  $('.to-top').addEventListener('click', () => scrollToTarget(0));

  /* ---------- Rotating roles ---------- */
  const roles = ['Video Editor', 'Content Creator', 'Social Media Manager', 'Graphic Designer', 'Cinematic Shooter'];
  const roleEl = $('.role');
  if (!motion) {
    roleEl.textContent = roles.join(' · ');
    roleEl.parentElement.style.height = 'auto';
  } else {
    let i = 0;
    setInterval(() => {
      i = (i + 1) % roles.length;
      gsap.timeline()
        .to(roleEl, { yPercent: -100, opacity: 0, duration: 0.35, ease: 'power2.in' })
        .add(() => { roleEl.textContent = roles[i]; })
        .fromTo(roleEl, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
    }, 2000);
  }

  /* ---------- Lite Vimeo embed + modal ---------- */
  const makeIframe = () => {
    const f = document.createElement('iframe');
    f.src = EMBED_URL;
    f.allow = 'autoplay; fullscreen; picture-in-picture';
    f.allowFullscreen = true;
    f.title = 'Samarth Sawant — Showreel';
    return f;
  };

  const player = $('.player');
  const poster = $('.player-poster');
  const ring = $('.cursor-ring');

  fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${VIMEO_ID}&width=1280`)
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d) => {
      if (!d.thumbnail_url) return;
      const img = new Image();
      img.onload = () => { poster.style.backgroundImage = `url("${d.thumbnail_url}")`; };
      img.src = d.thumbnail_url;
    })
    .catch(() => { /* keep gradient poster */ });

  poster.addEventListener('click', () => {
    player.appendChild(makeIframe());
    poster.remove();
    player.removeAttribute('data-cursor');
    ring.classList.remove('is-play');
  });

  const modal = $('.modal');
  const modalBox = $('.modal-box');
  const modalFrame = $('.modal-frame');
  let lastFocus = null;

  function openReel() {
    if (!modal.hidden) return;
    lastFocus = document.activeElement;
    closeMenu();
    // stop inline player if it is running, so audio doesn't overlap
    const inline = $('iframe', player);
    if (inline) inline.src = 'about:blank';
    modalFrame.appendChild(makeIframe());
    modal.hidden = false;
    lenis?.stop();
    root.style.overflow = 'hidden';
    if (motion) {
      gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
      gsap.fromTo(modalBox, { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out' });
    }
    $('.modal-close').focus();
  }

  function closeReel() {
    if (modal.hidden) return;
    modalFrame.innerHTML = ''; // removes iframe -> video stops
    const done = () => {
      modal.hidden = true;
      root.style.overflow = '';
      lenis?.start();
      lastFocus?.focus?.();
    };
    if (motion) {
      gsap.to(modalBox, { scale: 0.95, duration: 0.3, ease: 'power2.in' });
      gsap.to(modal, { opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: done });
    } else done();
  }

  $$('[data-open-reel]').forEach((b) => b.addEventListener('click', openReel));
  $$('[data-close-reel]').forEach((b) => b.addEventListener('click', closeReel));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeReel(); closeMenu(); }
  });

  /* ---------- Email copy + toast ---------- */
  const toast = $('.toast');
  let toastTimer;
  $('.email-copy').addEventListener('click', async (e) => {
    const email = e.currentTarget.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = email;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
  });

  /* ---------- Floating CTA ---------- */
  const floatBtn = $('.float-cta');
  let pastHero = false;
  let contactIn = false;
  const updateFloat = () => floatBtn.classList.toggle('is-visible', pastHero && !contactIn);
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; updateFloat(); }).observe($('.hero'));
  new IntersectionObserver(([e]) => { contactIn = e.isIntersecting; updateFloat(); }).observe($('#contact'));

  /* ---------- Hero photo REC timecode ---------- */
  const recTc = $('.rec-tc');
  if (recTc && !reduce) {
    const t0 = performance.now();
    const pad = (n) => String(n).padStart(2, '0');
    setInterval(() => {
      const f = Math.floor((performance.now() - t0) / (1000 / 24));
      const s = Math.floor(f / 24);
      recTc.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f % 24)}`;
    }, 1000 / 24);
  }

  /* ---------- Reduced motion / no GSAP: show everything & stop ---------- */
  if (!motion) {
    $('.preloader')?.remove();
    $$('.step').forEach((s) => s.classList.add('is-active'));
    $('.timeline-fill').style.transform = 'none';
    $('.playhead').style.transform = 'none';
    return;
  }

  /* ================= Motion-only below ================= */

  /* ---------- Custom cursor ---------- */
  if (finePointer) {
    root.classList.add('has-cursor');
    const dot = $('.cursor-dot');
    gsap.set([dot, ring], { x: -100, y: -100 });
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });

    window.addEventListener('pointermove', (e) => {
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      const t = e.target.closest ? e.target : null;
      const play = !!(t && t.closest('[data-cursor="play"], video'));
      ring.classList.toggle('is-play', play);
      ring.classList.toggle('is-hover', !play && !!(t && t.closest('a, button, .chip, .card')));
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => gsap.to([dot, ring], { opacity: 0, duration: 0.2 }));
    document.documentElement.addEventListener('mouseenter', () => gsap.to([dot, ring], { opacity: 1, duration: 0.2 }));

    /* Magnetic buttons */
    $$('.magnetic').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });

    /* 3D tilt cards */
    $$('.card').forEach((c) => {
      gsap.set(c, { transformPerspective: 900 });
      const rX = gsap.quickTo(c, 'rotationX', { duration: 0.5, ease: 'power3' });
      const rY = gsap.quickTo(c, 'rotationY', { duration: 0.5, ease: 'power3' });
      c.addEventListener('pointerenter', () => gsap.to(c, { y: -12, duration: 0.4, ease: 'power3.out' }));
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        rY(((e.clientX - r.left) / r.width - 0.5) * 12);
        rX(-((e.clientY - r.top) / r.height - 0.5) * 12);
      });
      c.addEventListener('pointerleave', () => {
        rX(0); rY(0);
        gsap.to(c, { y: 0, duration: 0.5, ease: 'power3.out' });
      });
    });
  }

  /* ---------- Marquee (direction follows scroll) ---------- */
  const mTrack = $('.marquee-track');
  const setMX = gsap.quickSetter(mTrack, 'xPercent');
  const wrapMX = gsap.utils.wrap(-50, 0);
  let mx = 0;
  let mDir = 1;
  gsap.ticker.add((t, dt) => {
    mDir += (scrollDir - mDir) * 0.08;
    mx = wrapMX(mx - mDir * dt * 0.004);
    setMX(mx);
  });

  /* ---------- Generic [data-reveal] ---------- */
  gsap.set('[data-reveal]', { opacity: 0, y: 40 });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1, overwrite: true }),
  });

  /* ---------- About ---------- */
  gsap.fromTo('.portrait', { clipPath: 'inset(100% 0% 0% 0%)' }, {
    clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut',
    scrollTrigger: { trigger: '.portrait', start: 'top 80%' },
  });
  gsap.fromTo('.portrait-inner', { yPercent: -6 }, {
    yPercent: 6, ease: 'none',
    scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  const aboutWords = split($('.about-copy'), 'words');
  gsap.fromTo(aboutWords, { opacity: 0.18 }, {
    opacity: 1, stagger: 0.05, ease: 'none',
    scrollTrigger: { trigger: '.about-copy', start: 'top 80%', end: 'bottom 45%', scrub: true },
  });

  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count;
    const suffix = el.dataset.suffix || '';
    const o = { v: 0 };
    el.textContent = '0' + suffix;
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(o, { v: end, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v) + suffix; } }),
    });
  });

  /* ---------- Showreel scale ---------- */
  gsap.fromTo('.player', { scale: 0.8 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.player-wrap', start: 'top 95%', end: 'center 55%', scrub: true },
  });

  /* ---------- Responsive: services pin + process playhead ---------- */
  const steps = $$('.step');
  const setActive = (p) => steps.forEach((s, i) => s.classList.toggle('is-active', p >= i / steps.length + 0.02));
  const processST = { trigger: '.timeline', start: 'top 70%', end: 'bottom 50%', scrub: 0.5, onUpdate: (self) => setActive(self.progress) };

  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    const track = $('.services-track');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.services-pin', pin: true, start: 'top top', end: () => '+=' + dist(), scrub: 1, invalidateOnRefresh: true },
    });

    const tl = gsap.timeline({ scrollTrigger: processST });
    tl.fromTo('.playhead', { xPercent: -100 }, { xPercent: 0, ease: 'none' }, 0)
      .fromTo('.timeline-fill', { scaleX: 0 }, { scaleX: 1, ease: 'none' }, 0);
  });
  mm.add('(max-width: 899px)', () => {
    gsap.fromTo('.timeline-fill', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: processST });
  });

  /* ---------- Skills chips ---------- */
  gsap.set('.chip', { opacity: 0, scale: 0.6, y: 20 });
  ScrollTrigger.batch('.chip', {
    start: 'top 92%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.8)', stagger: 0.05 }),
  });

  /* ---------- Contact headline mask ---------- */
  gsap.fromTo('.contact-title .line-inner', { yPercent: 110 }, {
    yPercent: 0, stagger: 0.15, ease: 'none',
    scrollTrigger: { trigger: '.contact-title', start: 'top 90%', end: 'bottom 65%', scrub: 1 },
  });

  /* ---------- Preloader + hero intro ---------- */
  const heroChars = $$('.hero-title .split-chars').flatMap((el) => split(el, 'chars'));
  gsap.set(heroChars, { yPercent: 115 });
  gsap.set('.hero-fade', { opacity: 0, y: 24 });
  const heroFrame = $('.hero-portrait-frame');
  const heroImg = heroFrame && $('img', heroFrame);
  if (heroFrame) {
    gsap.set(heroFrame, { clipPath: 'inset(100% 0% 0% 0%)' });
    gsap.set(heroImg, { scale: 1.35 });
    gsap.set('.hero-rec', { opacity: 0, y: -10 });
  }

  const pre = $('.preloader');
  const num = $('.count-num');
  const counter = { v: 0 };
  lenis?.stop();
  window.scrollTo(0, 0);

  const introTl = gsap.timeline();
  introTl
    .to(counter, {
      v: 100, duration: 0.75, ease: 'power2.inOut',
      onUpdate: () => { num.textContent = String(Math.round(counter.v)).padStart(2, '0'); },
    })
    .to(pre, { yPercent: -100, duration: 0.45, ease: 'expo.inOut' })
    .add(() => { pre.remove(); lenis?.start(); })
    .to('.letterbox-top', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=0.15')
    .to('.letterbox-bottom', { yPercent: 100, duration: 1.1, ease: 'expo.inOut' }, '<')
    .to(heroChars, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.018 }, '<0.1')
    .to('.hero-fade', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 }, '-=0.6');

  if (heroFrame) {
    // Photo wipes up from the bottom while the image settles from a zoom
    introTl
      .to(heroFrame, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut' }, 1.0)
      .to(heroImg, { scale: 1, duration: 1.8, ease: 'expo.out' }, 1.2)
      .to('.hero-rec', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 2.1);
    // subtle parallax as the hero scrolls away
    gsap.fromTo(heroImg, { yPercent: 0 }, {
      yPercent: -6, ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  /* Refresh measurements once fonts/images are ready */
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
