// Mouse trail
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

        const r = Math.round(lerp(240, 200, t * 0.7));
        const g = Math.round(lerp(236, 169, t * 0.7));
        const b = Math.round(lerp(227, 110, t * 0.7));

        const glowRadius = 8 + trailSpeed * 10;
        const glowAlpha  = (0.2 + trailSpeed * 0.25) * (1 - t);
        const glow = i < 3
            ? `0 0 ${glowRadius * (1 - i * 0.3)}px ${Math.max(glowRadius * 0.4 * (1 - i * 0.3), 0)}px rgba(240,236,227,${glowAlpha.toFixed(2)})`
            : 'none';

        el.style.transform  = `translate(${x - half}px,${y - half}px)`;
        el.style.width      = `${size}px`;
        el.style.height     = `${size}px`;
        el.style.opacity    = `${(1 - t) * 0.9}`;
        el.style.background = `rgb(${r},${g},${b})`;
        el.style.boxShadow  = glow;
    });

    requestAnimationFrame(animateTrail);
})();

// Hero image parallax + load trigger
window.addEventListener('load', () => {
    document.querySelector('.article-hero')?.classList.add('is-loaded');
    document.body.classList.add('is-loaded');
});

// Scroll reveal
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
