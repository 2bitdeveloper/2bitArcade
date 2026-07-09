class Road {
    constructor() {
        this.segments = [];
        this.segmentLength = ROAD.segmentLength;
        this.rumbleLength = ROAD.rumbleLength;
        this.width = ROAD.width;
        this.lanes = ROAD.lanes;

        this.reset();
    }

    reset() {
        this.segments = [];
        // Create initial straight road
        for (let i = 0; i < 500; i++) {
            this.createSegment(i);
        }
    }

    createSegment(index) {
        const dark = Math.floor(index / this.rumbleLength) % 2;
        const rumbleColor = dark ? COLORS.rumbleDark : COLORS.rumbleLight;
        const laneColor = (dark || index % 4 !== 0) ? 'transparent' : COLORS.laneMarker; // Dashed lines

        this.segments.push({
            index: index,
            p1: { world: { z: index * this.segmentLength }, camera: {}, screen: {} },
            p2: { world: { z: (index + 1) * this.segmentLength }, camera: {}, screen: {} },
            color: {
                road: COLORS.road,
                grass: (Math.floor(index / 20) % 2) ? COLORS.grass : '#050505', // Alternating dark grass
                rumble: rumbleColor,
                lane: laneColor
            },
            curve: 0, // 0 for straight, +/- for curves
            y: 0 // Elevation
        });
    }

    render(ctx, cameraZ, playerX, width, height) {
        const trackLength = this.segments.length * this.segmentLength;
        const cameraDepth = 1 / Math.tan((CAM.fov / 2) * Math.PI / 180);

        // Wrap the camera position so the track loops seamlessly.
        // Segment colors and properties repeat via modulo lookup below.
        const safeCameraZ = cameraZ % trackLength;
        const startPos = Math.floor(safeCameraZ / this.segmentLength);
        const endPos = startPos + 300; // Draw distance

        // Near-plane clamp: the segment straddling the camera is projected from
        // this depth instead, so the road always fills the bottom of the frame.
        const nearZ = CAM.elevation * cameraDepth * 0.8;

        let maxy = height;

        for (let n = startPos; n < endPos; n++) {
            const segment = this.segments[n % this.segments.length];

            // Project both edges of the segment into screen space
            const worldZ1 = n * this.segmentLength;
            const worldZ2 = (n + 1) * this.segmentLength;

            // Skip segments entirely behind the camera
            if (worldZ2 - safeCameraZ <= cameraDepth) continue;

            this.project(segment.p1, playerX * this.width, CAM.elevation, safeCameraZ, cameraDepth, width, height, this.width, Math.max(worldZ1, safeCameraZ + nearZ));
            this.project(segment.p2, playerX * this.width, CAM.elevation, safeCameraZ, cameraDepth, width, height, this.width, worldZ2);

            // Cull back-facing slivers and segments fully hidden by nearer geometry
            if (segment.p2.screen.y >= segment.p1.screen.y || segment.p2.screen.y >= maxy) continue;
            maxy = segment.p1.screen.y;

            this.drawSegment(ctx, width, this.lanes, segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w, segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w, segment.color);
        }
    }

    // Project 3D world coordinates to 2D screen coordinates
    project(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth, worldZ) {
        p.camera.x = (p.world.x || 0) - cameraX;
        p.camera.y = (p.world.y || 0) - cameraY;
        p.camera.z = worldZ - cameraZ;

        // Avoid division by zero or projecting points behind the camera
        if (p.camera.z <= 0) return;

        p.screen.scale = cameraDepth / p.camera.z;
        p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
        p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
        p.screen.w = Math.round((p.screen.scale * roadWidth * width / 2));
    }

    drawSegment(ctx, width, lanes, x1, y1, w1, x2, y2, w2, color) {
        const r1 = w1 / 10; // Rumble width
        const r2 = w2 / 10;
        const l1 = w1 / 40; // Lane width
        const l2 = w2 / 40;

        // Draw Grass (Left)
        ctx.fillStyle = color.grass;
        ctx.fillRect(0, y2, width, y1 - y2);

        // Draw Rumble (Left)
        this.fillPolygon(ctx, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, color.rumble);
        // Draw Rumble (Right)
        this.fillPolygon(ctx, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, color.rumble);

        // Draw Road
        this.fillPolygon(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, color.road);

        // Draw Lanes
        if (color.lane !== 'transparent') {
            const laneW1 = w1 * 2 / lanes;
            const laneW2 = w2 * 2 / lanes;
            let laneX1 = x1 - w1 + laneW1;
            let laneX2 = x2 - w2 + laneW2;

            for(let i = 1; i < lanes; i++) {
                 this.fillPolygon(ctx, laneX1 - l1/2, y1, laneX1 + l1/2, y1, laneX2 + l2/2, y2, laneX2 - l2/2, y2, color.lane);
                 laneX1 += laneW1;
                 laneX2 += laneW2;
            }
        }
    }

    fillPolygon(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.closePath();
        ctx.fill();
    }
}
