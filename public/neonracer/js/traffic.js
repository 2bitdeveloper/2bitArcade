// ============================================================
// TRAFFIC + LIVES + COLLISION  (2bitArcade addition to Neon Night Racer)
// Road Fighter / Spy Hunter feel: dodge lane traffic of varied types.
// - Traffic is capped at the PLAYER's on-screen size (never larger).
// - Collision is a real geometry check in the same road-x space.
// - Variety: sedan, truck, sports, bike - different widths + colors.
// 3 lives; a hit slows you 50% and glitches the struck vehicle out.
// Renders with the SAME projection as the road so cars stay in-world.
// ============================================================
class Traffic {
    constructor(game) {
        this.game = game;
        this.vehicles = [];
        this.lives = 3;
        this.crashFlash = 0;
        this.gameOver = false;
        this.spawnCooldown = 60;
        this.types = {
            sedan:  { halfX: 0.11, drawW: 90,  palette: ['#00e6ff', '#ff2d95', '#ffcc33', '#7cff5a'] },
            sports: { halfX: 0.10, drawW: 84,  palette: ['#ff5a3c', '#c840ff', '#39ff88'] },
            truck:  { halfX: 0.15, drawW: 120, palette: ['#e0e0e0', '#ffaa33', '#88aaff'] },
            bike:   { halfX: 0.05, drawW: 40,  palette: ['#ffffff', '#ff2d95'] }
        };
        this.reset();
    }

    reset() {
        this.vehicles = [];
        this.lives = 3;
        this.crashFlash = 0;
        this.gameOver = false;
        this.spawnCooldown = 60;
    }

    difficulty() {
        const km = this.game.car.z / 1000;
        const ramp = Math.min(1, km / 8000);
        // difficulty multiplier: easy=1.0, medium=1.5 (+50%), hard=2.0 (+100%)
        const m = this.game.difficultyMult || 1;
        // more cars, tighter gaps, faster traffic as m rises
        return {
            gap: (150 - 90 * ramp) / m,                       // tighter spacing
            speedLo: (1000 + 700 * ramp) * (0.85 + 0.15 * m), // faster floor
            speedHi: (2200 + 1200 * ramp) * (0.85 + 0.15 * m),
            maxCars: Math.floor((4 + 8 * ramp) * m)           // more cars on screen
        };
    }

    randomType() {
        const r = Math.random();
        if (r < 0.45) return 'sedan';
        if (r < 0.72) return 'sports';
        if (r < 0.9) return 'truck';
        return 'bike';
    }

    update(dt) {
        if (this.gameOver || !this.game.playing) return;
        const car = this.game.car;
        if (this.crashFlash > 0) this.crashFlash -= dt;

        const diff = this.difficulty();

        this.spawnCooldown -= car.speed * dt * 0.02;
        if (this.spawnCooldown <= 0 && this.vehicles.length < diff.maxCars) {
            this.spawnCooldown = diff.gap + Math.random() * 60;
            const lane = Math.floor(Math.random() * 3) - 1;
            const laneX = lane * 0.6;
            const zAhead = car.z + 5000 + Math.random() * 4000;
            const clash = this.vehicles.some(v => Math.abs(v.x - laneX) < 0.3 && Math.abs(v.z - zAhead) < 900);
            if (!clash) {
                const typeName = this.randomType();
                const t = this.types[typeName];
                this.vehicles.push({
                    x: laneX,
                    z: zAhead,
                    speed: diff.speedLo + Math.random() * (diff.speedHi - diff.speedLo),
                    type: typeName,
                    halfX: t.halfX,
                    drawW: t.drawW,
                    color: t.palette[Math.floor(Math.random() * t.palette.length)]
                });
            }
        }

        // The player SPRITE is drawn ~150px off the bottom, which corresponds
        // to a point ~2000 world units (10 segments) ahead of the camera - NOT
        // at the camera itself. Collision must be centered there so a crash
        // lines up with where the player car visually sits.
        const PLAYER_HALF_X = 0.11;
        const PLAYER_Z_OFFSET = 2000;                 // where the player sprite sits, in Z
        const CAR_LEN_Z = ROAD.segmentLength * 1.5;   // ~300 units tolerance
        for (let i = this.vehicles.length - 1; i >= 0; i--) {
            const v = this.vehicles[i];
            const prevDz = v.z - car.z;
            v.z += v.speed * dt;
            const newDz = v.z - car.z;

            if (prevDz > 0 && newDz <= 300 && !v.whooshed) {
                v.whooshed = true;
                if (window.NeonRacerSound) window.NeonRacerSound.whoosh();
            }

            if (v.wrecked) {
                v.wreckTime -= dt;
                v.spin = (v.spin || 0) + dt * 12;
                v.x += (v.wreckDir || 0) * dt * 0.4;
                if (v.wreckTime <= 0) { this.vehicles.splice(i, 1); continue; }
            }

            if (v.z < car.z - 1500) { this.vehicles.splice(i, 1); continue; }

            if (!v.wrecked && this.crashFlash <= 0) {
                // distance from the PLAYER SPRITE position, not the camera
                const dz = (v.z - car.z) - PLAYER_Z_OFFSET;
                const touchX = PLAYER_HALF_X + v.halfX;
                if (Math.abs(dz) < CAR_LEN_Z && Math.abs(v.x - car.x) < touchX) {
                    this.crash(v);
                }
            }
        }

        if (this.crashFlash <= 0 && (car.x < -1 || car.x > 1)) this.crash(null);
    }

