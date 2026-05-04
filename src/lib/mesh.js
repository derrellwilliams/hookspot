// mesh.js — shared animation utilities for mesh gradient and cursor trail

// Colors sourced from design system tokens (tokens.js)
export const DEFAULT_BLOBS = [
    { x: 58, y: 33, color: '#2563eb', dx: 0.8,  dy: 0.6  }, // accent
    { x: 27, y: 45, color: '#64748b', dx: 0.7,  dy: -0.8 }, // muted
    { x: 74, y: 66, color: '#1A1953', dx: -0.6, dy: 0.5  }, // darkBg
    { x: 35, y: 67, color: '#a1a1aa', dx: 0.9,  dy: -0.7 }, // darkMuted
    { x: 18, y: 40, color: '#f4f4f5', dx: 0.5,  dy: 0.4  }, // darkText
    { x: 31, y: 18, color: '#2c2c2e', dx: 0.6,  dy: 0.8  }, // darkSurface
];

/** Returns a CSS background-image string for the given blobs at time t. */
function meshFrame(blobs, t) {
    return blobs.map((b, i) => {
        const x = b.x + Math.sin(t * b.dx + i * 1.3) * 14;
        const y = b.y + Math.cos(t * b.dy + i * 1.1) * 14;
        return `radial-gradient(at ${x.toFixed(1)}% ${y.toFixed(1)}%, ${b.color} 0px, transparent 50%)`;
    }).join(',');
}

// Single shared RAF loop for all mesh animations
const _meshCallbacks = [];
(function _meshLoop() {
    for (let i = 0; i < _meshCallbacks.length; i++) _meshCallbacks[i]();
    requestAnimationFrame(_meshLoop);
})();

/**
 * Starts an animated mesh gradient on an element.
 * @param {HTMLElement} el
 * @param {Array}  blobs        — blob config: [{ x, y, color, dx, dy }, ...]
 * @param {Object} opts
 *   speed       — base animation speed (default 0.015)
 *   hoverSpeed  — speed while hoverTarget is hovered (optional)
 *   hoverTarget — element to watch for hover events (default: el)
 *   bgColor     — backgroundColor to set once before animating (optional)
 */
export function animateMesh(el, blobs, { speed = 0.015, hoverSpeed = null, hoverTarget = null, bgColor = null } = {}) {
    let t = Math.random() * 100;
    let current = speed;
    let hovered = false;

    if (bgColor) el.style.backgroundColor = bgColor;

    if (hoverSpeed !== null) {
        const target = hoverTarget || el;
        target.addEventListener('mouseenter', () => hovered = true);
        target.addEventListener('mouseleave', () => hovered = false);
    }

    const cb = () => {
        if (hoverSpeed !== null) current += ((hovered ? hoverSpeed : speed) - current) * 0.04;
        t += current;
        el.style.backgroundImage = meshFrame(blobs, t);
    };
    _meshCallbacks.push(cb);
    return () => {
        const idx = _meshCallbacks.indexOf(cb);
        if (idx !== -1) _meshCallbacks.splice(idx, 1);
    };
}

/**
 * Initializes the two-layer cursor trail on .cursor-canvas.
 * @param {number} r, g, b — trail color (0–255 each)
 * @param {Function} colorFn — optional (x, y) => [r, g, b] for dynamic color
 */
export function initCursorTrail(r, g, b, colorFn) {
    const canvas = document.querySelector('.cursor-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    const trail = [];
    const DURATION = 700;
    document.addEventListener('mousemove', e => trail.push({ x: e.clientX, y: e.clientY, t: Date.now() }));

    (function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const now = Date.now();
        while (trail.length && now - trail[0].t > DURATION) trail.shift();

        if (trail.length >= 2) {
            const tail = trail[0], head = trail[trail.length - 1];
            const [cr, cg, cb] = colorFn ? colorFn(head.x, head.y) : [r, g, b];
            for (const [lineWidth, alpha] of [[22, 0.07], [8, 0.22]]) {
                const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
                grad.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);
                grad.addColorStop(1, `rgba(${cr},${cg},${cb},${alpha})`);
                ctx.beginPath();
                ctx.moveTo(trail[0].x, trail[0].y);
                for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
                ctx.strokeStyle = grad;
                ctx.lineWidth = lineWidth;
                ctx.lineCap = ctx.lineJoin = 'round';
                ctx.stroke();
            }
        }
        requestAnimationFrame(draw);
    })();
}
