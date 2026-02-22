// ==========================================
// SEOJIAF — Kinetic Portfolio
// GSAP + Lenis + vibes
// ==========================================

(function () {
    'use strict';

    gsap.registerPlugin(ScrollTrigger);

    // ===================== SMOOTH SCROLL =====================
    const lenis = new Lenis({
        duration: 1.2,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        touchMultiplier: 2,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Sync lenis with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // ===================== CUSTOM CURSOR =====================
    const cursor = document.getElementById('cursor');
    const cursorDot = cursor.querySelector('.cursor-dot');
    const cursorRing = cursor.querySelector('.cursor-ring');
    const cursorLabel = cursor.querySelector('.cursor-label');

    let mouseX = 0, mouseY = 0;
    let dotX = 0, dotY = 0;
    let ringX = 0, ringY = 0;

    document.addEventListener('mousemove', function (e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function animateCursor() {
        // Dot follows tightly
        dotX += (mouseX - dotX) * 0.25;
        dotY += (mouseY - dotY) * 0.25;
        cursorDot.style.left = dotX + 'px';
        cursorDot.style.top = dotY + 'px';

        // Ring follows with lag
        ringX += (mouseX - ringX) * 0.12;
        ringY += (mouseY - ringY) * 0.12;
        cursorRing.style.left = ringX + 'px';
        cursorRing.style.top = ringY + 'px';
        cursorLabel.style.left = ringX + 'px';
        cursorLabel.style.top = ringY + 20 + 'px';

        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Cursor states on hover
    document.querySelectorAll('[data-cursor]').forEach(function (el) {
        const type = el.getAttribute('data-cursor');
        el.addEventListener('mouseenter', function () {
            cursor.className = 'cursor ' + type;
            if (type === 'view') cursorLabel.textContent = 'View';
            else if (type === 'email') cursorLabel.textContent = 'Email';
            else if (type === 'scroll') cursorLabel.textContent = '';
            else cursorLabel.textContent = '';
        });
        el.addEventListener('mouseleave', function () {
            cursor.className = 'cursor';
            cursorLabel.textContent = '';
        });
    });

    // ===================== LOADER =====================
    const loader = document.getElementById('loader');
    const loaderLine = document.querySelector('.loader-line');
    const loaderProgress = document.querySelector('.loader-progress');

    const loaderTl = gsap.timeline({
        onComplete: function () {
            loader.classList.add('done');
            gsap.to(loader, { opacity: 0, duration: 0.5, delay: 0.2, onComplete: function () {
                loader.style.display = 'none';
            }});
            revealHero();
            revealNav();
        }
    });

    loaderTl
        .to(loaderLine, { y: '0%', duration: 0.6, ease: 'power3.out' })
        .to(loaderProgress, { width: '100%', duration: 1.2, ease: 'power2.inOut' }, 0.3);

    // ===================== HERO REVEAL =====================
    function revealHero() {
        const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

        heroTl
            .from('.hero-eyebrow span', { y: 20, opacity: 0, duration: 0.8 }, 0)
            .from('.eyebrow-line', { scaleX: 0, duration: 0.8 }, 0)
            .from('.title-line', {
                y: '110%',
                duration: 1,
                stagger: 0.08,
            }, 0.15)
            .from('.hero-sub', { y: 30, opacity: 0, duration: 0.8 }, 0.6)
            .from('.hero-scroll-cta', { y: 20, opacity: 0, duration: 0.6 }, 0.8)
            .from('.hero-footer-row span', { y: 15, opacity: 0, duration: 0.5, stagger: 0.1 }, 0.7)
            .to('.hero-orb', { opacity: 0.15, duration: 2, stagger: 0.3 }, 0.3);
    }

    function revealNav() {
        gsap.to('.nav', { y: '0%', duration: 0.6, ease: 'power3.out', delay: 0.3 });
    }

    // ===================== SCROLL ANIMATIONS =====================

    // Hero parallax orbs
    gsap.to('.orb-1', {
        y: -150,
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 }
    });
    gsap.to('.orb-2', {
        y: -100,
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 }
    });

    // Section reveals
    document.querySelectorAll('.section-header, .about-left, .about-block').forEach(function (el) {
        gsap.from(el, {
            y: 60,
            opacity: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: el,
                start: 'top 85%',
                toggleActions: 'play none none none',
            }
        });
    });

    // Project cards
    document.querySelectorAll('.project').forEach(function (el, i) {
        gsap.from(el, {
            y: 80,
            opacity: 0,
            duration: 0.9,
            delay: i * 0.1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: el,
                start: 'top 85%',
                toggleActions: 'play none none none',
            }
        });
    });

    // Capability cards
    document.querySelectorAll('.cap-card').forEach(function (el, i) {
        gsap.from(el, {
            y: 50,
            opacity: 0,
            duration: 0.8,
            delay: i * 0.12,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: el,
                start: 'top 85%',
                toggleActions: 'play none none none',
            }
        });
    });

    // Contact heading
    gsap.from('.contact-line', {
        y: '110%',
        duration: 1,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.contact-heading',
            start: 'top 80%',
            toggleActions: 'play none none none',
        }
    });

    gsap.from('.contact-email', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.contact-email',
            start: 'top 85%',
            toggleActions: 'play none none none',
        }
    });

    // ===================== MAGNETIC HOVER (project cards) =====================
    document.querySelectorAll('.project').forEach(function (card) {
        card.addEventListener('mousemove', function (e) {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            gsap.to(card, {
                x: x * 0.02,
                y: y * 0.02,
                duration: 0.4,
                ease: 'power2.out',
            });
        });

        card.addEventListener('mouseleave', function () {
            gsap.to(card, {
                x: 0,
                y: 0,
                duration: 0.6,
                ease: 'elastic.out(1, 0.5)',
            });
        });
    });

    // ===================== NAV SCROLL BEHAVIOR =====================
    let lastScroll = 0;
    lenis.on('scroll', function (e) {
        const current = e.scroll;
        if (current > 100) {
            if (current > lastScroll) {
                gsap.to('.nav', { y: '-100%', duration: 0.3 });
            } else {
                gsap.to('.nav', { y: '0%', duration: 0.3 });
            }
        }
        lastScroll = current;
    });

    // ===================== CONSOLE =====================
    console.log(
        '%cSEOJIAF',
        'font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #6366f1, #ec4899, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent;'
    );
    console.log('%cKinetic Portfolio', 'color: #484848; font-size: 12px; font-weight: 500;');
    console.log('');
    console.log('GSAP · Lenis · Zero frameworks');
    console.log('→ github.com/SEOJIAF');

})();