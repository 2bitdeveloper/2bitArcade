import { GameView, Difficulty } from './GameView';

export class RectF {
    left: number = 0; top: number = 0; right: number = 0; bottom: number = 0;
    set(l: number, t: number, r: number, b: number) { this.left = l; this.top = t; this.right = r; this.bottom = b; }
    setRect(rect: RectF) { this.left = rect.left; this.top = rect.top; this.right = rect.right; this.bottom = rect.bottom; }
    setEmpty() { this.left = this.right = this.top = this.bottom = 0; }
    centerX() { return (this.left + this.right) / 2; }
    centerY() { return (this.top + this.bottom) / 2; }
    contains(x: number, y: number) { return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom; }
}

export class Star {
    x: number; y: number; size: number; speed: number; alpha: number;
    constructor(x: number, y: number, size: number, speed: number, alpha: number) {
        this.x = x; this.y = y; this.size = size; this.speed = speed; this.alpha = alpha;
    }
}

export class SceneRenderer {
    public game: GameView;
    public NEBULA_SCROLL_SPEED = 1.05;
    
    public tempRectF = new RectF(); public restartBtnRect = new RectF(); public recoverBtnRect = new RectF(); public gameOverMenuRect = new RectF();
    public menuLeftArrowRect = new RectF(); public menuRightArrowRect = new RectF(); public menuDiffLeftArrowRect = new RectF(); public menuDiffRightArrowRect = new RectF();
    public menuTapToStartRect = new RectF(); public menuSettingsRect = new RectF();
    public settingsCloseRect = new RectF(); public settingsMusicRect = new RectF(); public settingsSfxRect = new RectF();
    public settingsCustomizeRect = new RectF(); public settingsTutorialRect = new RectF(); public settingsAboutRect = new RectF();
    public pauseSettingsRect = new RectF(); public pauseMenuRect = new RectF(); public pauseResumeRect = new RectF(); public hudPauseRect = new RectF();
    public bgLeftArrowRect = new RectF(); public bgRightArrowRect = new RectF(); public laserLeftArrowRect = new RectF(); public laserRightArrowRect = new RectF();
    public customizeCloseRect = new RectF(); public customizeHangarRect = new RectF(); public customizeLeftArrowRect = new RectF(); public customizeRightArrowRect = new RectF(); public customizeShipRect = new RectF();
    public hangarBackRect = new RectF(); public aboutBackRect = new RectF(); public aboutPrivacyRect = new RectF(); public tutorialNextRect = new RectF();
    public settingsLeaderboardRect = new RectF(); public leaderboardCloseRect = new RectF();
    public menuTokenomicsRect = new RectF(); public tokenomicsBackRect = new RectF();
    
    public leaderboardLeftArrowRect = new RectF(); public leaderboardRightArrowRect = new RectF();
    
    // Web3 Menu Rects
    public menuWalletRect = new RectF();
    public menuCaRect = new RectF();

    // Restored Original Bitmaps
    public playerBitmap: HTMLImageElement | null = null; 
    public titleBitmap: HTMLImageElement | null = null; 
    public flameBitmap: HTMLImageElement | null = null;
    public bmpBlade: HTMLImageElement | null = null; public bmpMissile: HTMLImageElement | null = null;
    public layerMid: HTMLImageElement | null = null; public layerMid1: HTMLImageElement | null = null; public layerMid2: HTMLImageElement | null = null;
    public loadingLandscape: HTMLImageElement | null = null; public loadingPortrait: HTMLImageElement | null = null;
    public bgBitmaps: HTMLImageElement[] = []; public shipBitmaps: HTMLImageElement[] = [];

    public playerWidth: number = 0; public playerHeight: number = 0; public flameWidth: number = 0; public flameHeight: number = 0;
    public currentNebulaScrollX = 0; public currentNebula1ScrollX = 0; public currentNebula2ScrollX = 0;
    public starsNear: Star[] = []; public starsFar: Star[] = [];

    private titleCols = 6; private titleRows = 5; private totalTitleFrames = 30;
    
    public wrappedAboutText: string[] = []; public wrappedAboutDeveloperText: string[] = []; public cachedDeathQuote: string[] = [];
    public wrappedTokenomicsText: string[] = [];

    constructor(game: GameView) { this.game = game; }

    public initBitmaps(width: number, height: number) {
        const getPath = (src: string) => `./${src}`;
        const loadImg = (src: string) => { const img = new Image(); img.src = getPath(src); return img; };

        this.titleBitmap = loadImg('title_logo.png'); 
        this.flameBitmap = loadImg('flame.png');
        this.bmpBlade = loadImg('obstacle_blade.png'); this.bmpMissile = loadImg('obstacle_missile.png');
        this.loadingLandscape = loadImg('loading_background_landscape.jpg'); this.loadingPortrait = loadImg('loading_background_portrait.jpg');
        this.layerMid = loadImg('bg_nebula_mid.png'); this.layerMid1 = loadImg('bg_nebula_mid1.png'); this.layerMid2 = loadImg('bg_nebula_mid2.png');

        this.shipBitmaps = this.game.shipResIds.map(src => loadImg(src));
        this.playerBitmap = this.shipBitmaps[this.game.activeShipIndex];
        this.bgBitmaps = this.game.bgImageIds.map(src => loadImg(src));

        this.playerWidth = 378 * this.game.screenScale * (this.game.isLandscape ? 0.65 : 0.765);
        this.playerHeight = 270 * this.game.screenScale * (this.game.isLandscape ? 0.65 : 0.765);
        this.flameWidth = 144 * this.game.screenScale * (this.game.isLandscape ? 0.8 : 1.0);
        this.flameHeight = 108 * this.game.screenScale * (this.game.isLandscape ? 0.8 : 1.0);

        this.starsNear = []; this.starsFar = [];
        for (let i = 0; i < 100; i++) this.starsFar.push(new Star(Math.random() * width, Math.random() * height, 1.0 + Math.random() * 1.5, 0.5 + Math.random() * 0.5, 100 + Math.floor(Math.random() * 100)));
        for (let i = 0; i < 30; i++) this.starsNear.push(new Star(Math.random() * width, Math.random() * height, 3.0 + Math.random() * 2.0, 3.0 + Math.random() * 3.0, 180 + Math.floor(Math.random() * 75)));
    }

