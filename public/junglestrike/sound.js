// Jungle Strike procedural WebAudio (no asset files). Weapon fire, jumps,
// explosions, powerups, and a simple per-stage music loop.
(function () {
  var ctx = null, master = null, musicTimer = null, muted = false, curStage = 0;
  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.4; master.connect(ctx.destination);
  }
  function blip(freq, dur, type, vol, sweepTo) {
    if (!ctx || muted) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + dur);
    g.gain.value = vol || 0.2; g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }
  function noise(dur, vol, lp) {
    if (!ctx || muted) return;
    var buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
    var s = ctx.createBufferSource(); s.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1000;
    var g = ctx.createGain(); g.gain.value = vol || 0.3;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  }

  var api = {
    ensure: ensure,
    resume: function () { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    shoot: function (w) {
      ensure();
      if (w === 'L') blip(900, 0.12, 'sawtooth', 0.18, 300);
      else if (w === 'M') blip(700, 0.05, 'square', 0.12, 500);
      else if (w === 'S') { blip(600, 0.08, 'square', 0.12, 400); blip(500, 0.08, 'square', 0.1, 350); }
      else blip(800, 0.07, 'square', 0.15, 400);
    },
    jump: function () { blip(300, 0.15, 'sine', 0.2, 600); },
    explode: function () { noise(0.35, 0.4, 800); blip(120, 0.3, 'sawtooth', 0.15, 40); },
    enemyShoot: function () { blip(300, 0.08, 'square', 0.08, 200); },
    playerHit: function () { noise(0.5, 0.4, 500); blip(200, 0.4, 'sawtooth', 0.2, 50); },
    powerup: function () { blip(500, 0.1, 'square', 0.2, 800); blip(800, 0.1, 'square', 0.2, 1200); },
    boss: function () { blip(80, 0.6, 'sawtooth', 0.25, 200); },
    startMusic: function (stage) {
      ensure(); curStage = stage || 0;
      if (musicTimer) return;
      // per-stage bassline (different root notes give each stage a mood)
      var roots = [ [98, 110, 87.3, 98], [82.4, 98, 73.4, 82.4], [65.4, 73.4, 61.7, 65.4], [110, 130.8, 98, 110] ];
      var step = 0, beat = 0.28;
      var mg = ctx.createGain(); mg.gain.value = 0.08; mg.connect(master);
      musicTimer = setInterval(function () {
        if (muted) return;
        var seq = roots[curStage % roots.length];
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = seq[step % seq.length];
        var now = ctx.currentTime;
        g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.5, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + beat * 0.9);
        o.connect(g); g.connect(mg); o.start(now); o.stop(now + beat); step++;
      }, beat * 1000);
    },
    toggleMute: function () { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.4; return muted; }
  };
  window.JungleStrikeSound = api;
})();
