// ============================================================
// SUNSET DRIFT  (c) 2bit Developer - original work for 2bitArcade
// Early-NFS-style pseudo-3D canyon racer. Curving roads, rolling
// hills, roadside scenery, opponents, and a sunset backdrop.
// Pure vanilla canvas (classic pseudo-3D projection). Score = distance.
// No third-party assets; all art is drawn procedurally.
// ============================================================
(function () {
  'use strict';

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;

  function fitCanvas() {
    canvas.width = W = window.innerWidth;
    canvas.height = H = window.innerHeight;
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  // ---------- tunables ----------
  var SEG_LEN = 200;          // length of a road segment (world units)
  var RUMBLE_LEN = 3;         // segments per rumble stripe
  var ROAD_W = 2200;          // half-width of the road
  var LANES = 3;
  var DRAW_DIST = 300;        // segments drawn ahead
  var CAM_H = 1200;           // camera height above road
  var CAM_DEPTH = 0.84;       // camera depth (~1/tan(fov/2))
  var FIELD = CAM_DEPTH;
  var MAX_SPEED = SEG_LEN * 60;
  var ACCEL = MAX_SPEED / 5;
  var BRAKE = -MAX_SPEED;
  var DECEL = -MAX_SPEED / 5;
  var OFFROAD_DECEL = -MAX_SPEED / 2;
  var OFFROAD_LIMIT = MAX_SPEED / 4;
  var CENTRIFUGAL = 0.3;
  var PLAYER_Z = CAM_H * CAM_DEPTH;

  // ---------- palette (sunset canyon) ----------
  var COL = {
    skyTop: '#1a1145', skyUpper: '#4a2168', skyMid: '#c8437a', skyWarm: '#ff7a52', skyLow: '#ffb347',
    sun: '#fff2a8', sunCore: '#ffde59', sunOuter: '#ff9d4d',
    mountain1: '#3d2a5e', mountain2: '#5a3a7a', mountain3: '#7a4a6a',
    haze: '#e88a6a',
    grassDark: '#2f6b34', grassLight: '#3d8a42', grassEdge: '#4a9c50',
    roadDark: '#3e3e46', roadLight: '#4a4a54', roadEdge: '#2a2a30',
    rumbleLight: '#f5f5f5', rumbleDark: '#c0392b',
    lane: '#f0e8d8', fog: '#e8a878'
  };

  // ---------- state ----------
  var STATE = { MENU: 0, PLAY: 1, OVER: 2, STAGEDONE: 3, WIN: 4 };
  var state = STATE.MENU;
  var segments = [];
  var trackLength = 0;
  var position = 0;
  var playerX = 0;
  var speed = 0;
  var distance = 0;
  var best = 0;
  var frame = 0, overAt = 0, stageDoneAt = 0;
  var opponents = [];

  // ---------- STAGES (finite races of varying length) ----------
  // Lengths tuned so a full field finishing takes ~35-70s; short enough that
  // positions stay competitive, long enough that skill matters.
  var STAGE_DEFS = [
    { name: 'STAGE 1', laps: 1, len: 42000 },
    { name: 'STAGE 2', laps: 1, len: 58000 },
    { name: 'STAGE 3', laps: 1, len: 50000 },
    { name: 'STAGE 4', laps: 1, len: 68000 },
    { name: 'STAGE 5', laps: 1, len: 60000 }
  ];
  var stageNum = 0;              // 0-indexed
  var finishZ = 0;               // world-z of the finish line for this stage
  var playerFinished = false;
  var playerFinishPos = 0;
  var startGridPositions = [];   // grid order for the NEXT stage (from last results)
  var totalScore = 0;            // accumulated across stages (stages*positions)

  // ---------- road building ----------
  function lastY() { return segments.length === 0 ? 0 : segments[segments.length - 1].p2.world.y; }
  function addSegment(curve, y) {
    var n = segments.length;
    segments.push({
      index: n,
      p1: { world: { y: lastY(), z: n * SEG_LEN }, camera: {}, screen: {} },
      p2: { world: { y: y, z: (n + 1) * SEG_LEN }, camera: {}, screen: {} },
      curve: curve,
      color: Math.floor(n / RUMBLE_LEN) % 2 ? 'dark' : 'light',
      sprites: []
    });
  }
  function easeInOut(a, b, p) { return a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5); }
  function easeIn(a, b, p) { return a + (b - a) * p * p; }
  function addRoad(enter, hold, leave, curve, y) {
    var startY = lastY(), endY = startY + y * SEG_LEN;
    var total = enter + hold + leave, done = 0;
    for (var i = 0; i < enter; i++) { addSegment(easeIn(0, curve, i / enter), easeInOut(startY, endY, (++done) / total)); }
    for (var i = 0; i < hold; i++) { addSegment(curve, easeInOut(startY, endY, (++done) / total)); }
    for (var i = 0; i < leave; i++) { addSegment(easeInOut(curve, 0, i / leave), easeInOut(startY, endY, (++done) / total)); }
  }

  function addScenery() {
    var n = 20;
    while (n < segments.length) {
      n += 4 + Math.floor(Math.random() * 8);
      if (n >= segments.length) break;
      var side = Math.random() < 0.5 ? -1 : 1;
      var kind = Math.random();
      var type = kind < 0.55 ? 'tree' : kind < 0.8 ? 'rock' : kind < 0.92 ? 'cactus' : 'billboard';
      var offset = side * (1.3 + Math.random() * 1.8);
      segments[n].sprites.push({ type: type, offset: offset });
    }
  }

  function buildTrack(targetLen) {
    segments = [];
    // Build a finite, procedurally-unique road that spans ~targetLen world units,
    // then a run-out past the finish so cars can cross and decelerate. NOT looped.
    addRoad(30, 30, 30, 0, 0);                          // flat start-grid straight

    var built = 0;
    while (built < targetLen) {
      var enter = 20 + Math.floor(Math.random() * 30);
      var hold  = 30 + Math.floor(Math.random() * 60);
      var leave = 20 + Math.floor(Math.random() * 30);
      var curve = (Math.random() * 10 - 5);
      if (Math.random() < 0.25) curve = 0;
      var hill  = (Math.random() * 80 - 40);
      addRoad(enter, hold, leave, curve, hill);
      built = segments.length * SEG_LEN;
    }

    // finish line sits at the current end of the built course
    finishZ = segments.length * SEG_LEN;

    // ease height back to 0 and add a straight run-out AFTER the finish
    var endY = lastY();
    addRoad(20, 20, 20, 0, -endY / SEG_LEN);
    addRoad(40, 60, 40, 0, 0);                          // run-out past the line
    if (segments.length) { segments[segments.length - 1].p2.world.y = 0; segments[segments.length - 1].curve = 0; }

    trackLength = segments.length * SEG_LEN;
    addScenery();
  }

  // ---------- opponents ----------
  function spawnOpponents() {
    opponents = [];
    var colors = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#e9c46a', '#9d4edd', '#ff6a00', '#00d4ff'];
    var lanes = [-0.6, 0, 0.6];
    // 7 CPU rivals + the player = 8-car field.
    // Grid order: if we have results from the previous stage, the grid is set by
    // finishing order (leaders start ahead). Otherwise random.
    var order = startGridPositions.length ? startGridPositions.slice() : null;

    for (var i = 0; i < 7; i++) {
      // grid slot: lower slot = further ahead on the grid
      var slot = i;
      var laneX = lanes[i % 3];
      // Each CPU has a skill rating that makes the field competitive but beatable.
      // Ratings cluster near the player's top speed so races stay close.
      var skill = 0.90 + Math.random() * 0.14;          // 0.90..1.04 of MAX
      // If seeded from last results, better finishers get slightly higher skill.
      if (order) {
        var seedRank = order[i] != null ? order[i] : i;
        skill = 1.02 - (seedRank * 0.015) + (Math.random() * 0.04 - 0.02);
      }
      opponents.push({
        z: PLAYER_Z + 600 + slot * 520,                 // staggered just ahead on the grid
        x: laneX,
        targetX: laneX,
        baseSpeed: MAX_SPEED * skill,
        speed: MAX_SPEED * skill,
        skill: skill,
        color: colors[i % colors.length],
        wrecked: 0,
        finished: false,
        finishPos: 0,
        aggro: 0.3 + Math.random() * 0.5                // how likely to shove the player
      });
    }
  }

  // ---------- projection ----------
  function project(p, camX, camY, camZ) {
    p.camera.x = (p.world.x || 0) - camX;
    p.camera.y = (p.world.y || 0) - camY;
    p.camera.z = (p.world.z || 0) - camZ;
    var scale = FIELD / (p.camera.z || 1);
    p.screen.scale = scale;
    p.screen.x = Math.round((W / 2) + (scale * p.camera.x * W / 2));
    p.screen.y = Math.round((H / 2) - (scale * p.camera.y * H / 2));
    p.screen.w = Math.round(scale * ROAD_W * W / 2);
  }

  // ---------- input ----------
  var keys = {};
  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    if (state === STATE.MENU && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp')) start();
    if (state === STATE.OVER && Date.now() - overAt > 700 && (e.code === 'Space' || e.code === 'Enter')) start();
    if (state === STATE.WIN && Date.now() - overAt > 800 && (e.code === 'Space' || e.code === 'Enter')) start();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  var touchSteer = 0, touchGas = false;
  canvas.addEventListener('pointerdown', function (e) {
    var r = canvas.getBoundingClientRect();
    var lx = (e.clientX - r.left) / r.width;
    if (state !== STATE.PLAY) { if (state === STATE.MENU || ((state === STATE.OVER || state === STATE.WIN) && Date.now() - overAt > 700)) start(); return; }
    touchGas = true;
    touchSteer = lx < 0.4 ? -1 : lx > 0.6 ? 1 : 0;
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!touchGas) return;
    var r = canvas.getBoundingClientRect();
    var lx = (e.clientX - r.left) / r.width;
    touchSteer = lx < 0.4 ? -1 : lx > 0.6 ? 1 : 0;
  });
  canvas.addEventListener('pointerup', function () { touchGas = false; touchSteer = 0; });

  // ---------- lifecycle ----------
  function start() {
    stageNum = 0;
    totalScore = 0;
    startGridPositions = [];
    if (window.SunsetDriftBridge) window.SunsetDriftBridge.onStart();
    if (window.SunsetDriftSound) { window.SunsetDriftSound.resume(); window.SunsetDriftSound.startEngine(); window.SunsetDriftSound.startMusic(); }
    loadStageRace();
  }

  function loadStageRace() {
    var def = STAGE_DEFS[stageNum];
    buildTrack(def.len);
    spawnOpponents();
    state = STATE.PLAY;
    position = 0; playerX = 0; speed = 0; distance = 0; frame = 0;
    playerFinished = false; playerFinishPos = 0;
  }

  function playerCrossFinish() {
    if (playerFinished) return;
    playerFinished = true;
    var ahead = 0;
    for (var i = 0; i < opponents.length; i++) if (opponents[i].finished) ahead++;
    playerFinishPos = ahead + 1;
    var field = opponents.length + 1;
    var posPts = (field - (playerFinishPos - 1));
    totalScore += posPts * 100 + (stageNum + 1) * 200;
    var ranked = opponents.slice().sort(function (a, b) {
      var fa = a.finished ? a.finishPos : 999;
      var fb = b.finished ? b.finishPos : 999;
      return fa - fb;
    });
    startGridPositions = [];
    for (var r = 0; r < ranked.length; r++) startGridPositions.push(r);
    state = STATE.STAGEDONE; stageDoneAt = Date.now();
    if (window.SunsetDriftSound) window.SunsetDriftSound.gameOver();
  }

  function advanceStage() {
    stageNum++;
    if (stageNum >= STAGE_DEFS.length) {
      state = STATE.WIN; overAt = Date.now();
      if (Math.floor(totalScore) > best) best = Math.floor(totalScore);
      if (window.SunsetDriftBridge) window.SunsetDriftBridge.onGameOver(Math.floor(totalScore));
      return;
    }
    loadStageRace();
    if (window.SunsetDriftSound) window.SunsetDriftSound.startMusic();
  }

  function gameOver() {
    state = STATE.OVER; overAt = Date.now();
    if (Math.floor(totalScore) > best) best = Math.floor(totalScore);
    if (window.SunsetDriftBridge) window.SunsetDriftBridge.onGameOver(Math.floor(totalScore));
    if (window.SunsetDriftSound) window.SunsetDriftSound.gameOver();
  }

  function findSegment(z) { return segments[Math.floor(z / SEG_LEN) % segments.length]; }

  // ---------- update ----------
  function update(dt) {
    frame++;
    if (state === STATE.STAGEDONE) {
      // keep the world rolling briefly, then advance
      if (Date.now() - stageDoneAt > 2600) advanceStage();
      return;
    }
    if (state !== STATE.PLAY) return;

    var playerSeg = findSegment(position + PLAYER_Z);
    var speedPct = speed / MAX_SPEED;

    // ----- player driving (only until the player has finished) -----
    if (!playerFinished) {
      var dx = dt * 2.2 * speedPct;
      var steer = (keys['ArrowLeft'] || keys['KeyA'] ? -1 : 0) + (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0) + touchSteer;
      if (steer < 0) playerX -= dx;
      if (steer > 0) playerX += dx;
      playerX -= (dx * speedPct * playerSeg.curve * CENTRIFUGAL);

      var gas = keys['ArrowUp'] || keys['KeyW'] || touchGas;
      var brk = keys['ArrowDown'] || keys['KeyS'];
      if (gas) speed += ACCEL * dt;
      else if (brk) speed += BRAKE * dt;
      else speed += DECEL * dt;

      if ((playerX < -1 || playerX > 1) && speed > OFFROAD_LIMIT) speed += OFFROAD_DECEL * dt;
    } else {
      // player crossed the line: coast to a stop on the run-out
      speed += DECEL * dt;
    }
    if (speed < 0) speed = 0;
    if (speed > MAX_SPEED) speed = MAX_SPEED;
    playerX = Math.max(-2, Math.min(2, playerX));

    position += speed * dt;              // FINITE: no wrapping
    distance += speed * dt * 0.01;

    // player crosses the finish line
    if (!playerFinished && (position + PLAYER_Z) >= finishZ) playerCrossFinish();

    // if the player runs off the end of the road without finishing, end series
    if (position + PLAYER_Z >= trackLength - SEG_LEN * 2 && !playerFinished) { gameOver(); return; }

    var playerZabs = position + PLAYER_Z;

    // ----- CPU rivals: competitive, rubber-banded, NON-wrapping -----
    for (var i = 0; i < opponents.length; i++) {
      var o = opponents[i];

      if (o.finished) {
        // already crossed: coast off to the side, keep rolling forward slowly
        o.speed += DECEL * dt; if (o.speed < 0) o.speed = 0;
        o.z += o.speed * dt;
        continue;
      }

      // --- rubber-banding: keep the race close ---
      // if a CPU is far BEHIND the player, speed it up; if far AHEAD, ease it.
      var gap = o.z - playerZabs;                  // + = ahead of player, - = behind
      var band = 1;
      if (gap < -3000) band = 1.12;                // trailing: catch up
      else if (gap < -800) band = 1.05;
      else if (gap > 4000) band = 0.90;            // leading: back off so player can chase
      else if (gap > 1500) band = 0.96;

      // ease on sharp curves like a real driver
      var oSeg = findSegment(Math.min(o.z, trackLength - 1));
      var curveEase = 1 - Math.min(0.22, Math.abs(oSeg.curve) * 0.03);
      o.speed = o.baseSpeed * band * curveEase;

      // --- racing line + aggression: pick a lane; if near the player, hunt them ---
      var nearPlayer = Math.abs(gap) < 1800;
      if (nearPlayer && Math.random() < o.aggro * 0.05) {
        // steer toward the player's lane to bully them toward the edge
        o.targetX = playerX + (playerX > 0 ? 0.15 : -0.15);
      } else if (Math.random() < 0.012) {
        o.targetX = (Math.random() * 1.4 - 0.7);
      }
      o.x += (o.targetX - o.x) * Math.min(1, dt * 1.6);
      o.x = Math.max(-0.95, Math.min(0.95, o.x));

      o.z += o.speed * dt;                          // FINITE: no wrapping

      // CPU crosses the finish
      if (o.z >= finishZ) {
        o.finished = true;
        var af = 0; for (var k = 0; k < opponents.length; k++) if (opponents[k].finished) af++;
        o.finishPos = af;                            // 1st finisher gets 1, etc.
      }

      // --- contact with the player (shove) ---
      var rel = o.z - playerZabs;
      if (o.wrecked <= 0 && !playerFinished && Math.abs(rel) < SEG_LEN * 1.1 && Math.abs(o.x - playerX) < 0.30) {
        // side-by-side contact: the CPU shoves the player outward
        var dir = playerX >= o.x ? 1 : -1;
        playerX += dir * 0.22;                       // player knocked toward the edge
        o.x -= dir * 0.06;                           // CPU barely budges (aggressive)
        speed *= 0.82;                               // player loses some momentum
        o.wrecked = 0.35;
        if (window.SunsetDriftSound) window.SunsetDriftSound.crash();
      }
      if (o.wrecked > 0) o.wrecked -= dt;
    }

    if (window.SunsetDriftSound) window.SunsetDriftSound.updateEngine(speed, MAX_SPEED);
  }

  // ---------- render ----------
  function render() {
    drawBackground();

    var baseSeg = findSegment(position);
    var basePct = (position % SEG_LEN) / SEG_LEN;
    var x = 0, dx = -(baseSeg.curve * basePct);
    var maxy = H;
    var camY = CAM_H + (findSegment(position + PLAYER_Z).p1.world.y || 0);

    for (var n = 0; n < DRAW_DIST; n++) {
      var segIdx = baseSeg.index + n;
      if (segIdx >= segments.length) break;         // finite track: stop at the end
      var seg = segments[segIdx];
      var camZ = position;

      project(seg.p1, (playerX * ROAD_W) - x, camY, camZ);
      project(seg.p2, (playerX * ROAD_W) - x - dx, camY, camZ);

      x += dx;
      dx += seg.curve;

      if (seg.p1.camera.z <= FIELD || seg.p2.screen.y >= maxy || seg.p2.screen.y >= seg.p1.screen.y) continue;
      drawSegment(seg);
      drawFinishLine(seg, segIdx);
      maxy = seg.p2.screen.y;
    }

    // roadside scenery (finite: no wrap)
    for (var n = DRAW_DIST - 1; n >= 0; n--) {
      var segIdx2 = baseSeg.index + n;
      if (segIdx2 >= segments.length) continue;
      var seg = segments[segIdx2];
      for (var s = 0; s < seg.sprites.length; s++) drawSprite(seg, seg.sprites[s]);
    }

    // opponents: project each directly from its own Z (sorted far->near)
    var camY2 = camY;
    var sortedOpp = opponents.slice().sort(function (a, b) {
      return (b.z - position) - (a.z - position);
    });
    for (var oi = 0; oi < sortedOpp.length; oi++) {
      drawOpponent(sortedOpp[oi], camY2);
    }

    drawPlayerCar();
    drawHUD();
    if (state === STATE.MENU) drawMenu();
    if (state === STATE.OVER) drawOver();
    if (state === STATE.STAGEDONE) drawStageDone();
    if (state === STATE.WIN) drawWin();
  }

  function drawBackground() {
    // multi-stop sunset gradient for atmospheric depth
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
    g.addColorStop(0, COL.skyTop);
    g.addColorStop(0.35, COL.skyUpper);
    g.addColorStop(0.62, COL.skyMid);
    g.addColorStop(0.85, COL.skyWarm);
    g.addColorStop(1, COL.skyLow);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    var sunY = H * 0.40, sunR = Math.max(70, H * 0.16);

    // soft outer corona (radial glow)
    var cg = ctx.createRadialGradient(W / 2, sunY, sunR * 0.3, W / 2, sunY, sunR * 3.2);
    cg.addColorStop(0, 'rgba(255,220,120,0.55)');
    cg.addColorStop(0.4, 'rgba(255,140,80,0.22)');
    cg.addColorStop(1, 'rgba(255,140,80,0)');
    ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H * 0.62);

    // the sun disc with a vertical gradient (hotter at top)
    var sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sg.addColorStop(0, COL.sun); sg.addColorStop(0.5, COL.sunCore); sg.addColorStop(1, COL.sunOuter);
    ctx.save();
    ctx.fillStyle = sg; ctx.shadowColor = 'rgba(255,210,120,0.8)'; ctx.shadowBlur = 50;
    ctx.beginPath(); ctx.arc(W / 2, sunY, sunR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // retro sun bands (cut into the lower half of the disc)
    ctx.save();
    ctx.beginPath(); ctx.rect(W / 2 - sunR, sunY, sunR * 2, sunR); ctx.clip();
    ctx.fillStyle = COL.skyMid;
    for (var i = 0; i < 7; i++) { var by = sunY + 8 + i * (sunR * 0.16); ctx.fillRect(W / 2 - sunR, by, sunR * 2, Math.max(2, sunR * 0.05 + i)); }
    ctx.restore();

    // parallax mountain ranges, far to near, with haze between them
    var shift = (position * 0.00002 * W) % W;
    drawMountains(H * 0.50, COL.mountain1, shift * 0.35, H * 0.20, 0.5);
    drawMountains(H * 0.53, COL.mountain2, shift * 0.6, H * 0.15, 0.75);
    drawMountains(H * 0.56, COL.mountain3, shift, H * 0.11, 1);

    // horizon haze band so the ground meets the sky softly
    var hz = ctx.createLinearGradient(0, H * 0.5, 0, H * 0.62);
    hz.addColorStop(0, 'rgba(232,138,106,0)');
    hz.addColorStop(1, 'rgba(232,138,106,0.5)');
    ctx.fillStyle = hz; ctx.fillRect(0, H * 0.5, W, H * 0.12);
  }
  function drawMountains(baseY, color, shift, amp, densityAlpha) {
    ctx.save();
    ctx.globalAlpha = densityAlpha;
    // body
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-shift, baseY);
    var peaks = 8, step = (W + 200) / peaks;
    var pts = [];
    for (var i = 0; i <= peaks; i++) {
      var px = -shift + i * step;
      var py = baseY - Math.abs(Math.sin(i * 1.7 + baseY) * amp) - (i % 2) * (amp * 0.15);
      pts.push([px, py]);
      ctx.lineTo(px, py); ctx.lineTo(px + step / 2, baseY);
    }
    ctx.lineTo(W + 200, baseY); ctx.lineTo(W + 200, H); ctx.lineTo(-shift, H);
    ctx.closePath(); ctx.fill();
    // sunlit right-facing slopes (lighter highlight toward the sun)
    ctx.globalAlpha = densityAlpha * 0.5;
    ctx.strokeStyle = 'rgba(255,180,120,0.5)'; ctx.lineWidth = 2;
    for (var j = 0; j < pts.length; j++) {
      ctx.beginPath(); ctx.moveTo(pts[j][0], pts[j][1]);
      ctx.lineTo(pts[j][0] + step / 2, baseY); ctx.stroke();
    }
    ctx.restore();
  }

  function poly(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath(); ctx.fill();
  }

  function drawSegment(seg) {
    var p1 = seg.p1.screen, p2 = seg.p2.screen;
    var dark = seg.color === 'dark';
    var grass = dark ? COL.grassDark : COL.grassLight;
    var road = dark ? COL.roadDark : COL.roadLight;
    var rumble = dark ? COL.rumbleDark : COL.rumbleLight;

    // grass with a subtle vertical shade (darker far, lighter near)
    ctx.fillStyle = grass; ctx.fillRect(0, p2.y, W, p1.y - p2.y);
    // faint grass texture stripe near the road edge for depth
    if (!dark) {
      ctx.fillStyle = COL.grassEdge; ctx.globalAlpha = 0.3;
      ctx.fillRect(0, p2.y, W, Math.max(1, (p1.y - p2.y) * 0.5)); ctx.globalAlpha = 1;
    }

    // dark shoulder under the rumble for grounding
    poly(p1.x - p1.w - p1.w / 5, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - p2.w / 5, p2.y, COL.roadEdge);
    poly(p1.x + p1.w + p1.w / 5, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + p2.w / 5, p2.y, COL.roadEdge);

    // rumble strips
    var r1 = p1.w / 6, r2 = p2.w / 6;
    poly(p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, rumble);
    poly(p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, rumble);

    // road surface
    poly(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, road);

    // subtle centre-crown sheen on light segments (asphalt highlight)
    if (!dark) {
      var cw1 = p1.w * 0.5, cw2 = p2.w * 0.5;
      ctx.globalAlpha = 0.10; ctx.fillStyle = '#ffffff';
      poly(p1.x - cw1, p1.y, p1.x + cw1, p1.y, p2.x + cw2, p2.y, p2.x - cw2, p2.y, '#ffffff');
      ctx.globalAlpha = 1;
    }

    // lane markers
    if (!dark) {
      var lw1 = p1.w / 24, lw2 = p2.w / 24;
      for (var l = 1; l < LANES; l++) {
        var lx1 = p1.x - p1.w + (p1.w * 2) * (l / LANES);
        var lx2 = p2.x - p2.w + (p2.w * 2) * (l / LANES);
        poly(lx1 - lw1, p1.y, lx1 + lw1, p1.y, lx2 + lw2, p2.y, lx2 - lw2, p2.y, COL.lane);
      }
    }

    // distance fog: fade far segments into the haze near the horizon
    var horizon = H * 0.56;
    if (p2.y < horizon + 60) {
      var fogAmt = Math.max(0, Math.min(0.6, (horizon + 60 - p2.y) / 120));
      ctx.globalAlpha = fogAmt; ctx.fillStyle = COL.fog;
      ctx.fillRect(0, p2.y, W, p1.y - p2.y); ctx.globalAlpha = 1;
    }
  }

  function drawFinishLine(seg, segIdx) {
    // draw a checkered band on the segment that holds the finish line
    var finishSeg = Math.floor(finishZ / SEG_LEN);
    if (segIdx !== finishSeg) return;
    var p1 = seg.p1.screen, p2 = seg.p2.screen;
    if (!p1 || p1.scale <= 0) return;
    var cols = 10;
    for (var c = 0; c < cols; c++) {
      ctx.fillStyle = (c % 2 === 0) ? '#ffffff' : '#111111';
      var xa = p1.x - p1.w + (p1.w * 2) * (c / cols);
      var xb = p1.x - p1.w + (p1.w * 2) * ((c + 1) / cols);
      ctx.fillRect(Math.min(xa, xb), p1.y - 6, Math.abs(xb - xa), 12);
    }
  }


  function drawSprite(seg, sprite) {
    var p = seg.p1.screen;
    if (p.scale <= 0 || seg.p1.camera.z <= FIELD) return;
    var sx = p.x + (p.scale * sprite.offset * ROAD_W * W / 2);
    var sy = p.y;
    var sc = p.scale * W * 1.4;
    if (sc < 2) return;
    if (sprite.type === 'tree') drawTree(sx, sy, sc);
    else if (sprite.type === 'rock') drawRock(sx, sy, sc);
    else if (sprite.type === 'cactus') drawCactus(sx, sy, sc);
    else drawBillboard(sx, sy, sc);
  }
  function drawTree(x, y, s) {
    var h = s * 70, w = s * 40;
    // trunk with a shaded side
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - w * 0.08, y - h * 0.35, w * 0.16, h * 0.35);
    ctx.fillStyle = '#2a1c10'; ctx.fillRect(x + w * 0.02, y - h * 0.35, w * 0.06, h * 0.35);
    // layered canopy: back (dark) then front (light) discs for depth
    var canopy = [['#255a2a', 0], ['#2f6b34', -h * 0.1], ['#3a7d40', -h * 0.22]];
    for (var c = 0; c < canopy.length; c++) {
      ctx.fillStyle = canopy[c][0];
      ctx.beginPath();
      ctx.arc(x, y - h * 0.55 + canopy[c][1], w * (0.55 - c * 0.06), 0, Math.PI * 2);
      ctx.arc(x - w * 0.28, y - h * 0.42 + canopy[c][1], w * (0.4 - c * 0.05), 0, Math.PI * 2);
      ctx.arc(x + w * 0.28, y - h * 0.42 + canopy[c][1], w * (0.4 - c * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
    // sun-side highlight
    ctx.fillStyle = 'rgba(255,220,140,0.25)';
    ctx.beginPath(); ctx.arc(x + w * 0.18, y - h * 0.62, w * 0.22, 0, Math.PI * 2); ctx.fill();
  }
  function drawRock(x, y, s) {
    var w = s * 34, h = s * 26;
    ctx.fillStyle = '#7a6a5a';
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w * 0.3, y - h); ctx.lineTo(x + w * 0.2, y - h * 0.8); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a7a6a';
    ctx.beginPath(); ctx.moveTo(x - w * 0.3, y - h); ctx.lineTo(x + w * 0.2, y - h * 0.8); ctx.lineTo(x, y - h * 0.4); ctx.closePath(); ctx.fill();
  }
  function drawCactus(x, y, s) {
    var h = s * 55, w = s * 16;
    ctx.fillStyle = '#2f7d4f';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillRect(x - w * 1.4, y - h * 0.6, w * 0.8, h * 0.4);
    ctx.fillRect(x + w * 0.6, y - h * 0.75, w * 0.8, h * 0.5);
    ctx.fillRect(x - w * 1.4, y - h * 0.6, w * 0.8, w * 0.8);
    ctx.fillRect(x + w * 0.6, y - h * 0.75, w * 0.8, w * 0.8);
  }
  function drawBillboard(x, y, s) {
    var w = s * 90, h = s * 55;
    ctx.fillStyle = '#222'; ctx.fillRect(x - s * 4, y - h * 0.5, s * 8, h * 0.5);
    ctx.fillStyle = '#ff5a5f'; ctx.fillRect(x - w / 2, y - h, w, h * 0.6);
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.max(6, s * 22) + 'px monospace';
    ctx.textAlign = 'center'; ctx.fillText('2BA', x, y - h * 0.62);
    ctx.textAlign = 'left';
  }

  // Project an opponent directly from its Z relative to the camera. We also
  // accumulate the road's horizontal curve offset up to the opponent's distance
  // so the car sits on the curving road, not a straight line.
  function drawOpponent(o, camY) {
    // opponent distance ahead of the CAMERA (finite track, no wrap)
    var rel = o.z - position;
    if (rel < 1 || rel > DRAW_DIST * SEG_LEN) return;   // behind camera or too far

    // Walk segments from the camera to the opponent, accumulating the SAME
    // curve offset the road render uses, so the car sits on the curving road.
    var baseSeg = findSegment(position);
    var basePct = (position % SEG_LEN) / SEG_LEN;
    var x = 0, dx = -(baseSeg.curve * basePct);
    var segsAhead = Math.floor((rel + (position % SEG_LEN)) / SEG_LEN);
    for (var k = 0; k < segsAhead; k++) {
      var sgi = baseSeg.index + k;
      if (sgi >= segments.length) break;
      var sg = segments[sgi];
      x += dx; dx += sg.curve;
    }
    var oSegIdx = Math.min(baseSeg.index + segsAhead, segments.length - 1);
    var oSeg = segments[oSegIdx];
    var worldY = (oSeg && oSeg.p1.world.y) || 0;

    var camZ = rel;
    if (camZ <= FIELD) return;
    var scale = FIELD / camZ;
    // same projection form as road.project: camX offset = playerX * ROAD_W - x
    var sx = Math.round((W / 2) + (scale * ((o.x * ROAD_W) - (playerX * ROAD_W) + x) * W / 2));
    var sy = Math.round((H / 2) - (scale * (worldY - camY) * H / 2));
    // size to projected road width (matches how the road scales), player-ish near
    var roadHalfPx = scale * ROAD_W * (W / 2);
    var sc = (roadHalfPx * 0.30) / 46;    // 46 = drawCar native half-body; tuned to ~player size near
    if (sc < 0.15) return;
    var flick = (o.wrecked > 0 && Math.floor(frame) % 2 === 0);
    drawCar(sx, sy, sc, flick ? '#ffffff' : o.color, false);
  }

  function drawCar(x, y, s, color, isPlayer) {
    var w = s * 46, h = s * 30;
    ctx.save();

    // soft contact shadow (gradient ellipse)
    var shg = ctx.createRadialGradient(x, y + h * 0.05, 2, x, y + h * 0.05, w * 0.65);
    shg.addColorStop(0, 'rgba(0,0,0,0.5)'); shg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shg;
    ctx.beginPath(); ctx.ellipse(x, y + h * 0.06, w * 0.62, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();

    // rear tyres (rounded)
    ctx.fillStyle = '#0a0a0a';
    roundRect(x - w * 0.54, y - h * 0.30, w * 0.16, h * 0.40, 3);
    roundRect(x + w * 0.38, y - h * 0.30, w * 0.16, h * 0.40, 3);

    // lower body with a vertical metallic gradient (lighter top, darker sill)
    var bg = ctx.createLinearGradient(0, y - h * 0.6, 0, y);
    bg.addColorStop(0, shade(color, 1.25));
    bg.addColorStop(0.5, color);
    bg.addColorStop(1, shade(color, 0.6));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x + w * 0.42, y - h * 0.6); ctx.lineTo(x - w * 0.42, y - h * 0.6); ctx.closePath(); ctx.fill();

    // cabin / roof with its own gradient
    var rg = ctx.createLinearGradient(0, y - h, 0, y - h * 0.6);
    rg.addColorStop(0, shade(color, 1.1)); rg.addColorStop(1, shade(color, 0.75));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, y - h * 0.6); ctx.lineTo(x + w * 0.3, y - h * 0.6);
    ctx.lineTo(x + w * 0.2, y - h); ctx.lineTo(x - w * 0.2, y - h); ctx.closePath(); ctx.fill();

    // rear window (dark glass with a sky glint)
    ctx.fillStyle = 'rgba(30,40,60,0.85)';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.24, y - h * 0.64); ctx.lineTo(x + w * 0.24, y - h * 0.64);
    ctx.lineTo(x + w * 0.16, y - h * 0.94); ctx.lineTo(x - w * 0.16, y - h * 0.94); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,150,0.25)';
    ctx.fillRect(x - w * 0.16, y - h * 0.9, w * 0.32, h * 0.06);

    // body top highlight line
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, s * 0.8);
    ctx.beginPath(); ctx.moveTo(x - w * 0.4, y - h * 0.58); ctx.lineTo(x + w * 0.4, y - h * 0.58); ctx.stroke();

    // tail lights (glowing)
    ctx.fillStyle = '#ff3030'; ctx.shadowColor = '#ff2020'; ctx.shadowBlur = isPlayer ? 14 : 8;
    roundRect(x - w * 0.44, y - h * 0.5, w * 0.16, h * 0.22, 2);
    roundRect(x + w * 0.28, y - h * 0.5, w * 0.16, h * 0.22, 2);
    ctx.shadowBlur = 0;
    // bright brake filament
    ctx.fillStyle = '#ffb0b0';
    ctx.fillRect(x - w * 0.42, y - h * 0.44, w * 0.10, h * 0.06);
    ctx.fillRect(x + w * 0.30, y - h * 0.44, w * 0.10, h * 0.06);

    ctx.restore();
  }

  // rounded-rect helper (visual only)
  function roundRect(rx, ry, rw, rh, rad) {
    var r = Math.min(rad, rw / 2, rh / 2);
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
    ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
    ctx.arcTo(rx, ry + rh, rx, ry, r);
    ctx.arcTo(rx, ry, rx + rw, ry, r);
    ctx.closePath(); ctx.fill();
  }
  // lighten/darken a hex colour by a factor (visual only)
  function shade(hex, f) {
    if (hex[0] !== '#' || hex.length < 7) return hex;
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    r = Math.max(0, Math.min(255, Math.round(r * f)));
    g = Math.max(0, Math.min(255, Math.round(g * f)));
    b = Math.max(0, Math.min(255, Math.round(b * f)));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawPlayerCar() {
    if (state === STATE.OVER) return;
    var bounce = (state === STATE.PLAY && speed > 0) ? Math.sin(frame * 0.4) * (speed / MAX_SPEED) * 2 : 0;
    var lean = 0;
    if (keys['ArrowLeft'] || keys['KeyA'] || touchSteer < 0) lean = -1;
    if (keys['ArrowRight'] || keys['KeyD'] || touchSteer > 0) lean = 1;
    drawCar(W / 2 + lean * 6, H - 90 + bounce, 2.6, '#e01e37', true);
  }

  function racePosition() {
    // live position = 1 + number of rivals physically ahead on the finite track
    var playerZabs = position + PLAYER_Z;
    var ahead = 0;
    for (var i = 0; i < opponents.length; i++) {
      if (opponents[i].z > playerZabs) ahead++;
    }
    return ahead + 1;
  }

  function drawHUD() {
    ctx.font = "20px monospace"; ctx.textAlign = 'left';
    var mph = Math.floor((speed / MAX_SPEED) * 200);
    ctx.fillStyle = '#ffde59'; ctx.fillText(mph + ' MPH', 20, 34);
    // race position
    var pos = racePosition(), total = opponents.length + 1;
    ctx.fillStyle = '#fff'; ctx.font = "26px monospace";
    ctx.fillText('POS ' + pos + '/' + total, 20, 62);
    // stage + progress to finish
    ctx.font = "20px monospace"; ctx.textAlign = 'right';
    ctx.fillStyle = '#ffcc33';
    ctx.fillText((STAGE_DEFS[stageNum] ? STAGE_DEFS[stageNum].name : '') + ' / ' + STAGE_DEFS.length, W - 20, 34);
    ctx.fillStyle = '#00e6ff';
    ctx.fillText('SCORE ' + totalScore, W - 20, 58);
    // progress bar to the finish line
    var prog = Math.max(0, Math.min(1, (position + PLAYER_Z) / finishZ));
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(W - 216, 72, 200, 8);
    ctx.fillStyle = '#ffde59'; ctx.fillRect(W - 216, 72, 200 * prog, 8);
    // finish flag icon at the end of the bar
    ctx.fillStyle = '#fff'; ctx.font = "16px monospace"; ctx.fillText('\u2691', W - 8, 80);
    ctx.textAlign = 'left';
  }

  function dim() { ctx.fillStyle = 'rgba(20,8,30,0.65)'; ctx.fillRect(0, 0, W, H); }
  function drawMenu() {
    dim(); ctx.textAlign = 'center';
    ctx.fillStyle = '#ffde59'; ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 20;
    ctx.font = "48px monospace"; ctx.fillText('SUNSET DRIFT', W / 2, H / 2 - 30);
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = "20px monospace";
    ctx.fillText('\u2191/W accelerate   \u2193/S brake   \u2190 \u2192 steer', W / 2, H / 2 + 16);
    ctx.fillStyle = '#00e6ff';
    if (Math.floor(frame / 30) % 2 === 0) ctx.fillText('PRESS SPACE TO DRIVE', W / 2, H / 2 + 56);
    ctx.textAlign = 'left';
  }
  function drawOver() {
    dim(); ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a5f'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 16;
    ctx.font = "44px monospace"; ctx.fillText('OUT OF THE RACE', W / 2, H / 2 - 20);
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = "24px monospace";
    ctx.fillText('SCORE ' + totalScore, W / 2, H / 2 + 20);
    ctx.fillStyle = '#00e6ff'; ctx.font = "20px monospace";
    if (Date.now() - overAt > 700 && Math.floor(frame / 30) % 2 === 0) ctx.fillText('SPACE TO RACE AGAIN', W / 2, H / 2 + 54);
    ctx.textAlign = 'left';
  }

  function ordinal(n) { var s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  function drawStageDone() {
    dim(); ctx.textAlign = 'center';
    var st = STAGE_DEFS[stageNum];
    ctx.fillStyle = '#ffde59'; ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 18;
    ctx.font = "44px monospace"; ctx.fillText(st.name + ' COMPLETE', W / 2, H / 2 - 40);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = "30px monospace";
    ctx.fillText('You finished ' + ordinal(playerFinishPos) + ' of ' + (opponents.length + 1), W / 2, H / 2 + 4);
    ctx.fillStyle = '#00e6ff'; ctx.font = "22px monospace";
    ctx.fillText('SCORE ' + totalScore, W / 2, H / 2 + 40);
    ctx.fillStyle = '#aaa'; ctx.font = "18px monospace";
    var nextName = (stageNum + 1 < STAGE_DEFS.length) ? ('NEXT: ' + STAGE_DEFS[stageNum + 1].name) : 'FINAL RESULTS...';
    ctx.fillText(nextName, W / 2, H / 2 + 74);
    ctx.textAlign = 'left';
  }

  function drawWin() {
    dim(); ctx.textAlign = 'center';
    ctx.fillStyle = '#ffde59'; ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 22;
    ctx.font = "46px monospace"; ctx.fillText('SERIES COMPLETE', W / 2, H / 2 - 30);
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = "28px monospace";
    ctx.fillText('FINAL SCORE ' + totalScore, W / 2, H / 2 + 12);
    ctx.fillStyle = '#00e6ff'; ctx.font = "20px monospace";
    if (Date.now() - overAt > 800 && Math.floor(frame / 30) % 2 === 0) ctx.fillText('SPACE TO RACE THE SERIES AGAIN', W / 2, H / 2 + 50);
    ctx.textAlign = 'left';
  }

  window.SunsetDrift = { getScore: function () { return Math.floor(distance); }, getState: function () { return state; } };

  buildTrack();
  var last = 0;
  function loop(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    update(dt); render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