    crash(hitVehicle) {
        this.lives--;
        this.crashFlash = 1.4;
        this.game.car.speed *= 0.5;
        if (hitVehicle) {
            hitVehicle.wrecked = true;
            hitVehicle.wreckTime = 1.2;
            hitVehicle.wreckDir = hitVehicle.x >= 0 ? 1 : -1;
            hitVehicle.speed *= 0.2;
            hitVehicle.whooshed = true;
        }
        if (window.NeonRacerSound) window.NeonRacerSound.crash();
        if (navigator.vibrate) { try { navigator.vibrate(120); } catch (e) {} }
        if (this.lives <= 0) {
            this.lives = 0;
            this.gameOver = true;
            this.game.playing = false;
            if (window.NeonRacerBridge) window.NeonRacerBridge.onGameOver();
            if (window.NeonRacerSound) window.NeonRacerSound.gameOver();
        }
    }

    render(ctx, width, height) {
        const car = this.game.car;
        const road = this.game.road;
        const cameraDepth = 1 / Math.tan((CAM.fov / 2) * Math.PI / 180);
        const cameraX = car.x * road.width;
        const cameraZ = car.z;

        const sorted = this.vehicles.slice().sort((a, b) => b.z - a.z);
        for (const v of sorted) {
            const camZ = v.z - cameraZ;
            if (camZ <= cameraDepth * 0.5) continue;
            const scale = cameraDepth / camZ;
            const worldX = v.x * road.width;
            const sx = Math.round((width / 2) + (scale * (worldX - cameraX) * width / 2));
            const sy = Math.round((height / 2) - (scale * (-CAM.elevation) * height / 2));

            // Size opponents to the PROJECTED ROAD WIDTH at their depth - the
            // same quantity the road itself uses - so they scale exactly like
            // the road and reach ~player size right at the player's bumper.
            // Road half-width in px here = scale * road.width * width/2.
            // A car spans ~0.34 of a lane-ish; tuned so a car at the player's
            // depth (~2000 units) matches the player's ~90px sprite.
            const roadHalfPx = scale * road.width * (width / 2);
            const carPx = roadHalfPx * 0.19;           // car body width in px (tuned so a car at the bumper ~= player size)
            const rel = carPx / 90;                    // 90px = native sprite width
            if (rel < 0.05) continue;                  // too far to see

            if (sy < -80 || sy > height + 80) continue;
            if (v.wrecked && Math.floor(this.game.car.z + camZ) % 3 === 0) continue;
            this.drawVehicle(ctx, sx, sy, rel, v);
        }

        if (this.crashFlash > 1.1) {
            ctx.fillStyle = 'rgba(255,40,60,' + (this.crashFlash - 1.1) * 0.7 + ')';
            ctx.fillRect(0, 0, width, height);
        }
        this.drawHUD(ctx, width, height);
    }

