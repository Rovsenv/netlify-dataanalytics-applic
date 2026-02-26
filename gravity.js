/* ============================================================
   GRAVITY PARTICLE SYSTEM — Data Analytics Hub
   • Particles drift slowly and attract each other
   • Glowing coloured connection lines between nearby particles
   • NO mouse / touch interaction — pure ambient animation
   • Canvas is fixed fullscreen, always behind page content
   ============================================================ */

(function () {
    'use strict';

    /* ── Canvas ─────────────────────────────────────────────── */
    const canvas = document.getElementById('gravityCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', () => { resize(); rebuild(); });

    /* ── Configuration ──────────────────────────────────────── */
    const CFG = {
        COUNT: window.innerWidth < 600 ? 40 : 70, // number of particles
        R_MIN: 1.2,          // minimum dot radius
        R_MAX: 3.0,          // maximum dot radius
        SPEED: 0.28,         // max initial speed  (slow drift)
        GRAVITY: 0.006,        // mutual gravitational pull strength
        DAMPING: 0.992,        // velocity decay per frame (keeps motion smooth)
        MAX_V: 0.9,          // absolute speed cap  (stays slow)
        CONNECT_DIST: 160,          // max px for drawing connection line
        TRAIL: 0.10,         // translucency of bg wipe  ← longer trail = more blur
        PULSE_SPEED: 0.025,        // how fast a dot's glow pulses
        COLOR_SPEED: 0.0025,       // how fast a dot blends to next colour
    };

    /* ── Colour palette  (indigo / violet / cyan) ───────────── */
    const PALETTE = [
        [99, 102, 241],   // indigo
        [139, 92, 246],   // violet
        [6, 182, 212],   // cyan
        [168, 85, 247],   // purple
        [59, 130, 246],   // blue
        [34, 211, 238],   // sky-cyan
    ];

    function rndColor() {
        return PALETTE[Math.floor(Math.random() * PALETTE.length)];
    }

    function lerpC([r1, g1, b1], [r2, g2, b2], t) {
        return [
            r1 + (r2 - r1) * t | 0,
            g1 + (g2 - g1) * t | 0,
            b1 + (b2 - b1) * t | 0,
        ];
    }

    /* ── Particle ────────────────────────────────────────────── */
    class Particle {
        constructor() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * CFG.SPEED;
            this.vx = Math.cos(a) * s;
            this.vy = Math.sin(a) * s;
            this.r = CFG.R_MIN + Math.random() * (CFG.R_MAX - CFG.R_MIN);
            this.mass = this.r * this.r;
            this.pulse = Math.random() * Math.PI * 2;
            this.colA = rndColor();
            this.colB = rndColor();
            this.colT = 0;
            this.cur = this.colA.slice();
        }

        update(all) {
            /* Pulsing glow radius */
            this.pulse += CFG.PULSE_SPEED;
            const pr = this.r + Math.sin(this.pulse) * 0.7;

            /* Colour blend */
            this.colT += CFG.COLOR_SPEED;
            if (this.colT >= 1) {
                this.colA = this.colB;
                this.colB = rndColor();
                this.colT = 0;
            }
            this.cur = lerpC(this.colA, this.colB, this.colT);

            /* Mutual gravity — sample a subset for performance */
            const step = Math.max(1, all.length >> 3);  // ~1/8 of particles
            for (let i = 0; i < all.length; i += step) {
                const o = all[i];
                if (o === this) continue;
                const dx = o.x - this.x;
                const dy = o.y - this.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < 1) continue;
                const d = Math.sqrt(d2);
                const force = (CFG.GRAVITY * o.mass) / (d2 + 80);
                this.vx += (dx / d) * force;
                this.vy += (dy / d) * force;
            }

            /* Damping */
            this.vx *= CFG.DAMPING;
            this.vy *= CFG.DAMPING;

            /* Speed cap */
            const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (spd > CFG.MAX_V) {
                const inv = CFG.MAX_V / spd;
                this.vx *= inv;
                this.vy *= inv;
            }

            /* Move */
            this.x += this.vx;
            this.y += this.vy;

            /* Wrap-around edges */
            const m = 50;
            if (this.x < -m) this.x = W + m;
            else if (this.x > W + m) this.x = -m;
            if (this.y < -m) this.y = H + m;
            else if (this.y > H + m) this.y = -m;

            return pr;
        }

        draw(pr) {
            const [r, g, b] = this.cur;
            const glow = pr * 5;

            /* Soft outer glow */
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glow);
            grad.addColorStop(0, `rgba(${r},${g},${b},0.45)`);
            grad.addColorStop(0.5, `rgba(${r},${g},${b},0.10)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.beginPath();
            ctx.arc(this.x, this.y, glow, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            /* Solid core */
            ctx.beginPath();
            ctx.arc(this.x, this.y, pr, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},0.88)`;
            ctx.fill();
        }
    }

    /* ── Connection lines ────────────────────────────────────── */
    function drawLines(pts) {
        const D2 = CFG.CONNECT_DIST * CFG.CONNECT_DIST;
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i];
            for (let j = i + 1; j < pts.length; j++) {
                const b = pts[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d2 = dx * dx + dy * dy;
                if (d2 > D2) continue;

                const isLight = document.documentElement.getAttribute('data-theme') === 'light';
                const alpha = (1 - d2 / D2) * (isLight ? 0.15 : 0.35);
                const [ra, ga, ba] = a.cur;
                const [rb, gb, bb] = b.cur;

                const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
                g.addColorStop(0, `rgba(${ra},${ga},${ba},${alpha})`);
                g.addColorStop(1, `rgba(${rb},${gb},${bb},${alpha})`);

                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = g;
                ctx.lineWidth = (1 - d2 / D2) * 1.2;
                ctx.stroke();
            }
        }
    }

    /* ── Particles list ──────────────────────────────────────── */
    let pts = [];

    function rebuild() {
        pts = Array.from({ length: CFG.COUNT }, () => new Particle());
    }
    rebuild();

    /* ── Background colour helper ────────────────────────────── */
    function bgColor() {
        const light = document.documentElement.getAttribute('data-theme') === 'light';
        return light
            ? `rgba(248,250,255,${CFG.TRAIL})`
            : `rgba(5,11,24,${CFG.TRAIL})`;
    }

    /* ── Render loop ─────────────────────────────────────────── */
    function render() {
        /* Semi-transparent wipe creates motion trails */
        ctx.fillStyle = bgColor();
        ctx.fillRect(0, 0, W, H);

        drawLines(pts);

        for (const p of pts) {
            const pr = p.update(pts);
            p.draw(pr);
        }

        requestAnimationFrame(render);
    }

    render();

    /* ── Clear trail on theme switch ─────────────────────────── */
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        ctx.clearRect(0, 0, W, H);
    });

})();