    public wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
        const words = text.split(' '); const lines: string[] = []; let currentLine = words[0];
        for (let i = 1; i < words.length; i++) {
            const word = words[i]; const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) currentLine += " " + word; else { lines.push(currentLine); currentLine = word; }
        }
        lines.push(currentLine); return lines;
    }

    public updateLayout() {
        this.game.ctx.font = `${this.game.isLandscape ? 55 * this.game.screenScale : 78 * this.game.screenScale}px "VT323", monospace`;
        const maxWidth = this.game.isLandscape ? this.game.canvas.width * 0.7 : this.game.canvas.width - 300 * this.game.screenScale;
        this.game.tutorialPages = [];
        this.game.tutorialPages.push(this.wrapText(this.game.ctx, "PILOT BRIEFING: Earth is under siege. You are at the helm of an experimental Jump Fighter, trapped deep inside the treacherous Omega Nebula.", maxWidth));
        this.game.tutorialPages.push(this.wrapText(this.game.ctx, "FLIGHT SYSTEMS: The nebula's dense gravity will pull you down. TAP anywhere on the screen to fire your thrusters and boost upward.", maxWidth));
        this.game.tutorialPages.push(this.wrapText(this.game.ctx, "HOSTILE CONTACTS: Evade the alien arsenal at all costs. You will face high-energy LASERS, razor-sharp spinning BLADES, and homing MISSILES.", maxWidth));
        this.game.tutorialPages.push(["CONTROLS OVERVIEW"]);

        this.game.ctx.font = `${this.game.isLandscape ? 55 * this.game.screenScale : 75 * this.game.screenScale}px "VT323", monospace`;
        const maxAboutWidth = this.game.isLandscape ? this.game.canvas.width * 0.55 : this.game.canvas.width - 200 * this.game.screenScale;
        this.wrappedAboutText = this.wrapText(this.game.ctx, "Under siege by an alien armada, the crew of the Jump Fighter must navigate the treacherous nebula. Pursued by relentless foes, their only hope is to reach the wormhole.", maxAboutWidth);
        this.game.ctx.font = `${48.75 * this.game.screenScale}px "VT323", monospace`;
        this.wrappedAboutDeveloperText = this.wrapText(this.game.ctx, "Developed by: 2bit Developer", this.game.isLandscape ? maxAboutWidth : this.game.canvas.width - 300 * this.game.screenScale);
        
        this.game.ctx.font = `${this.game.isLandscape ? 45 * this.game.screenScale : 65 * this.game.screenScale}px "VT323", monospace`;
        const tokenomicsString = "TOTAL SUPPLY: 1,000,000,000 $JMP | " +
                                 "DEV WALLET: 2% (20,000,000) reserved for developer. | " +
                                 "DEFLATIONARY: Revives burn 1,000 $JMP, shrinking supply. | " +
                                 "DAILY REWARD: Top 3 pilots each day get ALL modes & ships unlocked for 24 hours. | " +
                                 "WEEKLY REWARD: Top 10 pilots each week get ALL unlocked for 72 hours.";
        this.wrappedTokenomicsText = this.wrapText(this.game.ctx, tokenomicsString, maxAboutWidth);

        this.updateTouchRects();
    }

    public updateTouchRects() {
        const cx = this.game.canvas.width / 2; const width = this.game.canvas.width; const height = this.game.canvas.height; const scale = this.game.screenScale;
        const arrowW = 60 * scale, arrowH = 60 * scale;

        if (this.game.isLandscape) {
            // --- MAIN MENU: single centered column ---
            // Logo (raised) -> DIFFICULTY -> OBSTACLES -> TAP TO START -> CONNECT WALLET -> TOKENOMICS -> CA
            // In landscape, scale = height / 1080, so height === 1080 * scale on every screen.
            const selArrowOffset = 300 * scale, selArrowH = 50 * scale;
            const diffY = 500 * scale; // directly below the raised title logo
            const obsY = 615 * scale;  // stacked under the difficulty row

            this.menuDiffLeftArrowRect.set(cx - selArrowOffset - arrowW, diffY - selArrowH, cx - selArrowOffset + arrowW, diffY + selArrowH);
            this.menuDiffRightArrowRect.set(cx + selArrowOffset - arrowW, diffY - selArrowH, cx + selArrowOffset + arrowW, diffY + selArrowH);
            this.menuLeftArrowRect.set(cx - selArrowOffset - arrowW, obsY - selArrowH, cx - selArrowOffset + arrowW, obsY + selArrowH);
            this.menuRightArrowRect.set(cx + selArrowOffset - arrowW, obsY - selArrowH, cx + selArrowOffset + arrowW, obsY + selArrowH);

            this.settingsCloseRect.set(width - 150 * scale, 50 * scale, width - 50 * scale, 150 * scale); 
            this.menuSettingsRect.setRect(this.settingsCloseRect);
            
            // Bottom stack, spread across the lower half instead of piled at the edge:
            // TAP TO START (centered at 760) -> CONNECT WALLET (865) -> TOKENOMICS (950) -> CA (1040)
            this.menuTapToStartRect.set(cx - 250 * scale, 705 * scale, cx + 250 * scale, 815 * scale);
            this.menuWalletRect.set(cx - 260 * scale, 825 * scale, cx + 260 * scale, 905 * scale);
            this.menuTokenomicsRect.set(cx - 220 * scale, 912 * scale, cx + 220 * scale, 988 * scale);
            
            const caY = height - 40 * scale;
            this.menuCaRect.set(cx - 350 * scale, caY - 30 * scale, cx + 350 * scale, caY + 30 * scale);

            let sY = height * 0.25; const rowSpacing = 100 * scale, colLeft = cx - 350 * scale, colRight = cx + 350 * scale, btnW = 250 * scale, btnH = 40 * scale;
            this.settingsMusicRect.set(colLeft - btnW, sY - btnH, colLeft + btnW, sY + btnH); this.settingsSfxRect.set(colRight - btnW, sY - btnH, colRight + btnW, sY + btnH); sY += rowSpacing;
            this.settingsCustomizeRect.set(colLeft - btnW, sY - btnH, colLeft + btnW, sY + btnH); this.settingsLeaderboardRect.set(colRight - btnW, sY - btnH, colRight + btnW, sY + btnH); sY += rowSpacing;
            this.settingsTutorialRect.set(colLeft - btnW, sY - btnH, colLeft + btnW, sY + btnH); this.settingsAboutRect.set(colRight - btnW, sY - btnH, colRight + btnW, sY + btnH);

            this.hudPauseRect.set(cx - 100 * scale, 30 * scale, cx + 100 * scale, 150 * scale);
            this.pauseResumeRect.set(cx - 300 * scale, height/2 + 20 * scale, cx + 300 * scale, height/2 + 120 * scale);
            this.pauseSettingsRect.set(cx - 250 * scale, height/2 + 160 * scale, cx + 250 * scale, height/2 + 260 * scale);
            this.pauseMenuRect.set(cx - 250 * scale, height/2 + 300 * scale, cx + 250 * scale, height/2 + 400 * scale);

            const activeBtns = this.game.usedRecovery ? 2 : 3;
            const gBtnW = 150 * scale, gYPos = height - 150 * scale, spacing = width / (activeBtns + 1);
            if (!this.game.usedRecovery) {
                this.recoverBtnRect.set(spacing - gBtnW, gYPos - 50 * scale, spacing + gBtnW, gYPos + 50 * scale);
                this.restartBtnRect.set((spacing*2) - gBtnW, gYPos - 50 * scale, (spacing*2) + gBtnW, gYPos + 50 * scale);
                this.gameOverMenuRect.set((spacing*3) - gBtnW, gYPos - 50 * scale, (spacing*3) + gBtnW, gYPos + 50 * scale);
            } else {
                this.restartBtnRect.set(spacing - gBtnW, gYPos - 50 * scale, spacing + gBtnW, gYPos + 50 * scale);
                this.gameOverMenuRect.set((spacing*2) - gBtnW, gYPos - 50 * scale, (spacing*2) + gBtnW, gYPos + 50 * scale);
                this.recoverBtnRect.setEmpty();
            }

            let custY = height * 0.25; const custSpacing = 130 * scale, cLeft = width * 0.4, cRight = width * 0.8, custArrowOff = 380 * scale;
            this.customizeCloseRect.setRect(this.settingsCloseRect);
            this.bgLeftArrowRect.set(cLeft - custArrowOff - arrowW, custY - arrowH, cLeft - custArrowOff + arrowW, custY + arrowH); this.bgRightArrowRect.set(cLeft + custArrowOff - arrowW, custY - arrowH, cLeft + custArrowOff + arrowW, custY + arrowH); custY += custSpacing;
            this.laserLeftArrowRect.set(cLeft - custArrowOff - arrowW, custY - arrowH, cLeft - custArrowOff + arrowW, custY + arrowH); this.laserRightArrowRect.set(cLeft + custArrowOff - arrowW, custY - arrowH, cLeft + custArrowOff + arrowW, custY + arrowH);
            this.customizeHangarRect.set(cRight - 250 * scale, height * 0.5 - 60 * scale, cRight + 250 * scale, height * 0.5 + 60 * scale);
            this.hangarBackRect.setRect(this.settingsCloseRect);
            
            const leftHangarCx = width * 0.30, shy2 = height/2;
            this.customizeLeftArrowRect.set(leftHangarCx - 250 * scale - arrowW, shy2 - arrowH, leftHangarCx - 250 * scale + arrowW, shy2 + arrowH);
            this.customizeRightArrowRect.set(leftHangarCx + 250 * scale - arrowW, shy2 - arrowH, leftHangarCx + 250 * scale + arrowW, shy2 + arrowH);
            this.customizeShipRect.set(leftHangarCx - 200 * scale, shy2 - 200 * scale, leftHangarCx + 200 * scale, shy2 + 200 * scale);
            
            this.aboutBackRect.set(width * 0.85 - 150 * scale, height * 0.65 - 60 * scale, width * 0.85 + 150 * scale, height * 0.65 + 60 * scale);
            this.aboutPrivacyRect.set(width * 0.85 - 200 * scale, height * 0.65 - 200 * scale, width * 0.85 + 200 * scale, height * 0.65 - 80 * scale);
            
            this.tokenomicsBackRect.setRect(this.aboutBackRect);
            
            this.tutorialNextRect.set(cx - 250 * scale, height - 150 * scale, cx + 250 * scale, height - 50 * scale);
            this.leaderboardLeftArrowRect.set(cx - 550 * scale, height / 2 - 80 * scale, cx - 400 * scale, height / 2 + 80 * scale);
            this.leaderboardRightArrowRect.set(cx + 400 * scale, height / 2 - 80 * scale, cx + 550 * scale, height / 2 + 80 * scale);
        } else {
            const titleBottom = 50 * scale + ((1152 * scale / 2) * 1.15);
            const diffY = titleBottom + 130 * scale; // difficulty row sits directly below the logo
            const mainSpacing = Math.min(250 * scale, (height - diffY - 450 * scale) / 2);

            this.menuDiffLeftArrowRect.set(cx - 450 * scale, diffY - 70 * scale, cx - 350 * scale, diffY + 70 * scale);
            this.menuDiffRightArrowRect.set(cx + 350 * scale, diffY - 70 * scale, cx + 450 * scale, diffY + 70 * scale);
            const obsY = diffY + mainSpacing;
            this.menuLeftArrowRect.set(cx - 450 * scale, obsY - 70 * scale, cx - 350 * scale, obsY + 70 * scale);
            this.menuRightArrowRect.set(cx + 350 * scale, obsY - 70 * scale, cx + 450 * scale, obsY + 70 * scale);

            // Centered below the obstacle selector (logo -> difficulty -> obstacles -> tokenomics)
            this.menuTokenomicsRect.set(cx - 300 * scale, obsY + 130 * scale, cx + 300 * scale, obsY + 260 * scale);
            this.menuSettingsRect.set(width - 350 * scale, 50 * scale, width - 50 * scale, 180 * scale);
            
            const startY = height - 380 * scale; 
            this.menuTapToStartRect.set(cx - 300 * scale, startY - 60 * scale, cx + 300 * scale, startY + 40 * scale);
            this.menuWalletRect.set(cx - 320 * scale, startY + 60 * scale, cx + 320 * scale, startY + 140 * scale);
            
            const caY = height - 80 * scale;
            this.menuCaRect.set(cx - 450 * scale, caY - 40 * scale, cx + 450 * scale, caY + 40 * scale);

            const settingsStart = 280 * scale, settingsEnd = height - 250 * scale, sSpacing = (settingsEnd - settingsStart) / 5; let sY = settingsStart;
            this.settingsMusicRect.set(cx - 450 * scale, sY - 60 * scale, cx - 50 * scale, sY + 60 * scale); this.settingsSfxRect.set(cx + 50 * scale, sY - 60 * scale, cx + 450 * scale, sY + 60 * scale); sY += sSpacing;
            this.settingsCustomizeRect.set(cx - 350 * scale, sY - 70 * scale, cx + 350 * scale, sY + 70 * scale); sY += sSpacing;
            this.settingsLeaderboardRect.set(cx - 350 * scale, sY - 70 * scale, cx + 350 * scale, sY + 70 * scale); sY += sSpacing;
            this.settingsTutorialRect.set(cx - 350 * scale, sY - 70 * scale, cx + 350 * scale, sY + 70 * scale); sY += sSpacing;
            this.settingsAboutRect.set(cx - 350 * scale, sY - 70 * scale, cx + 350 * scale, sY + 70 * scale);
            this.settingsCloseRect.set(width - 250 * scale, 50 * scale, width - 50 * scale, 150 * scale);
            this.leaderboardCloseRect.setRect(this.settingsCloseRect);

            this.hudPauseRect.set(cx - 100 * scale, 30 * scale, cx + 100 * scale, 150 * scale);
            this.pauseResumeRect.set(cx - 300 * scale, height/2 + 100 * scale, cx + 300 * scale, height/2 + 220 * scale);
            this.pauseSettingsRect.set(cx - 300 * scale, height/2 + 250 * scale, cx + 300 * scale, height/2 + 370 * scale);
            this.pauseMenuRect.set(cx - 300 * scale, height/2 + 400 * scale, cx + 300 * scale, height/2 + 520 * scale);

            let bottomY = height - 250 * scale; const btnH = 110 * scale, gap = 40 * scale;
            if (!this.game.usedRecovery) {
                this.recoverBtnRect.set(cx - 250 * scale, bottomY - btnH, cx + 250 * scale, bottomY); bottomY -= (btnH + gap);
                this.restartBtnRect.set(cx - 250 * scale, bottomY - btnH, cx + 250 * scale, bottomY);
            } else {
                this.restartBtnRect.set(cx - 250 * scale, bottomY - btnH, cx + 250 * scale, bottomY);
                this.recoverBtnRect.setEmpty();
            }
            this.gameOverMenuRect.setRect(this.settingsCloseRect);

            this.customizeCloseRect.setRect(this.settingsCloseRect);
            let custY = 350 * scale, custSpacing = (height - 500 * scale - custY) / 4;
            this.bgLeftArrowRect.set(cx - 450 * scale, custY - 70 * scale, cx - 350 * scale, custY + 70 * scale); this.bgRightArrowRect.set(cx + 350 * scale, custY - 70 * scale, cx + 450 * scale, custY + 70 * scale); custY += custSpacing;
            this.laserLeftArrowRect.set(cx - 450 * scale, custY - 70 * scale, cx - 350 * scale, custY + 70 * scale); this.laserRightArrowRect.set(cx + 350 * scale, custY - 70 * scale, cx + 450 * scale, custY + 70 * scale);
            this.customizeHangarRect.set(cx - 350 * scale, height - 500 * scale + 150 * scale, cx + 350 * scale, height - 500 * scale + 300 * scale);
            this.hangarBackRect.setRect(this.settingsCloseRect);
            
            const dw = 600 * scale, dh = 600 * scale, shy2 = height/2 - 100 * scale;
            this.customizeLeftArrowRect.set(cx - dw/2 - 220 * scale, shy2 - 100 * scale, cx - dw/2 - 20 * scale, shy2 + 100 * scale);
            this.customizeRightArrowRect.set(cx + dw/2 + 20 * scale, shy2 - 100 * scale, cx + dw/2 + 220 * scale, shy2 + 100 * scale);
            this.customizeShipRect.set(cx - dw/2, shy2 - dh/2, cx + dw/2, shy2 + dh/2);
            
            this.aboutBackRect.set(cx - 200 * scale, height - 250 * scale, cx + 200 * scale, height - 100 * scale);
            this.aboutPrivacyRect.set(cx - 250 * scale, height - 400 * scale, cx + 250 * scale, height - 280 * scale);
            
            this.tokenomicsBackRect.setRect(this.aboutBackRect);
            
            this.tutorialNextRect.set(cx - 250 * scale, height - 150 * scale, cx + 250 * scale, height - 50 * scale);
            this.leaderboardLeftArrowRect.set(10 * scale, height / 2 - 100 * scale, 150 * scale, height / 2 + 100 * scale);
            this.leaderboardRightArrowRect.set(width - 150 * scale, height / 2 - 100 * scale, width - 10 * scale, height / 2 + 100 * scale);
        }
    }

    public drawRotatePrompt(ctx: CanvasRenderingContext2D) {
        const w = this.game.canvas.width, h = this.game.canvas.height, scale = this.game.screenScale;
        ctx.fillStyle = "black"; ctx.fillRect(0, 0, w, h);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.save();
        ctx.shadowColor = "rgb(255, 165, 0)"; ctx.shadowBlur = 30 * scale;
        ctx.fillStyle = "white"; ctx.font = `${140 * scale}px "VT323", monospace`;
        ctx.fillText("\u21BB", w / 2, h / 2 - 160 * scale);
        ctx.font = `${80 * scale}px "VT323", monospace`;
        ctx.fillText("ROTATE YOUR DEVICE", w / 2, h / 2);
        ctx.restore();
        ctx.fillStyle = "gray"; ctx.font = `${45 * scale}px "VT323", monospace`;
        ctx.fillText("JUMP FIGHTER is a landscape experience", w / 2, h / 2 + 110 * scale);
    }

    public drawGlowText(ctx: CanvasRenderingContext2D, text: string, rect: RectF, textSize: number, color: string = "white") {
        ctx.fillStyle = color; ctx.font = `${textSize}px "VT323", monospace`;
        ctx.shadowColor = color === "white" ? "rgb(255, 165, 0)" : "rgb(255, 0, 0)";
        ctx.shadowBlur = 30 * this.game.screenScale;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(text, rect.centerX(), rect.centerY());
        ctx.shadowBlur = 0;
    }

    public updateNebulaState(dt: number) {
        const speed = this.NEBULA_SCROLL_SPEED * 60 * dt * this.game.screenScale;
        this.currentNebulaScrollX -= speed; this.currentNebula1ScrollX -= speed; this.currentNebula2ScrollX -= speed;
    }

    public drawMainBackground(ctx: CanvasRenderingContext2D) {
        const bg = this.bgBitmaps[this.game.bgColorIndex];
        if (bg && bg.complete && bg.naturalWidth > 0) {
            const factor = Math.max(this.game.canvas.width / bg.width, this.game.canvas.height / bg.height);
            const dw = bg.width * factor, dh = bg.height * factor;
            ctx.drawImage(bg, (this.game.canvas.width - dw) / 2, (this.game.canvas.height - dh) / 2, dw, dh);
        }
    }

    public drawParallax(ctx: CanvasRenderingContext2D) {
        const bg = this.game.bgColorIndex === 0 ? this.layerMid : (this.game.bgColorIndex === 1 ? this.layerMid1 : this.layerMid2);
        const rawScroll = this.game.bgColorIndex === 0 ? this.currentNebulaScrollX : (this.game.bgColorIndex === 1 ? this.currentNebula1ScrollX : this.game.bgColorIndex === 2 ? this.currentNebula2ScrollX : 0);
        if (bg && bg.complete && bg.naturalWidth > 0) {
            ctx.globalAlpha = 0.5;
            const factor = Math.max(this.game.canvas.width / bg.width, this.game.canvas.height / bg.height);
            const dw = bg.width * factor, dh = bg.height * factor;
            let drawX = (rawScroll % dw); if (drawX > 0) drawX -= dw; 
            ctx.drawImage(bg, drawX, (this.game.canvas.height - dh) / 2, dw, dh);
            ctx.drawImage(bg, drawX + dw, (this.game.canvas.height - dh) / 2, dw, dh);
            ctx.globalAlpha = 1.0;
        }
    }

    public drawMainMenu(ctx: CanvasRenderingContext2D) {
        const loadingBmp = this.game.isLandscape ? this.loadingLandscape : this.loadingPortrait;
        if (loadingBmp && loadingBmp.complete && loadingBmp.naturalWidth > 0) {
            const factor = Math.max(this.game.canvas.width / loadingBmp.width, this.game.canvas.height / loadingBmp.height);
            const dw = loadingBmp.width * factor, dh = loadingBmp.height * factor;
            ctx.drawImage(loadingBmp, (this.game.canvas.width - dw) / 2, (this.game.canvas.height - dh) / 2, dw, dh);
        }

        const ty = this.game.isLandscape ? 60 * this.game.screenScale : 50 * this.game.screenScale;

        if (this.titleBitmap && this.titleBitmap.complete && this.titleBitmap.naturalWidth > 0) {
            const currentFrame = Math.floor((Date.now() / 20) % this.totalTitleFrames);
            const frameCol = currentFrame % this.titleCols; const frameRow = Math.floor(currentFrame / this.titleCols);
            const tW = this.titleBitmap.width / this.titleCols, tH = this.titleBitmap.height / this.titleRows;
            const baseWidth = this.game.isLandscape ? (1000 * this.game.screenScale) : (1152 * this.game.screenScale);
            const visualHeight = (baseWidth / 2) * 1.15;
            const left = (this.game.canvas.width / 2) - (baseWidth / 2), top = (ty + visualHeight / 2) - (visualHeight / 2);

            ctx.save(); ctx.globalAlpha = 0.5; ctx.filter = 'brightness(0) blur(5px)';
            ctx.drawImage(this.titleBitmap, frameCol * tW, frameRow * tH, tW, tH, left + (10 * this.game.screenScale), top + (15 * this.game.screenScale), baseWidth, visualHeight);
            ctx.restore();

            ctx.shadowColor = "rgb(255, 100, 0)"; ctx.shadowBlur = 15 * this.game.screenScale;
            ctx.drawImage(this.titleBitmap, frameCol * tW, frameRow * tH, tW, tH, left, top, baseWidth, visualHeight); ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = "white"; ctx.font = `bold ${this.game.isLandscape ? 150 * this.game.screenScale : 225 * this.game.screenScale}px "VT323", monospace`;
            ctx.textAlign = "center"; ctx.fillText("JET DODGER", this.game.canvas.width / 2, ty + 150 * this.game.screenScale);
        }

        ctx.save();
        ctx.shadowColor = "rgb(255, 165, 0)"; 
        ctx.shadowBlur = 30 * this.game.screenScale; 
        ctx.fillStyle = "white"; 
        ctx.font = `${this.game.isLandscape ? 40 * this.game.screenScale : 50 * this.game.screenScale}px "VT323", monospace`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        
        const statsX = 40 * this.game.screenScale;
        const statsY = 40 * this.game.screenScale;
        ctx.fillText("● " + this.game.activePilotsStr, statsX, statsY);
        ctx.fillText("● " + this.game.tokensBurnedStr, statsX, statsY + (this.game.isLandscape ? 45 : 60) * this.game.screenScale);
        if (this.game.hasRewardUnlock()) {
            const msLeft = this.game.rewardUnlockUntil - Date.now();
            const hLeft = Math.floor(msLeft / 3600000), mLeft = Math.floor((msLeft % 3600000) / 60000);
            ctx.fillStyle = "#FFD700"; ctx.shadowColor = "rgb(255, 215, 0)";
            ctx.fillText(`★ CHAMPION UNLOCK: ${hLeft}h ${mLeft}m`, statsX, statsY + 2 * (this.game.isLandscape ? 45 : 60) * this.game.screenScale);
        }
        ctx.restore();

        this.drawGlowText(ctx, "SETTINGS", this.menuSettingsRect, this.game.isLandscape ? 50 * this.game.screenScale : 75 * this.game.screenScale);
        this.drawGlowText(ctx, "TOKENOMICS", this.menuTokenomicsRect, this.game.isLandscape ? 50 * this.game.screenScale : 75 * this.game.screenScale);

        ctx.fillStyle = "white"; ctx.font = `${this.game.isLandscape ? 55 * this.game.screenScale : 72 * this.game.screenScale}px "VT323", monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";

        const isObsUnlocked = this.game.isObstacleModeUnlocked(this.game.obstacleMode);
        let obsDisplayStr = this.game.obstacleStatusStr;

        // Orange glow on the difficulty/obstacle selectors (red when locked), matching drawGlowText
        ctx.save();
        ctx.shadowColor = "rgb(255, 165, 0)";
        ctx.shadowBlur = 30 * this.game.screenScale;

        if (this.game.isLandscape) {
            const menuCx = this.game.canvas.width / 2;
            ctx.fillText(this.game.diffStatusStr, menuCx, this.menuDiffLeftArrowRect.centerY() + 15 * this.game.screenScale);
            
            if (!isObsUnlocked) { ctx.fillStyle = "#FF5555"; ctx.shadowColor = "rgb(255, 0, 0)"; }
            ctx.fillText(this.game.obstacleStatusStr, menuCx, this.menuLeftArrowRect.centerY() + 15 * this.game.screenScale);
            
            if (!isObsUnlocked) {
                // Holding requirement, not a price: checked against the connected wallet's balance
                ctx.font = `${34 * this.game.screenScale}px "VT323", monospace`;
                ctx.fillStyle = "#FF8888";
                ctx.fillText(`HOLD ${this.game.obsTokenThresholds[this.game.obstacleMode].toLocaleString()} $JMP IN WALLET TO UNLOCK`, menuCx, this.menuLeftArrowRect.centerY() + 75 * this.game.screenScale);
            }
        } else {
            ctx.fillText(this.game.diffStatusStr, this.game.canvas.width / 2, this.menuDiffLeftArrowRect.centerY() + 25 * this.game.screenScale);
            
            if (!isObsUnlocked) {
                obsDisplayStr = `LOCKED (${this.game.obsTokenThresholds[this.game.obstacleMode] / 1000}k $JMP)`;
                ctx.fillStyle = "#FF5555"; ctx.shadowColor = "rgb(255, 0, 0)";
            }
            ctx.fillText(obsDisplayStr, this.game.canvas.width / 2, this.menuLeftArrowRect.centerY() + 25 * this.game.screenScale);
        }

        ctx.fillStyle = "white";
        ctx.shadowColor = "rgb(255, 165, 0)"; // arrows always glow orange, even when the mode is locked
        ctx.font = `${this.game.isLandscape ? 60 * this.game.screenScale : 135 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText("<", this.menuDiffLeftArrowRect.centerX(), this.menuDiffLeftArrowRect.centerY() + (this.game.isLandscape ? 20 : 45) * this.game.screenScale);
        ctx.fillText(">", this.menuDiffRightArrowRect.centerX(), this.menuDiffRightArrowRect.centerY() + (this.game.isLandscape ? 20 : 45) * this.game.screenScale);
        ctx.fillText("<", this.menuLeftArrowRect.centerX(), this.menuLeftArrowRect.centerY() + (this.game.isLandscape ? 20 : 45) * this.game.screenScale);
        ctx.fillText(">", this.menuRightArrowRect.centerX(), this.menuRightArrowRect.centerY() + (this.game.isLandscape ? 20 : 45) * this.game.screenScale);
        ctx.restore();

        const startText = isObsUnlocked ? "TAP TO START" : "MODE LOCKED";
        const startColor = isObsUnlocked ? "white" : "#FF5555";
        this.drawGlowText(ctx, startText, this.menuTapToStartRect, this.game.isLandscape ? 70 * this.game.screenScale : 112 * this.game.screenScale, startColor);
        
        const walletString = this.game.walletConnected
            ? `${this.game.watchOnlyMode ? "[WATCH] " : ""}BAL: ${Math.floor(this.game.tokenBalance).toLocaleString()} $JMP`
            : "CONNECT WALLET";
        this.drawGlowText(ctx, walletString, this.menuWalletRect, this.game.isLandscape ? 40 * this.game.screenScale : 65 * this.game.screenScale);
        
        let caText = "";
        if (this.game.caCopiedTimer > 0) {
            caText = "CA COPIED TO CLIPBOARD!";
        } else {
            const shrinkCA = this.game.isLandscape ? this.game.CONTRACT_ADDRESS : this.game.CONTRACT_ADDRESS.substring(0, 15) + "...";
            caText = `CA: ${shrinkCA} 📋`;
        }
        this.drawGlowText(ctx, caText, this.menuCaRect, this.game.isLandscape ? 35 * this.game.screenScale : 45 * this.game.screenScale);

        if (this.game.isDevMode) {
            ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
            ctx.font = `${30 * this.game.screenScale}px "VT323", monospace`;
            ctx.textAlign = "left";
            ctx.fillText("[DEV ENV] 'K': +500k tokens | 'L': Clear", 30 * this.game.screenScale, this.game.canvas.height - 40 * this.game.screenScale);
        }
    }

    public drawSettingsScreen(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        this.drawGlowText(ctx, "X", this.settingsCloseRect, this.game.isLandscape ? 70 * this.game.screenScale : 120 * this.game.screenScale);
        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `${this.game.isLandscape ? 90 * this.game.screenScale : 130 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText("SETTINGS", this.game.canvas.width / 2, this.game.isLandscape ? 160 * this.game.screenScale : 230 * this.game.screenScale);

        const ts = this.game.isLandscape ? 60 * this.game.screenScale : 90 * this.game.screenScale;
        this.drawGlowText(ctx, this.game.musicStatusStr, this.settingsMusicRect, ts);
        this.drawGlowText(ctx, this.game.sfxStatusStr, this.settingsSfxRect, ts);
        this.drawGlowText(ctx, "CUSTOMIZE", this.settingsCustomizeRect, ts);
        this.drawGlowText(ctx, "LEADERBOARDS", this.settingsLeaderboardRect, ts);
        this.drawGlowText(ctx, "TUTORIAL", this.settingsTutorialRect, ts);
        this.drawGlowText(ctx, "ABOUT", this.settingsAboutRect, ts);
    }

    public drawLeaderboardsScreen(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)"; ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        this.drawGlowText(ctx, "X", this.leaderboardCloseRect, this.game.isLandscape ? 70 * this.game.screenScale : 120 * this.game.screenScale);

        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; 
        ctx.font = `${this.game.isLandscape ? 90 * this.game.screenScale : 130 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText("LEADERBOARDS", this.game.canvas.width / 2, this.game.isLandscape ? 160 * this.game.screenScale : 230 * this.game.screenScale);

        if (this.game.leaderboardsLoading) {
            ctx.font = `${this.game.isLandscape ? 60 * this.game.screenScale : 80 * this.game.screenScale}px "VT323", monospace`;
            ctx.fillText("SYNCING SATELLITE DATA...", this.game.canvas.width / 2, this.game.canvas.height / 2);
            return;
        }

        ctx.save(); ctx.translate(-this.game.leaderboardScrollX, 0);
        const titles = ["EASY - LASER", "EASY - BLADE", "EASY - MISSILE", "MEDIUM - LASER", "MEDIUM - BLADE", "MEDIUM - MISSILE", "HARD - LASER", "HARD - BLADE", "HARD - MISSILE"];

        for (let i = 0; i < 9; i++) {
            const pageCenterX = (i * this.game.canvas.width) + (this.game.canvas.width / 2);
            
            ctx.fillStyle = "yellow"; ctx.font = `${this.game.isLandscape ? 50 * this.game.screenScale : 80 * this.game.screenScale}px "VT323", monospace`;
            const titleY = this.game.isLandscape ? 260 * this.game.screenScale : 360 * this.game.screenScale;
            ctx.fillText(titles[i], pageCenterX, titleY);

            ctx.fillStyle = "cyan"; ctx.font = `${this.game.isLandscape ? 35 * this.game.screenScale : 55 * this.game.screenScale}px "VT323", monospace`;
            const headerY = titleY + (this.game.isLandscape ? 70 * this.game.screenScale : 100 * this.game.screenScale);
            const colRank = pageCenterX - (350 * this.game.screenScale);
            const colScore = pageCenterX + (350 * this.game.screenScale);

            ctx.fillText("RANK", colRank, headerY); ctx.fillText("PILOT", pageCenterX, headerY); ctx.fillText("SCORE", colScore, headerY);

            const topLimit = headerY + 30 * this.game.screenScale; const bottomLimit = this.game.canvas.height - (this.game.isLandscape ? 200 : 300) * this.game.screenScale;

            ctx.save(); ctx.beginPath(); ctx.rect(pageCenterX - (this.game.canvas.width / 2), topLimit, this.game.canvas.width, bottomLimit - topLimit); ctx.clip();
            ctx.fillStyle = "white";
            let entryY = topLimit + (this.game.isLandscape ? 60 * this.game.screenScale : 90 * this.game.screenScale) - (this.game.leaderboardScrollY[i] || 0);
            
            const entries = this.game.leaderboardsData[i];
            if (!entries || entries.length === 0) { ctx.fillText("NO DATA FOUND", pageCenterX, entryY + 100 * this.game.screenScale); } else {
                for (const entry of entries) {
                    ctx.fillText(entry.rank.toString(), colRank, entryY);
                    const pName = entry.player.name || `Guest_${Math.floor(Math.random()*9000)}`;
                    ctx.fillText(pName.substring(0, 12), pageCenterX, entryY); ctx.fillText(entry.score.toString(), colScore, entryY);
                    entryY += this.game.isLandscape ? 50 * this.game.screenScale : 80 * this.game.screenScale;
                }
            }

            const totalHeight = (entries ? entries.length : 0) * (this.game.isLandscape ? 50 : 80) * this.game.screenScale;
            const maxScroll = Math.max(0, totalHeight - (bottomLimit - topLimit) + 100 * this.game.screenScale);
            if (this.game.leaderboardScrollY[i] > maxScroll) this.game.leaderboardScrollY[i] = maxScroll;
            if (this.game.leaderboardScrollY[i] < 0) this.game.leaderboardScrollY[i] = 0;
            ctx.restore();
        }
        ctx.restore();

        const dotSpacing = 50 * this.game.screenScale, startX = (this.game.canvas.width / 2) - (4 * dotSpacing), dotY = this.game.canvas.height - (this.game.isLandscape ? 60 * this.game.screenScale : 120 * this.game.screenScale);
        const currentPage = Math.max(0, Math.min(8, Math.round(this.game.leaderboardScrollX / this.game.canvas.width)));
        for (let i = 0; i < 9; i++) { ctx.fillStyle = i === currentPage ? "white" : "darkgray"; ctx.beginPath(); ctx.arc(startX + (i * dotSpacing), dotY, 10 * this.game.screenScale, 0, Math.PI * 2); ctx.fill(); }

        ctx.fillStyle = "white"; ctx.font = `${this.game.isLandscape ? 100 * this.game.screenScale : 150 * this.game.screenScale}px "VT323", monospace`;
        if (currentPage > 0) ctx.fillText("<", this.leaderboardLeftArrowRect.centerX(), this.leaderboardLeftArrowRect.centerY());
        if (currentPage < 8) ctx.fillText(">", this.leaderboardRightArrowRect.centerX(), this.leaderboardRightArrowRect.centerY());
    }

    public drawCustomizeScreen(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        this.drawGlowText(ctx, "X", this.customizeCloseRect, this.game.isLandscape ? 70 * this.game.screenScale : 120 * this.game.screenScale);
        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `${this.game.isLandscape ? 90 * this.game.screenScale : 130 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText("CUSTOMIZE", this.game.canvas.width / 2, this.game.isLandscape ? 160 * this.game.screenScale : 230 * this.game.screenScale);

        const colLeft = this.game.isLandscape ? this.game.canvas.width * 0.4 : this.game.canvas.width / 2;
        ctx.font = `${this.game.isLandscape ? 55 * this.game.screenScale : 72 * this.game.screenScale}px "VT323", monospace`;

        const isBgUnlocked = this.game.isBackgroundUnlocked(this.game.bgColorIndex);
        const bgLabelString = isBgUnlocked ? this.game.bgImageNames[this.game.bgColorIndex] : `LOCKED (Hold ${this.game.bgTokenThresholds[this.game.bgColorIndex].toLocaleString()})`;
        
        ctx.fillStyle = isBgUnlocked ? "white" : "#FF5555";
        ctx.fillText("BACKGROUND: " + bgLabelString, colLeft, this.bgLeftArrowRect.centerY() + (this.game.isLandscape ? 15 : 25) * this.game.screenScale);
        
        ctx.fillStyle = "white";
        ctx.fillText("LASER: " + this.game.laserColorNames[this.game.laserColorIndex], colLeft, this.laserLeftArrowRect.centerY() + (this.game.isLandscape ? 15 : 25) * this.game.screenScale);

        ctx.font = `${this.game.isLandscape ? 60 * this.game.screenScale : 135 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText("<", this.bgLeftArrowRect.centerX(), this.bgLeftArrowRect.centerY() + (this.game.isLandscape ? 20 : 45) * this.game.screenScale);
        ctx.fillText(">", this.bgRightArrowRect.centerX(), this.bgRightArrowRect.centerY() + (this.game.isLandscape ? 20 : 45) * this.game.screenScale);
        ctx.fillText("<", this.laserLeftArrowRect.centerX(), this.laserLeftArrowRect.centerY() + (this.game.isLandscape ? 20 : 45) * this.game.screenScale);
        ctx.fillText(">", this.laserRightArrowRect.centerX(), this.laserRightArrowRect.centerY() + (this.game.isLandscape ? 20 : 45) * this.game.screenScale);

        this.drawGlowText(ctx, "[ SHIP HANGAR ]", this.customizeHangarRect, this.game.isLandscape ? 60 * this.game.screenScale : 100 * this.game.screenScale);
    }

    public drawHangarScreen(ctx: CanvasRenderingContext2D, desc: string, title: string, cond: string, unlocked: boolean, frameIndex: number) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        this.drawGlowText(ctx, "X", this.hangarBackRect, this.game.isLandscape ? 70 * this.game.screenScale : 120 * this.game.screenScale);
        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `${this.game.isLandscape ? 90 * this.game.screenScale : 130 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText("HANGAR", this.game.canvas.width / 2, this.game.isLandscape ? 160 * this.game.screenScale : 230 * this.game.screenScale);

        const bmp = this.shipBitmaps[this.game.currentShipIndex];
        if (bmp && bmp.complete && bmp.naturalWidth > 0) {
            const cols = 10, rows = 12, fw = bmp.width / cols, fh = bmp.height / rows, c = frameIndex % cols, r = Math.floor(frameIndex / cols);
            const leftCx = this.game.isLandscape ? this.game.canvas.width * 0.30 : this.game.canvas.width / 2, displayWidth = (this.game.isLandscape ? 550 : 750) * this.game.screenScale, displayHeight = displayWidth * (fh / fw) * 1.3, centerYOffset = this.game.isLandscape ? 50 * this.game.screenScale : 300 * this.game.screenScale;
            const destX = leftCx - displayWidth / 2; const destY = this.game.canvas.height / 2 - displayHeight / 2 - centerYOffset;
            const topY = 200 * this.game.screenScale, bottomY = destY + displayHeight + 50 * this.game.screenScale;
            const grad = ctx.createLinearGradient(leftCx, topY, leftCx, bottomY);
            
            let activeColor = "rgba(255, 50, 50, 0.4)";
            if (this.game.currentShipIndex === this.game.activeShipIndex) activeColor = "rgba(255, 215, 0, 0.47)";
            else if (unlocked) activeColor = "rgba(200, 240, 255, 0.4)";
            
            grad.addColorStop(0, activeColor); grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.beginPath(); ctx.moveTo(leftCx - 150 * this.game.screenScale, topY); ctx.lineTo(leftCx + 150 * this.game.screenScale, topY); ctx.lineTo(leftCx + 350 * this.game.screenScale, bottomY); ctx.lineTo(leftCx - 350 * this.game.screenScale, bottomY); ctx.fillStyle = grad; ctx.fill();

            ctx.save(); if (!unlocked) { ctx.filter = 'brightness(0) invert(0.2)'; } ctx.drawImage(bmp, c * fw, r * fh, fw, fh, destX, destY, displayWidth, displayHeight); ctx.restore();

            ctx.fillStyle = "white"; ctx.font = `${this.game.isLandscape ? 60 * this.game.screenScale : 180 * this.game.screenScale}px "VT323", monospace`;
            ctx.fillText("<", this.customizeLeftArrowRect.centerX(), this.customizeLeftArrowRect.centerY() + (this.game.isLandscape ? 20 : 60) * this.game.screenScale);
            ctx.fillText(">", this.customizeRightArrowRect.centerX(), this.customizeRightArrowRect.centerY() + (this.game.isLandscape ? 20 : 60) * this.game.screenScale);
            
            const rightCx = this.game.isLandscape ? this.game.canvas.width * 0.70 : this.game.canvas.width / 2;
            ctx.fillStyle = unlocked ? "yellow" : "gray"; ctx.font = `${this.game.isLandscape ? 60 * this.game.screenScale : 90 * this.game.screenScale}px "VT323", monospace`;
            ctx.fillText(title, rightCx, this.game.isLandscape ? 350 * this.game.screenScale : destY + displayHeight + 120 * this.game.screenScale);

            ctx.fillStyle = unlocked ? "white" : "darkgray"; ctx.font = `${this.game.isLandscape ? 35 * this.game.screenScale : 45 * this.game.screenScale}px "VT323", monospace`;
            let specY = this.game.isLandscape ? 450 * this.game.screenScale : destY + displayHeight + 180 * this.game.screenScale;
            
            const liveDescLines = this.wrapText(ctx, desc, this.game.isLandscape ? this.game.canvas.width * 0.45 : this.game.canvas.width - 200 * this.game.screenScale);
            for (const line of liveDescLines) { ctx.fillText(line, rightCx, specY); specY += (this.game.isLandscape ? 45 : 55) * this.game.screenScale; }

            ctx.font = `${this.game.isLandscape ? 50 * this.game.screenScale : 78 * this.game.screenScale}px "VT323", monospace`;
            const statusY = specY + (this.game.isLandscape ? 40 : 60) * this.game.screenScale;
            
            if (this.game.currentShipIndex === this.game.activeShipIndex) { ctx.fillStyle = "yellow"; ctx.fillText("SELECTED", rightCx, statusY); } 
            else if (unlocked) { ctx.fillStyle = "lime"; ctx.fillText("TAP TO SELECT", rightCx, statusY); } 
            else {
                ctx.fillStyle = "red"; ctx.fillText("LOCKED", rightCx, statusY);
                ctx.fillStyle = "cyan"; ctx.font = `${this.game.isLandscape ? 35 * this.game.screenScale : 45 * this.game.screenScale}px "VT323", monospace`;
                let condY = statusY + (this.game.isLandscape ? 55 : 80) * this.game.screenScale;
                const liveCondLines = this.wrapText(ctx, cond, this.game.isLandscape ? this.game.canvas.width * 0.40 : this.game.canvas.width - 200 * this.game.screenScale);
                for (const line of liveCondLines) { ctx.fillText(line, rightCx, condY); condY += (this.game.isLandscape ? 45 : 55) * this.game.screenScale; }
            }
        }
        ctx.fillStyle = "white"; ctx.font = `${this.game.isLandscape ? 50 * this.game.screenScale : 75 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText(`Ship ${this.game.currentShipIndex + 1} / ${this.game.shipResIds.length}`, this.game.canvas.width / 2, this.game.canvas.height - (this.game.isLandscape ? 80 : 150) * this.game.screenScale);
    }

    public drawTutorialScreen(ctx: CanvasRenderingContext2D, page: number) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "white"; ctx.font = `${this.game.isLandscape ? 90 * this.game.screenScale : 130 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText("TUTORIAL", this.game.canvas.width / 2, this.game.isLandscape ? 160 * this.game.screenScale : 230 * this.game.screenScale);

        let y = this.game.isLandscape ? 350 * this.game.screenScale : 500 * this.game.screenScale;
        
        if (page < 3) {
            ctx.font = `${this.game.isLandscape ? 45 * this.game.screenScale : 78 * this.game.screenScale}px "VT323", monospace`;
            if (this.game.tutorialPages.length > 0 && page < this.game.tutorialPages.length) {
                for (const line of this.game.tutorialPages[page]) { ctx.fillText(line, this.game.canvas.width / 2, y); y += (this.game.isLandscape ? 60 : 100) * this.game.screenScale; }
            }
        } else if (page === 3) {
            ctx.fillStyle = "yellow";
            ctx.font = `${this.game.isLandscape ? 50 * this.game.screenScale : 70 * this.game.screenScale}px "VT323", monospace`;
            const gap = (this.game.isLandscape ? 80 : 120) * this.game.screenScale;
            ctx.fillText("[ SPACE ] or [ GAMEPAD A ] - Boost / Select", this.game.canvas.width / 2, y); y += gap;
            ctx.fillText("[ ESC ] or [ GAMEPAD B ] - Pause / Back", this.game.canvas.width / 2, y); y += gap;
            ctx.fillText("[ ARROWS ] or [ D-PAD ] - Navigate Menus", this.game.canvas.width / 2, y);
        }
        this.drawGlowText(ctx, (page === this.game.tutorialPages.length - 1) ? "START MISSION" : "NEXT >", this.tutorialNextRect, this.game.isLandscape ? 60 * this.game.screenScale : 112.5 * this.game.screenScale);
    }

    public drawAboutScreen(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        const leftX = this.game.isLandscape ? this.game.canvas.width * 0.15 : this.game.canvas.width / 2;
        ctx.textAlign = this.game.isLandscape ? "left" : "center"; ctx.textBaseline = "middle";

        ctx.fillStyle = "white"; ctx.font = `${this.game.isLandscape ? 90 * this.game.screenScale : 130 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText("ABOUT", leftX, this.game.isLandscape ? 160 * this.game.screenScale : 230 * this.game.screenScale);
        ctx.font = `${this.game.isLandscape ? 45 * this.game.screenScale : 75 * this.game.screenScale}px "VT323", monospace`;
        
        let y = this.game.isLandscape ? 400 * this.game.screenScale : 500 * this.game.screenScale - this.game.aboutScrollY;
        for (const line of this.wrappedAboutText) { ctx.fillText(line, leftX, y); y += (this.game.isLandscape ? 55 : 95) * this.game.screenScale; }
        
        ctx.fillStyle = "yellow"; ctx.font = `${this.game.isLandscape ? 40 * this.game.screenScale : 48.75 * this.game.screenScale}px "VT323", monospace`;
        for (const line of this.wrappedAboutDeveloperText) { ctx.fillText(line, leftX, y + 50 * this.game.screenScale); y += (this.game.isLandscape ? 50 : 60) * this.game.screenScale; }
        
        this.drawGlowText(ctx, "PRIVACY POLICY", this.aboutPrivacyRect, this.game.isLandscape ? 40 * this.game.screenScale : 80 * this.game.screenScale);
        this.drawGlowText(ctx, "BACK", this.aboutBackRect, this.game.isLandscape ? 50 * this.game.screenScale : 112 * this.game.screenScale);
    }

    public drawTokenomicsScreen(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        const leftX = this.game.isLandscape ? this.game.canvas.width * 0.15 : this.game.canvas.width / 2;
        ctx.textAlign = this.game.isLandscape ? "left" : "center"; ctx.textBaseline = "middle";

        ctx.fillStyle = "white"; ctx.font = `${this.game.isLandscape ? 90 * this.game.screenScale : 130 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText("TOKENOMICS", leftX, this.game.isLandscape ? 160 * this.game.screenScale : 230 * this.game.screenScale);
        
        ctx.fillStyle = "cyan";
        ctx.font = `${this.game.isLandscape ? 45 * this.game.screenScale : 70 * this.game.screenScale}px "VT323", monospace`;
        let y = this.game.isLandscape ? 300 * this.game.screenScale : 450 * this.game.screenScale - this.game.tokenomicsScrollY;
        
        for (const line of this.wrappedTokenomicsText) { 
            ctx.fillText(line, leftX, y); 
            y += (this.game.isLandscape ? 55 : 85) * this.game.screenScale; 
        }
        
        this.drawGlowText(ctx, "BACK", this.tokenomicsBackRect, this.game.isLandscape ? 50 * this.game.screenScale : 112 * this.game.screenScale);
    }

    public drawGameOverScreenContent(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = `${this.game.isLandscape ? 150 * this.game.screenScale : 200 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText("GAME OVER", this.game.canvas.width / 2, this.game.canvas.height * (this.game.isLandscape ? 0.30 : 0.18));

        let cy = this.game.canvas.height * (this.game.isLandscape ? 0.45 : 0.28);
        ctx.font = `${this.game.isLandscape ? 80 * this.game.screenScale : 110 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText(this.game.scoreStr, this.game.canvas.width / 2, cy); cy += (this.game.isLandscape ? 90 : 100) * this.game.screenScale;
        
        ctx.fillStyle = "cyan"; ctx.font = `${this.game.isLandscape ? 60 * this.game.screenScale : 80 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText(this.game.highScoreStr, this.game.canvas.width / 2, cy); cy += (this.game.isLandscape ? 70 : 90) * this.game.screenScale;

        ctx.fillStyle = "white"; ctx.font = `${this.game.isLandscape ? 45 * this.game.screenScale : 60 * this.game.screenScale}px "VT323", monospace`;
        ctx.fillText("DIFFICULTY: " + Difficulty[this.game.currentDifficulty], this.game.canvas.width / 2, cy); cy += (this.game.isLandscape ? 50 : 70) * this.game.screenScale;
        ctx.fillText(this.game.obstacleStatusStr, this.game.canvas.width / 2, cy); cy += (this.game.isLandscape ? 80 : 100) * this.game.screenScale;

        ctx.fillStyle = "#FF6666"; ctx.font = `${this.game.isLandscape ? 40 * this.game.screenScale : 50 * this.game.screenScale}px "VT323", monospace`;
        if (this.game.currentDeathQuote && this.game.currentDeathQuote !== this.cachedDeathQuote[0]) {
            this.cachedDeathQuote = this.wrapText(ctx, this.game.currentDeathQuote, this.game.canvas.width - 150 * this.game.screenScale);
        }
        for (const line of this.cachedDeathQuote) { ctx.fillText(line, this.game.canvas.width / 2, cy); cy += (this.game.isLandscape ? 45 : 60) * this.game.screenScale; }

        if (!this.game.usedRecovery) { 
            const balanceLabel = (this.game.tokenBalance < this.game.REVIVE_COST && !this.game.isDevMode) ? "LOCKED" : `REVIVE (${this.game.REVIVE_COST.toLocaleString()})`;
            this.drawGlowText(ctx, balanceLabel, this.recoverBtnRect, this.game.isLandscape ? 35 * this.game.screenScale : 75 * this.game.screenScale); 
        }
        this.drawGlowText(ctx, "RESTART", this.restartBtnRect, this.game.isLandscape ? 50 * this.game.screenScale : 130 * this.game.screenScale);
        this.drawGlowText(ctx, "MENU", this.gameOverMenuRect, this.game.isLandscape ? 50 * this.game.screenScale : 120 * this.game.screenScale);
    }

    public drawPauseOverlay(ctx: CanvasRenderingContext2D) { 
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0,0,this.game.canvas.width, this.game.canvas.height);
        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `${this.game.isLandscape ? 150 * this.game.screenScale : 225 * this.game.screenScale}px "VT323", monospace`; 
        ctx.fillText("PAUSED", this.game.canvas.width / 2, (this.game.canvas.height / 2) - (this.game.isLandscape ? 80 * this.game.screenScale : 150 * this.game.screenScale)); 
        this.drawGlowText(ctx, "TAP TO RESUME", this.pauseResumeRect, this.game.isLandscape ? 60 * this.game.screenScale : 112.5 * this.game.screenScale); 
        this.drawGlowText(ctx, "SETTINGS", this.pauseSettingsRect, this.game.isLandscape ? 50 * this.game.screenScale : 90 * this.game.screenScale); 
        this.drawGlowText(ctx, "MENU", this.pauseMenuRect, this.game.isLandscape ? 50 * this.game.screenScale : 90 * this.game.screenScale); 
    }
    
    public drawCountdownOverlay(ctx: CanvasRenderingContext2D, countdownValue: number) { 
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0,0,this.game.canvas.width, this.game.canvas.height);
        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `${this.game.isLandscape ? 250 * this.game.screenScale : 450 * this.game.screenScale}px "VT323", monospace`; 
        if (countdownValue > 0) ctx.fillText(countdownValue.toString(), this.game.canvas.width / 2, this.game.canvas.height / 2); 
    }

    public drawGame(ctx: CanvasRenderingContext2D) {
        if (this.game.velocity < 0 && this.playerBitmap && this.flameBitmap && this.flameBitmap.complete) {
            ctx.save(); ctx.translate(this.game.birdX, this.game.birdY); ctx.rotate(this.game.shipRotation * Math.PI / 180);
            const flameOffset = (this.game.isLandscape ? 60 : 80) * this.game.screenScale;
            ctx.drawImage(this.flameBitmap, -(this.playerWidth / 2) - this.flameWidth + flameOffset, -(this.flameHeight / 2), this.flameWidth, this.flameHeight);
            ctx.restore();
        }
        if (this.playerBitmap && this.playerBitmap.complete) {
            ctx.save(); ctx.translate(this.game.birdX, this.game.birdY); ctx.rotate(this.game.shipRotation * Math.PI / 180);
            let cols = 1, rows = 1;
            const sheetAspect = this.playerBitmap.height / this.playerBitmap.width;
            if (sheetAspect > 1.1 && sheetAspect < 1.3) { cols = 10; rows = 12; }
            const fw = this.playerBitmap.width / cols, fh = this.playerBitmap.height / rows;
            const aspect = fh / fw, shipProportion = 1.3, visualHeight = this.playerWidth * aspect * shipProportion;
            ctx.drawImage(this.playerBitmap, 0, 0, fw, fh, -(this.playerWidth / 2), -(visualHeight / 2), this.playerWidth, visualHeight);
            ctx.restore();
        }
        if (this.game.hasShield) {
            const pf = (Math.sin(Date.now() / 200.0) + 1) / 2, pr = (this.playerWidth * 0.65) + (pf * 15 * this.game.screenScale);
            ctx.beginPath(); ctx.arc(this.game.birdX, this.game.birdY, pr, 0, 2 * Math.PI);
            ctx.lineWidth = 10 * this.game.screenScale; ctx.strokeStyle = "rgba(0, 255, 255, 0.4)"; ctx.stroke();
        }
        for (const ob of this.game.obstacles) { ob.draw(ctx, this.game.laserColors[this.game.laserColorIndex], this.game.canvas.height); }
    }

    public drawHUD(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "white"; ctx.font = `${this.game.isLandscape ? 40 * this.game.screenScale : 49 * this.game.screenScale}px "VT323", monospace`;
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillText(this.game.scoreStr, 50 * this.game.screenScale, this.game.isLandscape ? 80 * this.game.screenScale : 120 * this.game.screenScale);
        ctx.fillText(this.game.highScoreStr, 50 * this.game.screenScale, this.game.isLandscape ? 130 * this.game.screenScale : 180 * this.game.screenScale);
        this.drawGlowText(ctx, "||", this.hudPauseRect, this.game.isLandscape ? 50 * this.game.screenScale : 70 * this.game.screenScale);
        ctx.textAlign = "right"; ctx.fillStyle = "cyan";
        ctx.fillText(this.game.shieldStr, this.game.canvas.width - 50 * this.game.screenScale, this.game.isLandscape ? 80 * this.game.screenScale : 120 * this.game.screenScale);
    }
}