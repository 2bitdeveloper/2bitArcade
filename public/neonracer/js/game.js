class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
        
        this.input = new Input();
        this.road = new Road();
        this.car = new Car();
        this.traffic = new Traffic(this); // 2bitArcade: traffic + lives + collision
        
        this.lastTime = 0;
        this.playing = false;
        // difficulty: easy=1.0, medium=1.5 (+50%), hard=2.0 (+100%)
        this.difficultyMult = 1;
        this.difficultyIndex = 0;   // 0 easy, 1 medium, 2 hard
        this.difficultyNames = ['EASY', 'MEDIUM', 'HARD'];
        this.difficultyMults = [1, 1.5, 2];
        this.setupDifficultyInput();
        
        // UI Elements
        this.elements = {
            speed: document.getElementById('speed-display'),
            dist: document.getElementById('dist-display'),
            startScreen: document.getElementById('start-screen'),
            ui: document.getElementById('ui-layer')
        };

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
    }

    setupDifficultyInput() {
        window.addEventListener('keydown', (e) => {
            if (this.playing) return;   // only on the menu
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') { this.difficultyIndex = (this.difficultyIndex + 2) % 3; }
            if (e.code === 'ArrowRight' || e.code === 'KeyD') { this.difficultyIndex = (this.difficultyIndex + 1) % 3; }
            if (e.code === 'Digit1') this.difficultyIndex = 0;
            if (e.code === 'Digit2') this.difficultyIndex = 1;
            if (e.code === 'Digit3') this.difficultyIndex = 2;
        });
        // tap left/right thirds on the menu to change difficulty (mobile)
        this.canvas.addEventListener('pointerdown', (e) => {
            if (this.playing) return;
            const x = e.clientX / window.innerWidth;
            if (x < 0.33) this.difficultyIndex = (this.difficultyIndex + 2) % 3;
            else if (x > 0.66) this.difficultyIndex = (this.difficultyIndex + 1) % 3;
        });
    }

    start() {
        this.playing = true;
        this.difficultyMult = this.difficultyMults[this.difficultyIndex];
        if (this.elements.startScreen) this.elements.startScreen.classList.add('hidden');
        this.road.reset();
        this.traffic.reset();               // 2bitArcade
        this.car.speed = 0;
        this.car.x = 0;
        this.car.z = 0;
        if (window.NeonRacerBridge) window.NeonRacerBridge.onStart();
        if (window.NeonRacerSound) { window.NeonRacerSound.resume(); window.NeonRacerSound.startEngine(); window.NeonRacerSound.startMusic(); }
    }

    update(dt) {
        if (!this.playing) {
            // start OR restart-after-wreck via the accelerate key
            if (this.input.start || this.input.throttle) {
                this.start();
            }
            return;
        }

        this.car.update(this.input, dt);
        this.traffic.update(dt);            // 2bitArcade: collision may end the run
        if (window.NeonRacerSound) window.NeonRacerSound.updateEngine(this.car.speed, CAR.maxSpeed);

        // Update UI (guard: elements may be absent on the arcade page)
        if (this.elements.speed) this.elements.speed.innerText = Math.floor(this.car.speed / 100);
        if (this.elements.dist) this.elements.dist.innerText = Math.floor(this.car.z / 1000);
    }

    render() {
        // Clear background
        this.ctx.fillStyle = COLORS.sky;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw Sun/Moon or Horizon logic could go here
        
        // Render Road
        // We pass the car's Z position to the road to handle the scrolling loop
        this.road.render(this.ctx, this.car.z, this.car.x, this.width, this.height);

        // Render traffic (2bitArcade) between road and player car
        this.traffic.render(this.ctx, this.width, this.height);

        // Render Car
        this.car.render(this.ctx, this.width, this.height);

        // Difficulty selector on the menu (when not playing and not wrecked mid-run)
        if (!this.playing && !(this.traffic && this.traffic.gameOver)) {
            this.drawDifficultyMenu();
        }
    }

    drawDifficultyMenu() {
        const ctx = this.ctx, cx = this.width / 2, cy = this.height / 2;
        ctx.save();
        ctx.fillStyle = 'rgba(5,2,15,0.72)';
        ctx.fillRect(0, cy - 130, this.width, 260);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff2d95'; ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 18;
        ctx.font = "52px 'VT323', monospace";
        ctx.fillText('NEON NIGHT RACER', cx, cy - 70);
        ctx.shadowBlur = 0;
        // difficulty pills
        ctx.font = "30px 'VT323', monospace";
        const names = this.difficultyNames;
        const spacing = 200;
        for (let i = 0; i < names.length; i++) {
            const px = cx + (i - 1) * spacing;
            const sel = i === this.difficultyIndex;
            ctx.fillStyle = sel ? '#00e6ff' : 'rgba(255,255,255,0.25)';
            if (sel) { ctx.shadowColor = '#00e6ff'; ctx.shadowBlur = 14; }
            ctx.fillText(names[i], px, cy);
            ctx.shadowBlur = 0;
            const pct = ['', ' +50%', ' +100%'][i];
            if (sel && pct) { ctx.font = "18px 'VT323', monospace"; ctx.fillStyle = '#aaa'; ctx.fillText(pct.trim(), px, cy + 26); ctx.font = "30px 'VT323', monospace"; }
        }
        ctx.fillStyle = '#888'; ctx.font = "18px 'VT323', monospace";
        ctx.fillText('\u2190 \u2192 or 1/2/3 to choose difficulty', cx, cy + 66);
        ctx.fillStyle = '#ffde59';
        if (Math.floor(Date.now() / 500) % 2 === 0) ctx.fillText('PRESS ACCELERATE TO RACE', cx, cy + 98);
        ctx.textAlign = 'left';
        ctx.restore();
    }

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(dt);
        this.render();

        requestAnimationFrame(this.loop);
    }
}

// Start the game instance
window.onload = () => {
    const game = new Game();
    window.game = game; // 2bitArcade: expose instance for leaderboard bridge
};
