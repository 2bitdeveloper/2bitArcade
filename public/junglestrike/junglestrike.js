// ============================================================
// JUNGLE STRIKE  (c) 2bit Developer - original work for 2bitArcade
// A tropical run-and-gun in the classic arcade tradition. Run, jump,
// aim 8 ways, grab weapon power-ups, and fight through stages that each
// have their own look: jungle, river, cave, and the enemy base.
// Pure vanilla canvas. No third-party assets; all art drawn in code.
// Score = points from kills + stage-clear bonuses.
// ============================================================
(function () {
  'use strict';

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var GROUND_Y = H - 70;

  // ---------- state ----------
  var STATE = { MENU: 0, PLAY: 1, DEAD: 2, STAGECLEAR: 3, WIN: 4 };
  var state = STATE.MENU;
  var frame = 0, overAt = 0, stageClearAt = 0;
  var score = 0, best = 0, lives = 3, stageIndex = 0;

  // ---------- stage definitions (each looks different) ----------
  var STAGES = [
    {
      name: 'JUNGLE', length: 6000,
      sky: ['#1a3a2a', '#2d5a3a', '#4a7a4a'],
      ground: '#3a2a1a', groundTop: '#4a7a3a',
      accent: '#6ab04c', prop: 'tree',
      enemies: ['soldier', 'soldier', 'runner', 'turret'],
      bossName: 'JUNGLE WALKER'
    },
    {
      name: 'RIVER', length: 6500,
      sky: ['#1a2a4a', '#2a4a7a', '#5a8ac0'],
      ground: '#2a3a5a', groundTop: '#3a6a8a',
      accent: '#4ac0e0', prop: 'reed',
      enemies: ['soldier', 'runner', 'jumper', 'turret'],
      bossName: 'RIVER GUNBOAT'
    },
    {
      name: 'CAVE', length: 6000,
      sky: ['#0a0812', '#1a1225', '#2a1a3a'],
      ground: '#1a1420', groundTop: '#3a2a4a',
      accent: '#c060ff', prop: 'crystal',
      enemies: ['runner', 'jumper', 'flyer', 'turret'],
      bossName: 'CAVE SENTINEL'
    },
    {
      name: 'ENEMY BASE', length: 5500,
      sky: ['#2a1010', '#4a1a1a', '#6a2a20'],
      ground: '#2a2028', groundTop: '#5a3a3a',
      accent: '#ff5a3c', prop: 'pipe',
      enemies: ['soldier', 'jumper', 'flyer', 'turret', 'turret'],
      bossName: 'WAR MACHINE'
    }
  ];

  // ---------- weapons ----------
  // R (rifle, default), S (spread), M (machine gun/rapid), L (laser)
  var WEAPONS = {
    R: { name: 'RIFLE', cooldown: 14, speed: 11, dmg: 1, spread: 0, color: '#ffe066', size: 4 },
    S: { name: 'SPREAD', cooldown: 20, speed: 9, dmg: 1, spread: 3, color: '#ff9d4d', size: 4 },
    M: { name: 'MACHINE', cooldown: 6, speed: 12, dmg: 1, spread: 0, color: '#4ac0e0', size: 3 },
    L: { name: 'LASER', cooldown: 24, speed: 18, dmg: 3, spread: 0, color: '#ff4de0', size: 6 }
  };

  // ---------- player ----------
  var player = {
    x: 120, y: GROUND_Y, w: 26, h: 46, vx: 0, vy: 0,
    onGround: true, facing: 1, aimUp: false, aimDown: false,
    weapon: 'R', shootTimer: 0, invuln: 0, ducking: false, standingOn: null,
    walkPhase: 0
  };
  var GRAVITY = 0.9, JUMP_V = -16, MOVE_SPEED = 4.2;

  // ---------- world ----------
  var camX = 0;            // camera scroll
  var bullets = [];        // player bullets
  var enemyBullets = [];
  var enemies = [];
  var powerups = [];
  var particles = [];
  var props = [];          // background scenery
  var platforms = [];      // one-way platforms the player/enemies stand on
  var stageDist = 0;       // how far into the stage
  var spawnTimer = 0;
  var boss = null;

  // ---------- input ----------
  var keys = {};
  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyZ','KeyX'].indexOf(e.code) >= 0) e.preventDefault();
    if (state === STATE.MENU && (e.code === 'Space' || e.code === 'Enter')) startGame();
    if (state === STATE.DEAD && Date.now() - overAt > 800 && (e.code === 'Space' || e.code === 'Enter')) startGame();
    if (state === STATE.WIN && Date.now() - overAt > 800 && (e.code === 'Space' || e.code === 'Enter')) startGame();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });

  // touch controls (on-screen buttons drawn at bottom; simple zones)
  var touch = { left: false, right: false, up: false, down: false, jump: false, fire: false };
  function setTouchFromPoint(px, py, down) {
    var r = canvas.getBoundingClientRect();
    var x = (px - r.left) / r.width * W;
    var y = (py - r.top) / r.height * H;
    // left third bottom = dpad, right third = fire/jump
    if (state !== STATE.PLAY) { if (down) startGame(); return; }
    touch.left = touch.right = touch.up = touch.down = false;
    if (down) {
      if (x < W * 0.32) { // dpad zone
        if (x < W * 0.14) touch.left = true; else if (x < W * 0.30) touch.right = true;
        if (y < H - 60) touch.up = true;
      } else if (x > W * 0.80) {
        touch.fire = true;
      } else if (x > W * 0.66) {
        touch.jump = true;
      }
    }
  }
  canvas.addEventListener('pointerdown', function (e) { setTouchFromPoint(e.clientX, e.clientY, true); });
  canvas.addEventListener('pointerup', function () { touch.left = touch.right = touch.up = touch.down = touch.jump = touch.fire = false; });

  // ---------- lifecycle ----------
  function startGame() {
    state = STATE.PLAY;
    score = 0; lives = 3; stageIndex = 0;
    loadStage(0);
    if (window.JungleStrikeBridge) window.JungleStrikeBridge.onStart();
    if (window.JungleStrikeSound) { window.JungleStrikeSound.resume(); window.JungleStrikeSound.startMusic(stageIndex); }
  }

  function loadStage(idx) {
    stageIndex = idx;
    var st = STAGES[idx];
    camX = 0; stageDist = 0; spawnTimer = 60;
    bullets = []; enemyBullets = []; enemies = []; powerups = []; particles = []; boss = null;
    player.x = 120; player.y = GROUND_Y; player.vx = 0; player.vy = 0;
    player.onGround = true; player.invuln = 90; player.weapon = player.weapon || 'R';
    buildProps(st);
    buildPlatforms(st);
    state = STATE.PLAY;
  }

  function buildPlatforms(st) {
    platforms = [];
    // Procedurally lay out floating platforms across the stage (leaving the
    // final stretch clear for the boss arena). Heights vary so there's real
    // vertical play. Some platforms will carry enemies (placed at spawn time).
    var x = 900;   // start a bit into the stage
    while (x < st.length - W - 200) {
      var pw = 120 + Math.random() * 160;
      // height above ground: one of a few tiers so jumps are makeable
      var tier = 1 + Math.floor(Math.random() * 3);   // 1..3
      var py = GROUND_Y - tier * 90;                   // 90 / 180 / 270 up
      platforms.push({ x: x, y: py, w: pw, kind: st.prop });
      // sometimes stack a second, higher platform nearby
      if (Math.random() < 0.35) {
        platforms.push({ x: x + pw * 0.4, y: py - 100, w: pw * 0.6, kind: st.prop });
      }
      x += pw + 180 + Math.random() * 260;
    }
  }

  function buildProps(st) {
    props = [];
    for (var i = 0; i < 60; i++) {
      props.push({
        x: Math.random() * st.length,
        layer: Math.random() < 0.5 ? 0 : 1,   // 0 = far (slow), 1 = near (fast)
        kind: st.prop,
        size: 0.6 + Math.random() * 0.9,
        y: GROUND_Y
      });
    }
  }

  function nextStage() {
    if (stageIndex + 1 >= STAGES.length) { state = STATE.WIN; overAt = Date.now(); score += 5000;
      if (Math.floor(score) > best) best = Math.floor(score);
      if (window.JungleStrikeBridge) window.JungleStrikeBridge.onGameOver(score);
      return;
    }
    score += 2000;
    loadStage(stageIndex + 1);
    if (window.JungleStrikeSound) window.JungleStrikeSound.startMusic(stageIndex);
  }

  function playerDie() {
    lives--;
    spawnExplosion(player.x, player.y - player.h / 2, '#ffcc33', 30);
    if (window.JungleStrikeSound) window.JungleStrikeSound.playerHit();
    if (lives <= 0) {
      state = STATE.DEAD; overAt = Date.now();
      if (Math.floor(score) > best) best = Math.floor(score);
      if (window.JungleStrikeBridge) window.JungleStrikeBridge.onGameOver(score);
    } else {
      player.x = camX + 120; player.y = GROUND_Y; player.vy = 0; player.invuln = 120;
      player.weapon = 'R';
    }
  }

  // expose stubs used by parts 2/3 (defined below via assignment)

  // ============ everything below wired in parts 2 & 3 (same IIFE) ============
  // ---------- shooting ----------
  function shoot() {
    var wp = WEAPONS[player.weapon];
    if (player.shootTimer > 0) return;
    player.shootTimer = wp.cooldown;
    var muzzleX = player.x + player.facing * 16;
    var muzzleY = player.y - player.h + 16;
    // aim direction: 8-way. Straight, up, down, and diagonals while moving.
    var moving = keys['ArrowLeft'] || keys['ArrowRight'] || keys['KeyA'] || keys['KeyD'] || touch.left || touch.right;
    var dx = player.facing, dy = 0;
    if (player.aimUp && moving) { dx = player.facing; dy = -1; }      // diagonal up
    else if (player.aimUp) { dx = 0; dy = -1; }                        // straight up
    else if (player.aimDown && !player.onGround && moving) { dx = player.facing; dy = 1; } // diagonal down (airborne)
    else if (player.aimDown && !player.onGround) { dx = 0; dy = 1; }   // straight down (airborne)
    else { dx = player.facing; dy = 0; }                              // straight ahead
    // normalize diagonal
    var len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;

    var shots = wp.spread ? wp.spread : 1;
    for (var i = 0; i < shots; i++) {
      var ang = Math.atan2(dy, dx) + (wp.spread ? (i - (shots - 1) / 2) * 0.25 : 0);
      bullets.push({
        x: muzzleX, y: muzzleY,
        vx: Math.cos(ang) * wp.speed, vy: Math.sin(ang) * wp.speed,
        dmg: wp.dmg, color: wp.color, size: wp.size, life: 90
      });
    }
    if (window.JungleStrikeSound) window.JungleStrikeSound.shoot(player.weapon);
  }

  // ---------- enemy factory ----------
  function spawnEnemy(type, x) {
    var e = { type: type, x: x, y: GROUND_Y, vx: 0, vy: 0, hp: 1, w: 28, h: 44,
      onGround: true, shootTimer: 60 + Math.random() * 60, hit: 0, points: 100 };
    if (type === 'soldier') { e.hp = 2; e.vx = -1.2; e.points = 100; }
    else if (type === 'runner') { e.hp = 1; e.vx = -3.2; e.points = 150; e.w = 24; }
    else if (type === 'jumper') { e.hp = 2; e.vx = -1.8; e.points = 200; e.jumpTimer = 40; }
    else if (type === 'turret') { e.hp = 4; e.vx = 0; e.points = 250; e.w = 34; e.h = 34; e.y = GROUND_Y; }
    else if (type === 'flyer') { e.hp = 2; e.vx = -2.4; e.points = 200; e.y = GROUND_Y - 120 - Math.random() * 100; e.onGround = false; e.bobBase = e.y; e.bob = Math.random() * 6.28; }
    return e;
  }

  function spawnBoss(st) {
    boss = {
      x: camX + W + 80, y: GROUND_Y, w: 120, h: 130,
      hp: 60, maxHp: 60, hit: 0, shootTimer: 40, phase: 0, moveDir: 1, entered: false,
      name: st.bossName, points: 3000
    };
  }

  // ---------- powerups ----------
  function dropPowerup(x, y) {
    var types = ['S', 'M', 'L', 'life'];
    var t = types[Math.floor(Math.random() * types.length)];
    powerups.push({ x: x, y: y, w: 22, h: 22, type: t, vy: -4, bob: 0, life: 600 });
  }

  // ---------- update ----------
  function update() {
    frame++;
    if (state === STATE.STAGECLEAR) { if (Date.now() - stageClearAt > 1800) nextStage(); return; }
    if (state !== STATE.PLAY) { updateParticles(); return; }

    var st = STAGES[stageIndex];

    // ----- player input -----
    var left = keys['ArrowLeft'] || keys['KeyA'] || touch.left;
    var right = keys['ArrowRight'] || keys['KeyD'] || touch.right;
    var up = keys['ArrowUp'] || keys['KeyW'] || touch.up;
    var down = keys['ArrowDown'] || keys['KeyS'] || touch.down;
    var jumpK = keys['Space'] || keys['KeyC'] || touch.jump;
    var fireK = keys['KeyZ'] || keys['KeyJ'] || keys['KeyX'] || touch.fire;

    player.aimUp = up; player.aimDown = down;
    player.ducking = down && player.onGround;

    if (!player.ducking) {
      if (left) { player.vx = -MOVE_SPEED; player.facing = -1; }
      else if (right) { player.vx = MOVE_SPEED; player.facing = 1; }
      else player.vx = 0;
    } else player.vx = 0;

    // drop through a platform: hold down + press jump while standing on one
    var dropThrough = down && jumpK && player.onGround && player.standingOn;
    if (dropThrough) { player.onGround = false; player.y += 4; player.standingOn = null; player.vy = 2; }
    else if (jumpK && player.onGround) { player.vy = JUMP_V; player.onGround = false; if (window.JungleStrikeSound) window.JungleStrikeSound.jump(); }

    // gravity
    var prevY = player.y;
    player.vy += GRAVITY; player.y += player.vy; player.x += player.vx;

    // one-way platform landing: only when falling (vy>=0) and feet cross the top
    player.standingOn = null;
    var landed = false;
    if (player.vy >= 0 && !dropThrough) {
      for (var pi = 0; pi < platforms.length; pi++) {
        var pf = platforms[pi];
        if (player.x > pf.x - 6 && player.x < pf.x + pf.w + 6) {
          // feet went from above the platform top to below it this frame
          if (prevY <= pf.y + 2 && player.y >= pf.y) {
            player.y = pf.y; player.vy = 0; player.onGround = true; player.standingOn = pf; landed = true;
            break;
          }
        }
      }
    }
    // ground landing (only if not on a platform)
    if (!landed) {
      if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; player.onGround = true; player.standingOn = null; }
      else if (player.standingOn === null && player.vy !== 0) player.onGround = false;
    }
    if (player.onGround && player.vx !== 0) player.walkPhase += 0.25;

    // keep player within camera bounds (can't go behind screen; can push camera)
    if (player.x < camX + 20) player.x = camX + 20;
    if (player.x > camX + W * 0.6 && !boss) camX += player.vx; // camera follows forward
    if (player.x > camX + W - 30) player.x = camX + W - 30;
    if (camX < 0) camX = 0;

    // advance stage distance by camera
    stageDist = camX;

    // shooting
    if (player.shootTimer > 0) player.shootTimer--;
    if (fireK) shoot();
    if (player.invuln > 0) player.invuln--;

    // ----- spawn enemies as we scroll (until near the end, then boss) -----
    if (!boss && stageDist < st.length - W) {
      spawnTimer--;
      if (spawnTimer <= 0) {
        spawnTimer = Math.max(30, 90 - stageIndex * 8) + Math.random() * 40;
        var type = st.enemies[Math.floor(Math.random() * st.enemies.length)];
        var sx = camX + W + 20;
        var ne = spawnEnemy(type, sx);
        // ~35% of ground-type enemies get placed on a platform ahead (if one is
        // near the spawn x), giving Contra-style elevated foes to shoot.
        if (type !== 'flyer' && Math.random() < 0.35) {
          for (var pi = 0; pi < platforms.length; pi++) {
            var pf = platforms[pi];
            if (pf.x < sx && pf.x + pf.w > sx - 40 && Math.abs(pf.x - sx) < 300) {
              ne.y = pf.y; ne.onPlatform = pf; ne.vx = 0; // hold position on the ledge
              if (ne.type === 'jumper') ne.vx = -1.0;
              break;
            }
          }
        }
        enemies.push(ne);
      }
    } else if (!boss && stageDist >= st.length - W) {
      // reached the end -> spawn boss once
      spawnBoss(st);
      if (window.JungleStrikeSound) window.JungleStrikeSound.boss();
    }

    updatePlayerBullets();
    updateEnemies(st);
    updateBoss(st);
    updateEnemyBullets();
    updatePowerups();
    updateParticles();
  }

  function updatePlayerBullets() {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0 || b.x < camX - 50 || b.x > camX + W + 50 || b.y < -20 || b.y > H + 20) { bullets.splice(i, 1); continue; }
      // hit enemies
      var hit = false;
      for (var j = enemies.length - 1; j >= 0; j--) {
        var e = enemies[j];
        if (b.x > e.x - e.w / 2 && b.x < e.x + e.w / 2 && b.y > e.y - e.h && b.y < e.y) {
          e.hp -= b.dmg; e.hit = 6; hit = true;
          spawnExplosion(b.x, b.y, '#ffcc33', 5);
          if (e.hp <= 0) {
            score += e.points; spawnExplosion(e.x, e.y - e.h / 2, st_accent(), 18);
            if (Math.random() < 0.16) dropPowerup(e.x, e.y - e.h / 2);
            if (window.JungleStrikeSound) window.JungleStrikeSound.explode();
            enemies.splice(j, 1);
          }
          break;
        }
      }
      // hit boss
      if (!hit && boss && boss.entered && b.x > boss.x - boss.w / 2 && b.x < boss.x + boss.w / 2 && b.y > boss.y - boss.h && b.y < boss.y) {
        boss.hp -= b.dmg; boss.hit = 4; hit = true;
        spawnExplosion(b.x, b.y, '#ffcc33', 6);
        if (boss.hp <= 0) killBoss();
      }
      if (hit) bullets.splice(i, 1);
    }
  }
  function st_accent() { return STAGES[stageIndex].accent; }

  function killBoss() {
    score += boss.points;
    spawnExplosion(boss.x, boss.y - boss.h / 2, '#ff5a3c', 60);
    if (window.JungleStrikeSound) window.JungleStrikeSound.explode();
    boss = null;
    state = STATE.STAGECLEAR; stageClearAt = Date.now();
  }

  function updateEnemies(st) {
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      if (e.hit > 0) e.hit--;

      if (e.type === 'flyer') {
        e.bob += 0.08; e.x += e.vx; e.y = e.bobBase + Math.sin(e.bob) * 18;
      } else if (e.type === 'turret') {
        // stationary, scrolls with world
      } else {
        e.x += e.vx;
        // enemies on a platform stay at ledge height; others use the ground
        if (e.onPlatform) {
          e.y = e.onPlatform.y;
          // if it walks off the ledge, let it fall to the ground
          if (e.x < e.onPlatform.x - 10 || e.x > e.onPlatform.x + e.onPlatform.w + 10) {
            e.onPlatform = null; e.vy = 0;   // start falling toward the ground
          }
        } else if (e.falling || (e.y < GROUND_Y && e.type !== 'jumper')) {
          // de-platformed enemy falls to the ground
          e.falling = true; e.vy += GRAVITY; e.y += e.vy;
          if (e.y >= GROUND_Y) { e.y = GROUND_Y; e.vy = 0; e.falling = false; }
        } else if (e.type === 'jumper') {
          e.vy += GRAVITY; e.y += e.vy;
          if (e.y >= GROUND_Y) { e.y = GROUND_Y; e.vy = 0; e.onGround = true; e.jumpTimer--; if (e.jumpTimer <= 0) { e.vy = -13; e.jumpTimer = 40; } }
        }
      }

      // enemy shooting (soldier, turret, flyer)
      if (e.type === 'soldier' || e.type === 'turret' || e.type === 'flyer') {
        e.shootTimer--;
        if (e.shootTimer <= 0 && e.x < camX + W && e.x > camX) {
          e.shootTimer = e.type === 'turret' ? 70 : 100;
          var dx = player.x - e.x, dy = (player.y - player.h / 2) - (e.y - e.h / 2);
          var d = Math.hypot(dx, dy) || 1;
          enemyBullets.push({ x: e.x, y: e.y - e.h / 2, vx: dx / d * 5, vy: dy / d * 5, size: 5, life: 140 });
          if (window.JungleStrikeSound) window.JungleStrikeSound.enemyShoot();
        }
      }

      // touch damage to player
      if (player.invuln <= 0 && Math.abs(e.x - player.x) < (e.w / 2 + player.w / 2) && Math.abs((e.y - e.h / 2) - (player.y - player.h / 2)) < (e.h / 2 + player.h / 2)) {
        playerDie();
      }

      // remove if far behind
      if (e.x < camX - 120) enemies.splice(i, 1);
    }
  }

  function updateBoss(st) {
    if (!boss) return;
    // enter from the right, then hold near the right edge
    if (!boss.entered) {
      boss.x -= 2.5;
      if (boss.x <= camX + W - 160) boss.entered = true;
    } else {
      boss.y = GROUND_Y; // ground boss
      boss.x += boss.moveDir * 0.7;
      if (boss.x > camX + W - 120) boss.moveDir = -1;
      if (boss.x < camX + W - 220) boss.moveDir = 1;
      boss.shootTimer--;
      if (boss.hit > 0) boss.hit--;
      if (boss.shootTimer <= 0) {
        boss.shootTimer = 34;
        boss.phase++;
        // fan of shots
        var n = 5;
        for (var i = 0; i < n; i++) {
          var ang = Math.PI - 0.6 + (i / (n - 1)) * 1.2 + Math.sin(boss.phase * 0.3) * 0.2;
          enemyBullets.push({ x: boss.x - boss.w / 2, y: boss.y - boss.h * 0.6, vx: Math.cos(ang) * 4.5, vy: Math.sin(ang) * 4.5, size: 6, life: 200 });
        }
        if (window.JungleStrikeSound) window.JungleStrikeSound.enemyShoot();
      }
      // boss body contact
      if (player.invuln <= 0 && player.x > boss.x - boss.w / 2 && player.x < boss.x + boss.w / 2 && player.y - player.h < boss.y && player.y > boss.y - boss.h) {
        playerDie();
      }
    }
  }

  function updateEnemyBullets() {
    for (var i = enemyBullets.length - 1; i >= 0; i--) {
      var b = enemyBullets[i];
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0 || b.x < camX - 40 || b.x > camX + W + 40 || b.y > H + 20 || b.y < -20) { enemyBullets.splice(i, 1); continue; }
      if (player.invuln <= 0) {
        var pcx = player.x, pcy = player.y - player.h / 2;
        var ph = player.ducking ? player.h * 0.5 : player.h;
        if (Math.abs(b.x - pcx) < player.w / 2 + b.size && b.y > player.y - ph && b.y < player.y) {
          enemyBullets.splice(i, 1); playerDie();
        }
      }
    }
  }

  function updatePowerups() {
    for (var i = powerups.length - 1; i >= 0; i--) {
      var p = powerups[i];
      p.vy += 0.4; p.y += p.vy; p.bob += 0.1; p.life--;
      if (p.y >= GROUND_Y - 10) { p.y = GROUND_Y - 10; p.vy = 0; }
      if (p.life <= 0 || p.x < camX - 60) { powerups.splice(i, 1); continue; }
      // pickup
      if (Math.abs(p.x - player.x) < 26 && Math.abs((p.y) - (player.y - player.h / 2)) < 40) {
        if (p.type === 'life') { lives = Math.min(9, lives + 1); }
        else { player.weapon = p.type; }
        score += 50;
        spawnExplosion(p.x, p.y, '#ffffff', 12);
        if (window.JungleStrikeSound) window.JungleStrikeSound.powerup();
        powerups.splice(i, 1);
      }
    }
  }

  function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function spawnExplosion(x, y, color, count) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2, s = Math.random() * 5 + 1;
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 26 + Math.random() * 16, color: color });
    }
  }
  // ---------- render ----------
  function render() {
    var st = STAGES[stageIndex] || STAGES[0];
    drawSky(st);
    drawProps(st);
    drawGround(st);

    // world-space entities (offset by camX)
    ctx.save();
    ctx.translate(-camX, 0);

    drawPowerups();
    drawPlatforms();
    drawEnemies();
    drawBoss();
    if (state === STATE.PLAY || state === STATE.STAGECLEAR) drawPlayer();
    drawBullets();
    drawParticles();

    ctx.restore();

    drawHUD(st);
    if (state === STATE.MENU) drawMenu();
    if (state === STATE.DEAD) drawDead();
    if (state === STATE.STAGECLEAR) drawStageClear(st);
    if (state === STATE.WIN) drawWin();
    if (isMobile()) drawTouchControls();
  }

  function drawSky(st) {
    var g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, st.sky[0]); g.addColorStop(0.6, st.sky[1]); g.addColorStop(1, st.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND_Y);
    // stage-specific sky feature
    if (st.name === 'JUNGLE') {
      // sun rays
      ctx.fillStyle = 'rgba(255,255,200,0.06)';
      for (var i = 0; i < 6; i++) { ctx.save(); ctx.translate(W * 0.7, 0); ctx.rotate(i * 0.2 - 0.5); ctx.fillRect(-30, 0, 60, GROUND_Y); ctx.restore(); }
    } else if (st.name === 'RIVER') {
      // distant water shimmer band
      ctx.fillStyle = 'rgba(120,200,240,0.15)';
      ctx.fillRect(0, GROUND_Y - 60, W, 60);
    } else if (st.name === 'CAVE') {
      // sparkles
      ctx.fillStyle = 'rgba(200,120,255,0.5)';
      for (var s = 0; s < 30; s++) { var sx = (s * 137 + frame * 0.2) % W; ctx.fillRect(sx, (s * 53) % (GROUND_Y - 40), 2, 2); }
    } else {
      // base: warning glow
      ctx.fillStyle = 'rgba(255,80,40,' + (0.08 + Math.sin(frame * 0.05) * 0.04) + ')';
      ctx.fillRect(0, 0, W, GROUND_Y);
    }
  }

  function drawProps(st) {
    for (var i = 0; i < props.length; i++) {
      var p = props[i];
      var par = p.layer === 0 ? 0.4 : 0.75;   // parallax factor
      var sx = p.x - camX * par;
      // wrap
      sx = ((sx % (st.length)) + st.length) % st.length;
      if (sx > W + 100) continue;
      drawProp(st.prop, sx, GROUND_Y, p.size, p.layer);
    }
  }
  function drawProp(kind, x, y, s, layer) {
    var alpha = layer === 0 ? 0.55 : 1;
    ctx.globalAlpha = alpha;
    if (kind === 'tree') {
      var h = 120 * s, w = 40 * s;
      ctx.fillStyle = '#2a1a0a'; ctx.fillRect(x - w * 0.1, y - h * 0.5, w * 0.2, h * 0.5);
      ctx.fillStyle = layer === 0 ? '#2d5a3a' : '#3a7d40';
      for (var c = 0; c < 3; c++) { ctx.beginPath(); ctx.arc(x, y - h * (0.5 + c * 0.18), w * (0.8 - c * 0.15), 0, Math.PI * 2); ctx.fill(); }
    } else if (kind === 'reed') {
      ctx.strokeStyle = layer === 0 ? '#3a6a4a' : '#5aaa6a'; ctx.lineWidth = 3 * s;
      for (var r = 0; r < 4; r++) { ctx.beginPath(); ctx.moveTo(x + r * 6, y); ctx.quadraticCurveTo(x + r * 6 + 8, y - 40 * s, x + r * 6 + 4, y - 70 * s); ctx.stroke(); }
    } else if (kind === 'crystal') {
      ctx.fillStyle = layer === 0 ? '#5a3a7a' : '#a060d0';
      ctx.beginPath(); ctx.moveTo(x, y - 90 * s); ctx.lineTo(x - 14 * s, y); ctx.lineTo(x + 14 * s, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(x, y - 90 * s); ctx.lineTo(x + 4 * s, y - 40 * s); ctx.lineTo(x + 14 * s, y); ctx.closePath(); ctx.fill();
    } else { // pipe (base)
      ctx.fillStyle = layer === 0 ? '#3a3038' : '#5a4a52';
      ctx.fillRect(x - 12 * s, y - 100 * s, 24 * s, 100 * s);
      ctx.fillStyle = '#2a2028'; ctx.fillRect(x - 16 * s, y - 100 * s, 32 * s, 12 * s);
    }
    ctx.globalAlpha = 1;
  }

  function drawGround(st) {
    ctx.fillStyle = st.ground; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = st.groundTop; ctx.fillRect(0, GROUND_Y, W, 8);
    // scrolling texture chunks
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    var off = camX % 60;
    for (var x = -off; x < W; x += 60) ctx.fillRect(x, GROUND_Y + 20, 30, 6);
  }

  function drawPlayer() {
    if (player.invuln > 0 && Math.floor(frame / 4) % 2 === 0) return; // blink
    var x = player.x, y = player.y, f = player.facing;
    var h = player.ducking ? player.h * 0.6 : player.h;
    ctx.save();
    // body (commando - olive/tan)
    ctx.fillStyle = '#5a6a3a';
    ctx.fillRect(x - player.w / 2, y - h, player.w, h - 12);
    // head + bandana
    ctx.fillStyle = '#c9a06a'; ctx.fillRect(x - 7, y - h - 12, 14, 14);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(x - 8, y - h - 6, 16, 4);
    // legs (animate)
    ctx.fillStyle = '#3a4a2a';
    var lp = Math.sin(player.walkPhase) * 5;
    if (player.onGround && !player.ducking) {
      ctx.fillRect(x - 8, y - 12, 6, 12 + lp);
      ctx.fillRect(x + 2, y - 12, 6, 12 - lp);
    } else { ctx.fillRect(x - 8, y - 12, 6, 12); ctx.fillRect(x + 2, y - 12, 6, 12); }
    // gun + aim
    ctx.fillStyle = '#222';
    var gy = y - h + 16;
    if (player.aimUp && !(keys['ArrowLeft']||keys['ArrowRight']||touch.left||touch.right)) {
      ctx.fillRect(x - 3, y - h - 18, 6, 20);
    } else if (player.aimUp) {
      ctx.save(); ctx.translate(x, gy); ctx.rotate(-0.78 * f); ctx.fillRect(0, -3, 22 * f, 6); ctx.restore();
    } else if (player.aimDown && !player.onGround) {
      ctx.fillRect(x - 3, gy, 6, 20);
    } else {
      ctx.fillRect(f > 0 ? x : x - 22, gy - 3, 22, 6);
    }
    ctx.restore();
  }

  function drawEnemies() {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      ctx.save();
      var flash = e.hit > 0;
      if (e.type === 'soldier') {
        ctx.fillStyle = flash ? '#fff' : '#7a3a3a';
        ctx.fillRect(e.x - e.w / 2, e.y - e.h, e.w, e.h - 10);
        ctx.fillStyle = flash ? '#fff' : '#c9a06a'; ctx.fillRect(e.x - 6, e.y - e.h - 10, 12, 12);
        ctx.fillStyle = '#222'; ctx.fillRect(e.x - e.w / 2 - 8, e.y - e.h + 14, 12, 4);
      } else if (e.type === 'runner') {
        ctx.fillStyle = flash ? '#fff' : '#b0602a';
        ctx.fillRect(e.x - e.w / 2, e.y - e.h, e.w, e.h - 8);
        ctx.fillStyle = '#222'; var rl = Math.sin(frame * 0.4) * 5;
        ctx.fillRect(e.x - 7, e.y - 8, 5, 8 + rl); ctx.fillRect(e.x + 2, e.y - 8, 5, 8 - rl);
      } else if (e.type === 'jumper') {
        ctx.fillStyle = flash ? '#fff' : '#3a7a5a';
        ctx.fillRect(e.x - e.w / 2, e.y - e.h, e.w, e.h);
        ctx.fillStyle = '#1a3a2a'; ctx.fillRect(e.x - 8, e.y - e.h + 6, 16, 6);
      } else if (e.type === 'turret') {
        ctx.fillStyle = flash ? '#fff' : '#555';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.w / 2, Math.PI, 0); ctx.fill();
        ctx.fillRect(e.x - e.w / 2, e.y - 2, e.w, e.h / 2);
        ctx.fillStyle = '#222';
        var adx = player.x - e.x, ady = (player.y - 20) - e.y, aa = Math.atan2(ady, adx);
        ctx.save(); ctx.translate(e.x, e.y - 4); ctx.rotate(aa); ctx.fillRect(0, -4, 26, 8); ctx.restore();
      } else if (e.type === 'flyer') {
        ctx.fillStyle = flash ? '#fff' : '#6a4a8a';
        ctx.beginPath(); ctx.ellipse(e.x, e.y, e.w / 2, e.h / 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c060ff'; ctx.fillRect(e.x - 4, e.y - 2, 8, 4);
        ctx.fillStyle = 'rgba(150,100,220,0.4)'; var wob = Math.sin(frame * 0.5) * 6;
        ctx.fillRect(e.x - e.w / 2 - 8, e.y - 2 + wob, 8, 4); ctx.fillRect(e.x + e.w / 2, e.y - 2 - wob, 8, 4);
      }
      ctx.restore();
    }
  }

  function drawBoss() {
    if (!boss) return;
    var b = boss, flash = b.hit > 0;
    ctx.save();
    var st = STAGES[stageIndex];
    // big mech/creature body themed to stage accent
    ctx.fillStyle = flash ? '#fff' : '#444';
    ctx.fillRect(b.x - b.w / 2, b.y - b.h, b.w, b.h);
    ctx.fillStyle = flash ? '#fff' : st.accent;
    ctx.fillRect(b.x - b.w / 2 + 10, b.y - b.h + 14, b.w - 20, 24); // eye band
    ctx.fillStyle = '#111';
    ctx.fillRect(b.x - b.w / 2 - 14, b.y - b.h * 0.7, 20, 30);      // cannon
    ctx.fillRect(b.x + b.w / 2 - 6, b.y - b.h * 0.9, 14, 40);       // leg
    ctx.fillRect(b.x - b.w / 2 - 2, b.y - b.h * 0.9, 14, 40);
    // health bar above
    var bw = b.w + 20, hp = Math.max(0, b.hp / b.maxHp);
    ctx.fillStyle = '#300'; ctx.fillRect(b.x - bw / 2, b.y - b.h - 20, bw, 8);
    ctx.fillStyle = '#ff3040'; ctx.fillRect(b.x - bw / 2, b.y - b.h - 20, bw * hp, 8);
    ctx.restore();
  }

  function drawBullets() {
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 8;
      ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
    }
    ctx.shadowBlur = 0;
    for (var j = 0; j < enemyBullets.length; j++) {
      var eb = enemyBullets[j];
      ctx.fillStyle = '#ff5a5a'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(eb.x, eb.y, eb.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawPlatforms() {
    var st = STAGES[stageIndex];
    for (var i = 0; i < platforms.length; i++) {
      var pf = platforms[i];
      if (pf.x + pf.w < camX - 20 || pf.x > camX + W + 20) continue;
      var h = 18;
      // themed platform: top surface = groundTop color, body = ground color
      ctx.fillStyle = st.ground;
      ctx.fillRect(pf.x, pf.y, pf.w, h);
      ctx.fillStyle = st.groundTop;
      ctx.fillRect(pf.x, pf.y, pf.w, 5);
      // accent edge + supports so it reads as a ledge
      ctx.fillStyle = st.accent;
      ctx.fillRect(pf.x, pf.y, 4, h);
      ctx.fillRect(pf.x + pf.w - 4, pf.y, 4, h);
      // stage-flavored underside detail
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      if (st.prop === 'crystal') { for (var c = 0; c < pf.w; c += 24) { ctx.beginPath(); ctx.moveTo(pf.x + c, pf.y + h); ctx.lineTo(pf.x + c + 6, pf.y + h + 10); ctx.lineTo(pf.x + c + 12, pf.y + h); ctx.closePath(); ctx.fill(); } }
      else ctx.fillRect(pf.x + 6, pf.y + h, pf.w - 12, 4);
    }
  }

  function drawPowerups() {
    for (var i = 0; i < powerups.length; i++) {
      var p = powerups[i];
      var yy = p.y + Math.sin(p.bob) * 3;
      ctx.save();
      ctx.fillStyle = p.type === 'life' ? '#ff4d6d' : '#111';
      ctx.fillRect(p.x - p.w / 2, yy - p.h / 2, p.w, p.h);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(p.x - p.w / 2, yy - p.h / 2, p.w, p.h);
      ctx.fillStyle = '#fff'; ctx.font = "bold 15px monospace"; ctx.textAlign = 'center';
      ctx.fillText(p.type === 'life' ? '+1' : p.type, p.x, yy + 5);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(0, p.life / 40);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD(st) {
    ctx.fillStyle = '#fff'; ctx.font = "20px monospace"; ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + score, 16, 28);
    // lives
    ctx.fillStyle = '#ff4d6d';
    for (var i = 0; i < lives; i++) ctx.fillText('\u2665', 16 + i * 22, 52);
    // weapon
    ctx.textAlign = 'center'; ctx.fillStyle = WEAPONS[player.weapon].color;
    ctx.fillText('[' + WEAPONS[player.weapon].name + ']', W / 2, 28);
    // stage name + progress
    ctx.textAlign = 'right'; ctx.fillStyle = st.accent;
    ctx.fillText('STAGE ' + (stageIndex + 1) + ': ' + st.name, W - 16, 28);
    // progress bar
    var prog = Math.min(1, stageDist / (st.length - W));
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(W - 216, 40, 200, 8);
    ctx.fillStyle = st.accent; ctx.fillRect(W - 216, 40, 200 * prog, 8);
    ctx.textAlign = 'left';
  }

  function dim() { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H); }
  function drawMenu() {
    dim(); ctx.textAlign = 'center';
    ctx.fillStyle = '#6ab04c'; ctx.shadowColor = '#2d5a3a'; ctx.shadowBlur = 20;
    ctx.font = "52px monospace"; ctx.fillText('JUNGLE STRIKE', W / 2, H / 2 - 40);
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = "18px monospace";
    ctx.fillText('\u2190 \u2192 move   \u2191 aim up   \u2193 duck/aim   SPACE jump   Z fire', W / 2, H / 2 + 6);
    ctx.fillText('Grab S / M / L crates to upgrade your weapon', W / 2, H / 2 + 30);
    ctx.fillStyle = '#ffcc33';
    if (Math.floor(frame / 30) % 2 === 0) ctx.fillText('PRESS SPACE TO START', W / 2, H / 2 + 64);
    ctx.textAlign = 'left';
  }
  function drawDead() {
    dim(); ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 16;
    ctx.font = "48px monospace"; ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = "24px monospace";
    ctx.fillText('SCORE ' + score, W / 2, H / 2 + 26);
    ctx.fillStyle = '#ffcc33'; ctx.font = "18px monospace";
    if (Date.now() - overAt > 800 && Math.floor(frame / 30) % 2 === 0) ctx.fillText('SPACE TO RETRY', W / 2, H / 2 + 56);
    ctx.textAlign = 'left';
  }
  function drawStageClear(st) {
    dim(); ctx.textAlign = 'center';
    ctx.fillStyle = st.accent; ctx.font = "44px monospace"; ctx.fillText(st.name + ' CLEARED!', W / 2, H / 2 - 6);
    ctx.fillStyle = '#fff'; ctx.font = "22px monospace"; ctx.fillText('+2000', W / 2, H / 2 + 30);
    ctx.textAlign = 'left';
  }
  function drawWin() {
    dim(); ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcc33'; ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 20;
    ctx.font = "46px monospace"; ctx.fillText('MISSION COMPLETE', W / 2, H / 2 - 20);
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = "24px monospace";
    ctx.fillText('FINAL SCORE ' + score, W / 2, H / 2 + 20);
    ctx.fillStyle = '#ffcc33'; ctx.font = "18px monospace";
    if (Date.now() - overAt > 800 && Math.floor(frame / 30) % 2 === 0) ctx.fillText('SPACE TO PLAY AGAIN', W / 2, H / 2 + 54);
    ctx.textAlign = 'left';
  }

  function isMobile() { return ('ontouchstart' in window) || navigator.maxTouchPoints > 0; }
  function drawTouchControls() {
    if (state !== STATE.PLAY) return;
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#fff';
    // dpad hint
    ctx.fillRect(20, H - 70, 40, 40); ctx.fillRect(70, H - 70, 40, 40);
    // fire/jump
    ctx.fillRect(W - 70, H - 70, 46, 46); ctx.fillRect(W - 150, H - 60, 40, 40);
    ctx.globalAlpha = 0.8; ctx.fillStyle = '#000'; ctx.font = "14px monospace"; ctx.textAlign = 'center';
    ctx.fillText('<', 40, H - 44); ctx.fillText('>', 90, H - 44);
    ctx.fillText('FIRE', W - 47, H - 44); ctx.fillText('JMP', W - 130, H - 38);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }

  // expose score for the bridge
  window.JungleStrike = { getScore: function () { return Math.floor(score); }, getStage: function () { return stageIndex + 1; } };

  // ---------- loop ----------
  function loop() { update(); render(); requestAnimationFrame(loop); }
  loop();
})();
