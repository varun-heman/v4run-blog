// The homepage dot sphere — a lighter cousin of the one on v4.run.
// Plain 2D canvas: slowly turns, leans toward the mouse, stops when off-screen,
// and draws a single still frame for people who prefer reduced motion.
(function () {
  'use strict';
  var canvas = document.querySelector('[data-sphere]');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var N = innerWidth < 760 ? 420 : 900;

  // Points spread evenly over a sphere (Fibonacci lattice).
  var pts = [];
  for (var i = 0; i < N; i++) {
    var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963229728653;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }

  var size = 0, dpr = 1, color = '#b8f0d2';
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    size = canvas.clientWidth;
    canvas.width = canvas.height = Math.round(size * dpr);
    color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || color;
  }
  resize();
  addEventListener('resize', resize);
  new MutationObserver(resize).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  var mx = 0, my = 0, tx = 0, ty = 0, angle = 0.6;
  addEventListener('pointermove', function (e) {
    tx = (e.clientX / innerWidth - 0.5) * 0.6;
    ty = (e.clientY / innerHeight - 0.5) * 0.4;
  }, { passive: true });

  function draw() {
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    var ay = angle + mx, ax = 0.35 + my;
    var cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    var R = size * dpr * 0.42, c = size * dpr / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    for (var i = 0; i < N; i++) {
      var p = pts[i];
      var x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy;
      var y = p[1] * cx - z * sx; z = p[1] * sx + z * cx;
      var depth = (z + 1) / 2;
      ctx.globalAlpha = 0.14 + depth * 0.86;
      var s = (0.9 + depth * 1.9) * dpr;
      ctx.fillRect(c + x * R - s / 2, c + y * R - s / 2, s, s);
    }
  }

  if (still) { draw(); return; }

  var visible = true, raf = 0;
  function loop() { angle += 0.0018; draw(); raf = requestAnimationFrame(loop); }
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) loop();
  }).observe(canvas);
})();