    drawVehicle(ctx, x, y, rel, v) {
        const s = rel * (v.drawW / 90);
        ctx.save();
        ctx.translate(x, y);
        if (v.spin) ctx.rotate(v.spin);
        ctx.scale(s, s);
        const body = v.wrecked ? (Math.random() < 0.5 ? '#ff2222' : '#ffffff') : v.color;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(0, 10, 50, 20, 0, 0, Math.PI * 2); ctx.fill();

        if (v.type === 'bike') {
            ctx.fillStyle = body;
            ctx.fillRect(-8, -46, 16, 46);
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-6, -40, 12, 16);
            ctx.fillStyle = '#ff3333'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 10;
            ctx.fillRect(-6, -8, 12, 6); ctx.shadowBlur = 0;
        } else if (v.type === 'truck') {
            ctx.fillStyle = body;
            ctx.fillRect(-46, -70, 92, 70);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-40, -64, 80, 30);
            ctx.fillStyle = '#ff3333'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 10;
            ctx.fillRect(-42, -14, 20, 10); ctx.fillRect(22, -14, 20, 10); ctx.shadowBlur = 0;
            ctx.fillStyle = '#111'; ctx.fillRect(-52, -20, 12, 22); ctx.fillRect(40, -20, 12, 22);
        } else {
            const roofNarrow = v.type === 'sports' ? 0.24 : 0.3;
            ctx.fillStyle = body;
            ctx.beginPath();
            ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.lineTo(45, -20); ctx.lineTo(-45, -20);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.moveTo(-45, -20); ctx.lineTo(45, -20);
            ctx.lineTo(45 * roofNarrow, -50); ctx.lineTo(-45 * roofNarrow, -50);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ff3333'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 12;
            ctx.fillRect(-42, -15, 25, 8); ctx.fillRect(17, -15, 25, 8); ctx.shadowBlur = 0;
        }
        ctx.restore();
    }

    drawHUD(ctx, width, height) {
        ctx.save();
        ctx.font = "28px 'VT323', monospace"; ctx.textAlign = 'left';
        ctx.fillStyle = '#fff'; ctx.fillText('LIVES', 20, 40);
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = i < this.lives ? '#ff2d95' : '#333';
            ctx.shadowBlur = i < this.lives ? 12 : 0; ctx.shadowColor = '#ff2d95';
            const bx = 100 + i * 30, by = 30;
            ctx.beginPath();
            ctx.moveTo(bx, by + 12); ctx.lineTo(bx + 10, by); ctx.lineTo(bx + 20, by + 12);
            ctx.lineTo(bx + 16, by + 12); ctx.lineTo(bx + 10, by + 5); ctx.lineTo(bx + 4, by + 12);
            ctx.closePath(); ctx.fill();
        }
        ctx.shadowBlur = 0;
        // speed + distance in the top-right (canvas HUD, replaces the old HTML board)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#00e6ff'; ctx.shadowColor = '#00e6ff'; ctx.shadowBlur = 8;
        ctx.fillText('SPEED ' + Math.floor(this.game.car.speed / 100), width - 20, 34);
        ctx.fillStyle = '#ffde59'; ctx.shadowColor = '#ffde59';
        ctx.fillText('DIST ' + Math.floor(this.game.car.z / 1000), width - 20, 66);
        ctx.shadowBlur = 0; ctx.textAlign = 'left';
        if (this.gameOver) {
            ctx.fillStyle = 'rgba(5,2,15,0.72)'; ctx.fillRect(0, 0, width, height);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ff3355'; ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 18;
            ctx.font = "56px 'VT323', monospace"; ctx.fillText('WRECKED', width / 2, height / 2 - 20);
            ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = "28px 'VT323', monospace";
            ctx.fillText('DISTANCE ' + Math.floor(this.game.car.z / 1000), width / 2, height / 2 + 24);
            ctx.fillStyle = '#00e6ff';
            ctx.fillText('PRESS ACCELERATE TO RACE AGAIN', width / 2, height / 2 + 64);
        }
        ctx.restore();
    }
}
