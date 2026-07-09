// ============================================================
// NEON RACER SOUND  (2bitArcade) - procedural WebAudio, no assets.
// Engine tone rises with speed, traffic whoosh on near-passes,
// crash noise burst, and a looping synthwave-ish bassline.
// All generated in-browser (no copyrighted audio files).
// ============================================================
(function () {
    let ctx = null, master = null, engineOsc = null, engineGain = null, musicNodes = [], musicOn = false, muted = false;

    function ensure() {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    }

    function startEngine() {
        ensure();
        if (engineOsc) return;
        engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 800;
        engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(master);
        engineOsc.frequency.value = 60;
        engineOsc.start();
    }

    function updateEngine(speed, maxSpeed) {
        if (!engineOsc || muted) { if (engineGain) engineGain.gain.value = 0; return; }
        const t = Math.max(0, Math.min(1, speed / maxSpeed));
        engineOsc.frequency.setTargetAtTime(55 + t * 160, ctx.currentTime, 0.05);
        engineGain.gain.setTargetAtTime(0.04 + t * 0.10, ctx.currentTime, 0.1);
    }

    function whoosh() {
        if (!ctx || muted) return;
        const dur = 0.35;
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.5;
        const g = ctx.createGain(); g.gain.value = 0.25;
        src.connect(bp); bp.connect(g); g.connect(master);
        bp.frequency.setValueAtTime(1800, ctx.currentTime);
        bp.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + dur);
        src.start();
    }

    function crash() {
        if (!ctx || muted) return;
        const dur = 0.5;
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const g = ctx.createGain(); g.gain.value = 0.6;
        src.connect(lp); lp.connect(g); g.connect(master);
        src.start();
    }

    function gameOver() {
        if (!ctx || muted) return;
        const o = ctx.createOscillator(); o.type = 'square';
        const g = ctx.createGain(); g.gain.value = 0.2;
        o.connect(g); g.connect(master);
        o.frequency.setValueAtTime(300, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.8);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        o.start(); o.stop(ctx.currentTime + 0.85);
    }

    // simple looping synthwave bassline
    function startMusic() {
        ensure();
        if (musicOn) return; musicOn = true;
        const notes = [55, 55, 82.4, 73.4, 65.4, 65.4, 98, 82.4]; // A1-ish progression
        let step = 0;
        const bpm = 120, beat = 60 / bpm;
        const musicGain = ctx.createGain(); musicGain.gain.value = 0.12; musicGain.connect(master);
        const timer = setInterval(() => {
            if (!musicOn || muted) return;
            const o = ctx.createOscillator(); o.type = 'triangle';
            const g = ctx.createGain(); g.gain.value = 0.0;
            o.connect(g); g.connect(musicGain);
            o.frequency.value = notes[step % notes.length];
            const now = ctx.currentTime;
            g.gain.linearRampToValueAtTime(0.5, now + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, now + beat * 0.9);
            o.start(now); o.stop(now + beat);
            step++;
        }, beat * 1000);
        musicNodes.push({ timer, musicGain });
    }

    function toggleMute() {
        muted = !muted;
        if (master) master.gain.value = muted ? 0 : 0.5;
        return muted;
    }
    function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

    window.NeonRacerSound = {
        startEngine, updateEngine, whoosh, crash, gameOver, startMusic, toggleMute, resume, ensure
    };
})();
