// ============================================================
// NEON RUNNER  (c) 2bit Developer - original work for 2bitArcade
// A pixel robot dashing through a neon cyber city.
// Jump over high obstacles, duck under low ones. Endless; speed ramps.
// Vanilla canvas, no dependencies. Score = distance.
// ============================================================
(function () {
  'use strict';

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var GROUND_Y = H - 70;

  // --- palette (arcade neon) ---
  var C = {
    bg1: '#0a0518', bg2: '#1a0b38',
    neon: '#ff9900', neonHot: '#ff5500',
    cyan: '#00ffff', magenta: '#ff2d95',
    robot: '#39e6ff', robotDark: '#1a7fa8', robotGlow: 'rgba(57,230,255,0.5)',
    ground: '#2a1a4a', groundLine: '#ff2d95',
    text: '#ffffff', danger: '#ff3355'
  };

  // --- state ---
  var STATE = { MENU: 0, PLAY: 1, OVER: 2 };
  var state = STATE.MENU;
  var reviveUsedThisRun = false, reviving = false;
  var score = 0, best = 0, speed = 0, baseSpeed = 6, spawnTimer = 0, frame = 0;
  var obstacles = [], particles = [], buildings = [], stars = [];

  // --- robot ---
  var robot = {
    x: 90, y: GROUND_Y, w: 34, h: 46, vy: 0, ducking: false,
    onGround: true, legPhase: 0
  };
  var GRAVITY = 0.9, JUMP_V = -16, DUCK_H = 26, NORMAL_H = 46;

  // ---------- input ----------
  function jump() {
    if (state === STATE.MENU) { start(); return; }
    if (state === STATE.OVER) { if (Date.now() - overAt > 600) start(); return; }
    if (robot.onGround) { robot.vy = JUMP_V; robot.onGround = false; spawnJumpDust(); }
  }
  function setDuck(on) {
    if (state !== STATE.PLAY) return;
    robot.ducking = on;
  }
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); jump(); }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); setDuck(true); }
  });
  window.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') setDuck(false);
  });
  // touch: tap top half = jump, hold bottom half = duck
  canvas.addEventListener('pointerdown', function (e) {
    var r = canvas.getBoundingClientRect();
    var ly = (e.clientY - r.top) / r.height;
    if (ly > 0.6) setDuck(true); else jump();
  });
  canvas.addEventListener('pointerup', function () { setDuck(false); });

  // ---------- world init ----------
  function initBackdrop() {
    buildings = [];
    var x = 0;
    while (x < W + 200) {
      var bw = 40 + Math.random() * 70, bh = 80 + Math.random() * 220;
      buildings.push({ x: x, w: bw, h: bh, hue: Math.random() < 0.5 ? C.cyan : C.magenta, lit: Math.random() });
      x += bw + 10 + Math.random() * 30;
    }
    stars = [];
    for (var i = 0; i < 60; i++) stars.push({ x: Math.random() * W, y: Math.random() * (GROUND_Y - 40), r: Math.random() * 1.5 + 0.3 });
  }

  // ---------- lifecycle ----------
  var overAt = 0;
  function start() {
    state = STATE.PLAY;
    score = 0; speed = baseSpeed; spawnTimer = 40; frame = 0;
    obstacles = []; particles = [];
    robot.y = GROUND_Y; robot.vy = 0; robot.onGround = true; robot.ducking = false;
    reviveUsedThisRun = false; reviving = false;
    if (window.NeonRunnerBridge) window.NeonRunnerBridge.onStart();
  }
  function performRevive() {
    // clear the immediate field so the player doesn't instantly re-crash
    obstacles = obstacles.filter(function (o) { return o.x > robot.x + 260; });
    robot.y = GROUND_Y; robot.vy = 0; robot.onGround = true; robot.ducking = false;
    state = STATE.PLAY;
  }
  function tryRevive() {
    if (reviveUsedThisRun || reviving || state !== STATE.OVER) return;
    if (!window.NeonRunnerBurn) return; // burn helper not present
    reviving = true;
    window.NeonRunnerBurn(function (ok) {
      reviving = false;
      if (ok) { reviveUsedThisRun = true; performRevive(); }
    });
  }
  // R key or tapping the revive prompt triggers a burn-revive
  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyR') { e.preventDefault(); tryRevive(); }
  });
  canvas.addEventListener('pointerdown', function (e) {
    if (state !== STATE.OVER) return;
    var r = canvas.getBoundingClientRect();
    var ly = (e.clientY - r.top) / r.height;
    // bottom third of the over screen = revive button zone
    if (ly > 0.62 && ly < 0.82) tryRevive();
  });

  function gameOver() {
    state = STATE.OVER; overAt = Date.now();
    if (Math.floor(score) > best) best = Math.floor(score);
    spawnExplosion(robot.x + robot.w / 2, robot.y - robot.h / 2);
    if (window.NeonRunnerBridge) window.NeonRunnerBridge.onGameOver(Math.floor(score));
  }

  // ---------- obstacles ----------
  function spawnObstacle() {
    // high obstacle => must duck; low/ground obstacle => must jump
    var type = Math.random() < 0.5 ? 'jump' : 'duck';
    if (type === 'jump') {
      var h = 30 + Math.random() * 34;
      obstacles.push({ kind: 'jump', x: W + 20, y: GROUND_Y - h, w: 20 + Math.random() * 22, h: h });
    } else {
      // floating hazard at head height - duck to pass
      obstacles.push({ kind: 'duck', x: W + 20, y: GROUND_Y - NORMAL_H - 6, w: 46 + Math.random() * 20, h: 20 });
    }
  }

  // ---------- particles ----------
  function spawnJumpDust() {
    for (var i = 0; i < 6; i++) particles.push({ x: robot.x + 6, y: GROUND_Y, vx: -Math.random() * 3 - 1, vy: -Math.random() * 2, life: 20, col: C.cyan });
  }
  function spawnExplosion(x, y) {
    for (var i = 0; i < 30; i++) {
      var a = Math.random() * Math.PI * 2, s = Math.random() * 6 + 1;
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 40, col: Math.random() < 0.5 ? C.neon : C.danger });
    }
  }

  // ---------- update ----------
  function update() {
    frame++;
    // parallax backdrop always animates
    for (var b = 0; b < buildings.length; b++) {
      buildings[b].x -= (state === STATE.PLAY ? speed * 0.3 : 0.6);
      if (buildings[b].x + buildings[b].w < 0) {
        var maxX = 0; for (var k = 0; k < buildings.length; k++) maxX = Math.max(maxX, buildings[k].x + buildings[k].w);
        buildings[b].x = maxX + 10 + Math.random() * 30;
        buildings[b].h = 80 + Math.random() * 220; buildings[b].hue = Math.random() < 0.5 ? C.cyan : C.magenta;
      }
    }

    if (state !== STATE.PLAY) { updateParticles(); return; }

    score += speed * 0.02;
    speed = baseSpeed + score * 0.012; // ramps with distance

    // robot physics
    robot.h = robot.ducking && robot.onGround ? DUCK_H : NORMAL_H;
    robot.vy += GRAVITY; robot.y += robot.vy;
    if (robot.y >= GROUND_Y) { robot.y = GROUND_Y; robot.vy = 0; robot.onGround = true; }
    else robot.onGround = false;
    if (robot.onGround) robot.legPhase += speed * 0.05;

    // obstacles
    spawnTimer--;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = Math.max(35, 90 - score * 0.05) + Math.random() * 30;
    }
    for (var i = obstacles.length - 1; i >= 0; i--) {
      var o = obstacles[i];
      o.x -= speed;
      if (o.x + o.w < 0) { obstacles.splice(i, 1); continue; }
      // collision (robot hitbox uses current height)
      var rx = robot.x + 4, ry = robot.y - robot.h, rw = robot.w - 8, rh = robot.h;
      if (rx < o.x + o.w && rx + rw > o.x && ry < o.y + o.h && ry + rh > o.y) { gameOver(); return; }
    }
    updateParticles();
  }
  function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ---------- draw ----------
  function draw() {
    // sky
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // stars
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (var s = 0; s < stars.length; s++) { ctx.globalAlpha = 0.3 + Math.sin(frame * 0.05 + s) * 0.3 + 0.4; ctx.fillRect(stars[s].x, stars[s].y, stars[s].r, stars[s].r); }
    ctx.globalAlpha = 1;
    // buildings (neon skyline)
    for (var b = 0; b < buildings.length; b++) {
      var bd = buildings[b];
      ctx.fillStyle = '#140a2e'; ctx.fillRect(bd.x, GROUND_Y - bd.h, bd.w, bd.h);
      ctx.strokeStyle = bd.hue; ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
      ctx.strokeRect(bd.x + 1, GROUND_Y - bd.h + 1, bd.w - 2, bd.h - 2);
      // windows
      ctx.globalAlpha = 0.8; ctx.fillStyle = bd.hue;
      for (var wy = GROUND_Y - bd.h + 8; wy < GROUND_Y - 8; wy += 14)
        for (var wx = bd.x + 6; wx < bd.x + bd.w - 6; wx += 12)
          if ((wx + wy + Math.floor(bd.lit * 10)) % 3 === 0) ctx.fillRect(wx, wy, 5, 6);
      ctx.globalAlpha = 1;
    }
    // ground
    ctx.fillStyle = C.ground; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.strokeStyle = C.groundLine; ctx.lineWidth = 3; ctx.shadowColor = C.groundLine; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke(); ctx.shadowBlur = 0;
    // moving ground dashes
    ctx.strokeStyle = 'rgba(255,45,149,0.4)'; ctx.lineWidth = 2;
    var off = (frame * (state === STATE.PLAY ? speed : 1)) % 40;
    for (var d = -off; d < W; d += 40) { ctx.beginPath(); ctx.moveTo(d, GROUND_Y + 22); ctx.lineTo(d + 20, GROUND_Y + 22); ctx.stroke(); }

    // obstacles
    for (var i = 0; i < obstacles.length; i++) drawObstacle(obstacles[i]);
    // robot
    if (state !== STATE.OVER) drawRobot();
    // particles
    for (var p = 0; p < particles.length; p++) {
      ctx.globalAlpha = Math.max(0, particles[p].life / 40);
      ctx.fillStyle = particles[p].col;
      ctx.fillRect(particles[p].x, particles[p].y, 3, 3);
    }
    ctx.globalAlpha = 1;

    drawHUD();
    if (state === STATE.MENU) drawMenu();
    if (state === STATE.OVER) drawOver();
  }

  function drawRobot() {
    var x = robot.x, y = robot.y, w = robot.w, h = robot.h;
    ctx.save();
    ctx.shadowColor = C.robotGlow; ctx.shadowBlur = 14;
    // body
    ctx.fillStyle = C.robot; ctx.fillRect(x, y - h, w, h - 14);
    ctx.fillStyle = C.robotDark; ctx.fillRect(x + 4, y - h + 6, w - 8, 8); // chest panel
    // head
    ctx.fillStyle = C.robot; ctx.fillRect(x + 6, y - h - 12, w - 12, 14);
    ctx.fillStyle = C.cyan; ctx.fillRect(x + 10, y - h - 8, w - 20, 4); // visor
    ctx.shadowBlur = 0;
    // legs (animate when running on ground)
    ctx.fillStyle = C.robotDark;
    var lp = Math.sin(robot.legPhase) * 6;
    if (robot.onGround && !robot.ducking) {
      ctx.fillRect(x + 4, y - 14, 8, 14 + lp);
      ctx.fillRect(x + w - 12, y - 14, 8, 14 - lp);
    } else {
      ctx.fillRect(x + 4, y - 14, 8, 12);
      ctx.fillRect(x + w - 12, y - 14, 8, 12);
    }
    ctx.restore();
  }

  function drawObstacle(o) {
    ctx.save();
    if (o.kind === 'jump') {
      ctx.fillStyle = C.neon; ctx.shadowColor = C.neonHot; ctx.shadowBlur = 12;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = C.neonHot; ctx.fillRect(o.x + 3, o.y + 3, o.w - 6, 4);
    } else {
      // floating drone hazard
      ctx.fillStyle = C.danger; ctx.shadowColor = C.danger; ctx.shadowBlur = 14;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = '#fff'; ctx.fillRect(o.x + o.w / 2 - 3, o.y + o.h / 2 - 2, 6, 4);
      // hover glow beneath
      ctx.globalAlpha = 0.4; ctx.fillStyle = C.danger;
      ctx.fillRect(o.x + 4, o.y + o.h, o.w - 8, 3);
    }
    ctx.restore();
  }

  function drawHUD() {
    ctx.fillStyle = C.text; ctx.font = "20px 'VT323', monospace"; ctx.textAlign = 'right';
    ctx.fillText('SCORE ' + String(Math.floor(score)).padStart(5, '0'), W - 16, 30);
    ctx.fillStyle = C.cyan;
    ctx.fillText('BEST ' + String(best).padStart(5, '0'), W - 16, 54);
    ctx.textAlign = 'left';
  }

  function drawMenu() {
    dim();
    ctx.textAlign = 'center';
    ctx.fillStyle = C.neon; ctx.shadowColor = C.neonHot; ctx.shadowBlur = 20;
    ctx.font = "56px 'VT323', monospace"; ctx.fillText('NEON RUNNER', W / 2, H / 2 - 30);
    ctx.shadowBlur = 0; ctx.fillStyle = C.text; ctx.font = "24px 'VT323', monospace";
    ctx.fillText('SPACE / TAP to jump   -   DOWN / hold-bottom to duck', W / 2, H / 2 + 20);
    ctx.fillStyle = C.cyan; ctx.font = "28px 'VT323', monospace";
    if (Math.floor(frame / 30) % 2 === 0) ctx.fillText('PRESS SPACE TO RUN', W / 2, H / 2 + 60);
    ctx.textAlign = 'left';
  }
  function drawOver() {
    dim();
    ctx.textAlign = 'center';
    ctx.fillStyle = C.danger; ctx.shadowColor = C.danger; ctx.shadowBlur = 18;
    ctx.font = "48px 'VT323', monospace"; ctx.fillText('SYSTEM CRASH', W / 2, H / 2 - 20);
    ctx.shadowBlur = 0; ctx.fillStyle = C.text; ctx.font = "26px 'VT323', monospace";
    ctx.fillText('SCORE ' + Math.floor(score), W / 2, H / 2 + 20);
    ctx.fillStyle = C.cyan; ctx.font = "22px 'VT323', monospace";
    if (Date.now() - overAt > 600 && Math.floor(frame / 30) % 2 === 0)
      ctx.fillText('SPACE TO RUN AGAIN', W / 2, H / 2 + 54);
    // burn-revive prompt (only when available and unused this run)
    if (window.NeonRunnerBurn && !reviveUsedThisRun) {
      ctx.fillStyle = reviving ? '#888' : C.neon;
      ctx.shadowColor = C.neonHot; ctx.shadowBlur = reviving ? 0 : 10;
      ctx.font = "24px 'VT323', monospace";
      ctx.fillText(reviving ? 'BURNING...' : 'REVIVE  \uD83D\uDD25 1000 $2BA  [R / TAP]', W / 2, H / 2 + 92);
      ctx.shadowBlur = 0;
    }
    ctx.textAlign = 'left';
  }
  function dim() { ctx.fillStyle = 'rgba(5,2,15,0.7)'; ctx.fillRect(0, 0, W, H); }

  // expose current score for the bridge
  window.NeonRunner = { getScore: function () { return Math.floor(score); }, getState: function () { return state; }, STATE: STATE };

  // ---------- loop ----------
  initBackdrop();
  function loop() { update(); draw(); requestAnimationFrame(loop); }
  loop();
})();
