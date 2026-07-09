class Car {
    constructor() {
        this.x = 0; // -1 (left) to 1 (right)
        this.y = 0; // Vertical position on screen (fixed mostly)
        this.z = 0; // Distance traveled
        this.speed = 0;
        this.width = CAR.width;
        this.height = CAR.height;
    }

    update(input, dt) {
        const accel = input.throttle ? CAR.accel : (input.brake ? CAR.braking : CAR.decel);
        
        // Apply acceleration
        this.speed += accel * dt * 10; // Simple scaling

        // Cap speed
        if (this.speed > CAR.maxSpeed) this.speed = CAR.maxSpeed;
        if (this.speed < 0) this.speed = 0;

        // Steering (only while moving)
        if (this.speed > 0) {
            if (input.left) this.x -= (CAR.turnSpeed * dt * 0.002);
            if (input.right) this.x += (CAR.turnSpeed * dt * 0.002);
        }

        // Clamp X
        if (this.x < -2) this.x = -2; // Off-road limits
        if (this.x > 2) this.x = 2;

        // Off-road slowdown
        if ((this.x < -1 || this.x > 1) && this.speed > CAR.offRoadLimit) {
            this.speed += CAR.offRoadDecel * dt;
        }

        // Move forward
        this.z += this.speed * dt;
    }

    render(ctx, width, height) {
        // Draw Car at center bottom
        const cx = width / 2;
        const cy = height - 150;
        
        ctx.save();
        ctx.translate(cx, cy);

        // -- Car Shadow --
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 10, 50, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // -- Car Body (Main) --
        // A Cyberpunk sports car shape
        ctx.fillStyle = COLORS.carBody;
        
        // Rear Bumper Area
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.lineTo(40, 0);
        ctx.lineTo(45, -20);
        ctx.lineTo(-45, -20);
        ctx.fill();

        // Upper Deck / Roof perspective 
        ctx.fillStyle = '#cc0044'; // Darker top
        ctx.beginPath();
        ctx.moveTo(-45, -20);
        ctx.lineTo(45, -20);
        ctx.lineTo(35, -50);
        ctx.lineTo(-35, -50);
        ctx.fill();

        // -- Taillights (Neon Glow) --
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0000';
        ctx.fillStyle = '#ff3333';
        // Left Light
        ctx.fillRect(-42, -15, 25, 8);
        // Right Light
        ctx.fillRect(17, -15, 25, 8);
        ctx.shadowBlur = 0; // Reset

        // -- License Plate "Arshiamk" --
        // Plate Background
        ctx.fillStyle = COLORS.plate;
        ctx.fillRect(-22, -15, 44, 10);
        
        // Plate Text
        ctx.fillStyle = COLORS.plateText;
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ARSHIAMK', 0, -10);

        // -- Exhaust Particles (Simple visual logic for now) --
        if (this.speed > 0) {
            this.drawExhaust(ctx);
        }

        ctx.restore();
    }

    drawExhaust(ctx) {
        // Simple flicker
        if (Math.random() > 0.5) {
            ctx.fillStyle = '#0ff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#0ff';
            ctx.fillRect(-35, 5, 5, 5);
            ctx.fillRect(30, 5, 5, 5);
            ctx.shadowBlur = 0;
        }
    }
}
