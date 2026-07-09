// Sunset Drift procedural WebAudio (no asset files). Engine tone rises
// with speed; crash burst on contact; a mellow synthwave bassline loop.
(function () {
  var ctx = null, master = null, engineOsc = null, engineGain = null, musicOn = false, muted = false;
  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  }
  function startEngine() {
    ensure(); if (engineOsc) return;
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
    engineOsc.frequency.value = 55; engineOsc.start();
  }
  function updateEngine(speed, max) {
    if (!engineOsc || muted) { if (engineGain) engineGain.gain.value = 0; return; }
    var t = Math.max(0, Math.min(1, speed / max));
    engineOsc.frequency.setTargetAtTime(50 + t * 150, ctx.currentTime, 0.05);
    engineGain.gain.setTargetAtTime(0.04 + t * 0.09, ctx.currentTime, 0.1);
  }
  function crash() {
    if (!ctx || muted) return;
    var dur = 0.4, buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
    var s = ctx.createBufferSource(); s.buffer = buf;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
    var g = ctx.createGain(); g.gain.value = 0.5;
    s.connect(lp); lp.connect(g); g.connect(master); s.start();
  }
  function gameOver() {
    if (!ctx || muted) return;
    var o = ctx.createOscillator(); o.type = 'triangle';
    var g = ctx.createGain(); g.gain.value = 0.2; o.connect(g); g.connect(master);
    o.frequency.setValueAtTime(400, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    o.start(); o.stop(ctx.currentTime + 0.75);
  }
  function startMusic() {
    ensure(); if (musicOn) return; musicOn = true;
    var notes = [98, 98, 130.8, 116.5, 98, 87.3, 130.8, 116.5];
    var step = 0, beat = 0.5;
    var mg = ctx.createGain(); mg.gain.value = 0.10; mg.connect(master);
    setInterval(function () {
      if (!musicOn || muted) return;
      var o = ctx.createOscillator(); o.type = 'triangle';
      var g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(mg);
      o.frequency.value = notes[step % notes.length];
      var now = ctx.currentTime;
      g.gain.linearRampToValueAtTime(0.5, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + beat * 0.9);
      o.start(now); o.stop(now + beat); step++;
    }, beat * 1000);
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; }
  window.SunsetDriftSound = { startEngine: startEngine, updateEngine: updateEngine, crash: crash, gameOver: gameOver, startMusic: startMusic, resume: resume, toggleMute: toggleMute, ensure: ensure };
})();
