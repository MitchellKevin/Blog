/* === ROTATING STATUS === */
const statusPhrases = [
    'in the zone',
    'caffeinated',
    'overthinking it',
    'probably debugging',
    'vibing',
    'behind on sleep',
    'on deadline',
    'inspired',
    'drinking coffee',
    'making it work',
    'loading...',
    'questioning everything',
];

const statusEl = document.getElementById('status-text');
if (statusEl) {
    let statusIndex = Math.floor(Math.random() * statusPhrases.length);

    function cycleStatus() {
        statusEl.classList.remove('visible');
        setTimeout(() => {
            statusIndex = (statusIndex + 1) % statusPhrases.length;
            statusEl.textContent = statusPhrases[statusIndex];
            statusEl.classList.add('visible');
        }, 500);
    }

    statusEl.textContent = statusPhrases[statusIndex];
    setTimeout(() => statusEl.classList.add('visible'), 100);
    setInterval(cycleStatus, 30500);
}

/* === MOUSE TRAIL === */
const TRAIL_COUNT = 18;
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let prevMouseX = mouseX, prevMouseY = mouseY;
let trailSpeed = 0;

function lerp(a, b, t) { return a + (b - a) * t; }

const trailDots = Array.from({ length: TRAIL_COUNT }, () => {
    const el = document.createElement('div');
    el.className = 'trail-dot';
    document.body.appendChild(el);
    return { el, x: mouseX, y: mouseY };
});

document.addEventListener('mousemove', e => {
    const dx = e.clientX - prevMouseX;
    const dy = e.clientY - prevMouseY;
    trailSpeed = Math.min(Math.sqrt(dx * dx + dy * dy), 24) / 24;
    prevMouseX = mouseX;
    prevMouseY = mouseY;
    mouseX = e.clientX;
    mouseY = e.clientY;
});

(function animateTrail() {
    trailSpeed *= 0.88;

    trailDots[0].x = lerp(trailDots[0].x, mouseX, 0.22);
    trailDots[0].y = lerp(trailDots[0].y, mouseY, 0.22);
    for (let i = 1; i < TRAIL_COUNT; i++) {
        trailDots[i].x = lerp(trailDots[i].x, trailDots[i - 1].x, 0.22);
        trailDots[i].y = lerp(trailDots[i].y, trailDots[i - 1].y, 0.22);
    }

    const headSize = lerp(8, 15, trailSpeed);

    trailDots.forEach(({ el, x, y }, i) => {
        const t = i / (TRAIL_COUNT - 1);
        const size = headSize * (1 - t * 0.9);
        const half = size / 2;

        // --fg (#f0ece3) → --accent (#c8a96e)
        const r = Math.round(lerp(240, 200, t * 0.7));
        const g = Math.round(lerp(236, 169, t * 0.7));
        const b = Math.round(lerp(227, 110, t * 0.7));

        const glowRadius = 8 + trailSpeed * 10;
        const glowAlpha  = (0.2 + trailSpeed * 0.25) * (1 - t);
        const glow = i < 3
            ? `0 0 ${glowRadius * (1 - i * 0.3)}px ${Math.max(glowRadius * 0.4 * (1 - i * 0.3), 0)}px rgba(240,236,227,${glowAlpha.toFixed(2)})`
            : 'none';

        el.style.transform = `translate(${x - half}px,${y - half}px)`;
        el.style.width     = `${size}px`;
        el.style.height    = `${size}px`;
        el.style.opacity   = `${(1 - t) * 0.9}`;
        el.style.background = `rgb(${r},${g},${b})`;
        el.style.boxShadow  = glow;
    });

    requestAnimationFrame(animateTrail);
})();

/* === LOADER === */
const loader = document.getElementById('loader');
const loaderCount = document.getElementById('loader-count');
const loaderBarFill = document.getElementById('loader-bar-fill');

document.body.style.overflow = 'hidden';

const LOAD_DURATION = 1800;
const loadStart = performance.now();

(function animateLoader(now) {
    const elapsed = now - loadStart;
    const raw = Math.min(elapsed / LOAD_DURATION, 1);
    const eased = 1 - Math.pow(1 - raw, 2.5);
    const count = Math.round(eased * 100);

    loaderCount.textContent = count.toString().padStart(2, '0');
    loaderBarFill.style.width = count + '%';

    if (raw < 1) {
        requestAnimationFrame(animateLoader);
    } else {
        loaderCount.textContent = '100';
        loaderBarFill.style.width = '100%';
        setTimeout(() => {
            loader.classList.add('out');
            document.body.style.overflow = '';
            document.body.classList.add('is-loaded');
            setTimeout(() => loader.style.display = 'none', 900);
        }, 250);
    }
})(loadStart);

/* === HORIZONTAL SCROLL === */
const scrollSection = document.getElementById('scroll-section');
const carousel = document.getElementById('carousel');

function updateHorizontalScroll() {
    const rect = scrollSection.getBoundingClientRect();
    const sectionScrollable = scrollSection.offsetHeight - window.innerHeight;
    const scrolled = -rect.top;
    const progress = Math.min(Math.max(scrolled / sectionScrollable, 0), 1);
    const maxTranslate = carousel.scrollWidth - window.innerWidth;
    carousel.style.transform = `translateX(${-progress * maxTranslate}px)`;
}

window.addEventListener('scroll', updateHorizontalScroll, { passive: true });

/* === SCROLL REVEAL === */
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* === STAGGERED GRID REVEAL === */
const gridItems = document.querySelectorAll('.grid-item');

const gridObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const i = [...gridItems].indexOf(entry.target);
            entry.target.style.transitionDelay = `${i * 0.07}s`;
            entry.target.classList.add('visible');
            gridObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

gridItems.forEach(el => gridObserver.observe(el));

/* === CARD TILT === */
document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transition = 'none';
        card.style.transform = `perspective(600px) rotateY(${x * 9}deg) rotateX(${-y * 9}deg)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.transform = 'perspective(600px) rotateY(0deg) rotateX(0deg)';
    });
});
