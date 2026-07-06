import { AudioEngine } from './AudioEngine';
import { SceneRenderer } from './SceneRenderer';
import { Obstacle } from './Obstacle';
// NOTE: @solana/web3.js and @solana/spl-token are loaded lazily inside
// executeBurnTransaction() via dynamic import. Importing them at the top
// level runs their module code at page load, and in a browser bundle that
// can crash immediately ("Buffer is not defined" / "process is not defined")
// before the game constructor ever runs -> black screen.

export enum GameState { LOADING, MENU, PLAYING, GAME_OVER, SETTINGS, ABOUT, PAUSED, COUNTDOWN, CUSTOMIZE, TUTORIAL, HANGAR, LEADERBOARDS, TOKENOMICS }
export enum Difficulty { EASY, MEDIUM, HARD }

export class Particle {
    x: number; y: number; vx: number; vy: number; color: string; alpha: number = 255;
    constructor(x: number, y: number, color: string, screenScale: number) {
        this.x = x; this.y = y; this.color = color;
        this.vx = (Math.random() - 0.5) * 10 * screenScale; this.vy = (Math.random() - 0.5) * 10 * screenScale;
    }
    update(dt: number) { const efm = 60 * dt; this.x += this.vx * efm; this.y += this.vy * efm; this.alpha -= 5 * efm; }
}

export class GameView {
    public canvas: HTMLCanvasElement; public ctx: CanvasRenderingContext2D;
    public audio: AudioEngine; public renderer: SceneRenderer;

    public currentState: GameState = GameState.LOADING;
    public stateBeforeSettings: GameState = GameState.MENU;
    public currentDifficulty: Difficulty = Difficulty.EASY;
    public obstacleMode: number = Obstacle.TYPE_LASER;

    public birdY: number = 600; public birdX: number = 200;
    public velocity: number = 0; public gravity: number = 3.0; public jumpForce: number = -20.0;
    public shipRotation: number = 0; public pipeSpeed: number = 12;
    public missileTrackingMultiplier: number = 1.0;
    public isBoosting: boolean = false; public hasStartedFalling: boolean = false;

    public score: number = 0; public highScore: number = 0;
    public shieldCount: number = 0; public hasShield: boolean = false;
    public bladesPassed: number = 0; public missilesPassed: number = 0;
    
    public shipResIds = ['fighter_jet.png', 'ship1.png', 'ship2.png', 'ship3.png', 'ship4.png', 'ship5.png'];
    public activeShipIndex: number = 0; public currentShipIndex: number = 0;
    public unlockedShips: boolean[] = [true, false, false, false, false, false];
    private memoryStorage: { [key: string]: string } = {};

    // ==========================================
    // --- WEB3, BURN & TOKENIZATION CONFIG ---
    // ==========================================
    public isDevMode: boolean = false; // SET TO FALSE FOR PRODUCTION
    
    // --> ADD YOUR LAUNCH ADDRESSES HERE <--
    public readonly CONTRACT_ADDRESS = "YOUR_CA_HERE";
    public readonly TARGET_TOKEN_MINT = "YOUR_TOKEN_MINT_ADDRESS_HERE";
    public readonly BURN_WALLET_ADDRESS = "11111111111111111111111111111111"; // Standard Solana Incinerator
    
    // RPC endpoint used for all on-chain reads/writes.
    // NOTE: The public mainnet endpoint is heavily rate-limited and often rejects
    // sendTransaction. For production, use a Helius/QuickNode/Triton endpoint.
    public readonly SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
    
    public walletConnected: boolean = false;
    public userPublicKey: string = "";
    public watchOnlyMode: boolean = false; // true when connected via pasted address (pump.fun wallet) - no signing possible
    public tokenBalance: number = 0;
    public readonly REVIVE_COST = 1000; 
    
    public rewardUnlockUntil: number = 0; // epoch ms; nonzero while this pilot holds an active leaderboard reward

    public activePilotsStr = "Syncing...";
    public tokensBurnedStr = "Syncing...";
    public caCopiedTimer: number = 0;
    public burnInProgress: boolean = false;

    // --- LIVE GLOBAL STATS ---
    // pump.fun standard launch supply. "Burned" = INITIAL - live on-chain supply.
    public readonly INITIAL_TOKEN_SUPPLY = 1000000000;
    private presenceSessionId: string =
        (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
            ? (crypto as any).randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    private presenceTimer: any = null;
    private statsTimer: any = null;

    // Unlock Thresholds: [Laser, Blade, Missile]
    public readonly shipTokenThresholds = [0, 50000, 250000, 750000, 2500000, 10000000];
    public readonly bgTokenThresholds = [0, 150000, 600000]; 
    public readonly obsTokenThresholds = [0, 100000, 500000]; 
    // ==========================================

    public bgColorIndex: number = 0; public laserColorIndex: number = 4;
    public laserColors: string[] = ['red', 'green', 'blue', 'yellow', 'white'];
    public laserColorNames: string[] = ['RED', 'GREEN', 'BLUE', 'YELLOW', 'WHITE'];
    public bgImageIds = ['bg_black.png', 'bg_orange.png', 'bg_violet.png'];
    public bgImageNames: string[] = ["ASTEROID FIELD", "SHIP GRAVEYARD", "COMET SHOWER"];
    public currentFps: number = 60; public currentOrientation: number = 1; 

    public currentDeathQuote: string = ""; public scoreStr: string = "Score: 0";
    public highScoreStr: string = "Best: 0"; public shieldStr: string = "";
    public musicStatusStr: string = "MUSIC: ON"; public sfxStatusStr: string = "SFX: ON";
    public diffStatusStr: string = "DIFFICULTY: EASY"; public obstacleStatusStr: string = "OBSTACLES: LASER";

    public screenScale: number = 1.0; public isLandscape: boolean = false;
    private BASE_DIMENSION: number = 1080; private lastFrameTime: number = 0;
    public frameCount: number = 0; public obstacles: Obstacle[] = []; public particles: Particle[] = [];

    public countdownValue: number = 3; private lastCountdownUpdate: number = 0;
    public currentTutorialPage: number = 0; public tutorialPages: string[][] = [];
    public hangarFrameIndex: number = 0; private lastHangarFrameTime: number = 0;
    public shakeTimer: number = 0; 
    
    public aboutScrollY: number = 0;
    public tokenomicsScrollY: number = 0;
    public leaderboardScrollX: number = 0;
    public leaderboardScrollY: number[] = [0,0,0,0,0,0,0,0,0];
    public leaderboardsLoading: boolean = false;
    public leaderboardsData: any[][] = [[],[],[],[],[],[],[],[],[]];
    private isDragging: boolean = false;
    private dragStartX: number = 0;
    private dragStartY: number = 0;

    public usedRecovery: boolean = false;
    private lastGamepadState: boolean[] = [];

    // --- SECURE TELEMETRY & SUPABASE ARCHITECTURE ---
    private supabaseUrl = 'https://drawbbapvytjytvbedtl.supabase.co';
    private supabaseKey = 'sb_publishable_zzdZsO1BCunEfdGwur6M4g_nUjW5pa2';
    private sessionPlayerName = `Guest_${Math.floor(Math.random() * 9000) + 1000}`;
    private boardIds = ["easy_laser", "easy_blade", "easy_missile", "medium_laser", "medium_blade", "medium_missile", "hard_laser", "hard_blade", "hard_missile"];
    
    // Path A Ledger
    private telemetryLog: number[] = [];
    private runStartTime: number = 0;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.audio = new AudioEngine();
        this.renderer = new SceneRenderer(this);

        if (document.fonts) {
            document.fonts.load('10px "VT323"').then(async () => {
                window.addEventListener('resize', () => this.handleResize());
                this.handleResize(); 
                this.setupInputs();
                
                await this.loadGameData();
                this.fetchGlobalStats(); // Fetch Active Pilots & Burn amount
                this.startPresenceHeartbeat(); // Register this player + keep stats live
                
                requestAnimationFrame((timestamp) => this.loop(timestamp));

                setTimeout(async () => {
                    const tutorialSeen = await this.getData('tutorialSeen');
                    if (!tutorialSeen) {
                        this.stateBeforeSettings = GameState.MENU;
                        this.currentState = GameState.TUTORIAL;
                    } else {
                        this.currentState = GameState.MENU;
                    }
                    this.audio.playThemeMusic(this.bgColorIndex);
                }, 1500);
            });
        }
    }

    private async setData(key: string, value: string) {
        this.memoryStorage[key] = value;
        try { localStorage.setItem(key, value); } catch (e) {}
    }

    private async getData(key: string): Promise<string | null> {
        try { const val = localStorage.getItem(key); if (val !== null && val !== undefined) return val; } catch (e) {}
        return this.memoryStorage[key] || null;
    }

    // The single source of truth for this player's leaderboard identity.
    // Score submission and reward lookup MUST use the same name.
    private get leaderboardPlayerName(): string {
        return this.walletConnected && this.userPublicKey ? `WL_${this.userPublicKey.substring(0, 6)}` : this.sessionPlayerName;
    }

    // ============================================================
    // --- SECURE PATH A: TELEMETRY VALIDATION SYSTEM ---
    // ============================================================
    public async saveHighScore() {
        const key = this.getHighScoreKey(this.currentDifficulty, this.obstacleMode);
        await this.submitTelemetryToEdgeFunction(this.currentDifficulty, this.obstacleMode);
        
        if (this.score > this.highScore) { 
            this.highScore = this.score; 
            this.highScoreStr = `Best: ${this.highScore}`; 
            await this.setData(key, this.score.toString()); 
        }
    }

    private async submitTelemetryToEdgeFunction(diff: Difficulty, mode: number) {
        if (this.telemetryLog.length === 0) return;
        
        const boardKey = this.boardIds[(diff * 3) + mode];
        const playerName = this.leaderboardPlayerName;
        const edgeFunctionUrl = `${this.supabaseUrl}/functions/v1/validate-score`;

        try {
            await fetch(edgeFunctionUrl, { 
                method: 'POST', 
                headers: { 
                    'apikey': this.supabaseKey, 
                    'Content-Type': 'application/json' 
                }, 
                body: JSON.stringify({ board_id: boardKey, player_name: playerName, telemetry: this.telemetryLog }) 
            });
            console.log("[SECURITY] Telemetry package transmitted to Supabase Edge Function.");
        } catch (e) {
            console.error("[SECURITY] Telemetry transmission failed", e);
        }
    }

    public fetchLeaderboards() {
        this.leaderboardsLoading = true;
        const headers = { 'apikey': this.supabaseKey, 'Authorization': `Bearer ${this.supabaseKey}` };

        const fetches = this.boardIds.map((key, index) => 
            fetch(`${this.supabaseUrl}/rest/v1/leaderboards?board_id=eq.${key}&select=player_name,score&order=score.desc&limit=50`, { headers })
            .then(res => res.json())
            .then(data => { 
                this.leaderboardsData[index] = data.map((row: any, i: number) => ({ rank: i + 1, player: { name: row.player_name }, score: row.score })); 
            })
            .catch(() => { this.leaderboardsData[index] = []; }) 
        );

        Promise.all(fetches).then(() => { this.leaderboardsLoading = false; });
    }

    // ============================================================
    // --- LIVE GLOBAL STATS: ACTIVE PILOTS & TOKENS BURNED ---
    // ============================================================
    // Active Pilots: every client sends a heartbeat to Supabase every 45s
    //   (RPC `pilot_heartbeat`). The live count is sessions seen in the last
    //   2 minutes (RPC `get_active_pilots`). See the SQL setup script.
    // Tokens Burned: read directly from the blockchain. Since revives use the
    //   SPL `burn` instruction, total supply shrinks with every revive, so
    //   burned = INITIAL_TOKEN_SUPPLY - current on-chain supply. Trustless,
    //   always accurate, no database needed.
    private fetchGlobalStats() {
        this.fetchActivePilots();
        this.fetchTokensBurned();
        this.fetchActiveReward();
    }

    // Checks whether this pilot currently holds a daily top-3 or weekly
    // top-10 leaderboard reward (granted server-side by scheduled jobs).
    public async fetchActiveReward() {
        try {
            const res = await fetch(`${this.supabaseUrl}/rest/v1/rpc/get_active_reward`, {
                method: 'POST',
                headers: { 'apikey': this.supabaseKey, 'Authorization': `Bearer ${this.supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ p_player: this.leaderboardPlayerName })
            });
            const expires = await res.json(); // ISO timestamp or null
            this.rewardUnlockUntil = (typeof expires === 'string') ? new Date(expires).getTime() : 0;
            await this.evaluateShipUnlocks(); this.updateStringCache();
        } catch (e) { /* RPC not deployed yet or network failure - unlocks fall back to token balance */ }
    }

    private async fetchActivePilots() {
        try {
            const res = await fetch(`${this.supabaseUrl}/rest/v1/rpc/get_active_pilots`, {
                method: 'POST',
                headers: { 'apikey': this.supabaseKey, 'Authorization': `Bearer ${this.supabaseKey}`, 'Content-Type': 'application/json' },
                body: '{}'
            });
            const count = await res.json();
            if (typeof count === 'number') {
                this.activePilotsStr = `${count.toLocaleString()} Active Pilot${count === 1 ? '' : 's'}`;
                return;
            }
            throw new Error('Unexpected response');
        } catch (e) {
            // RPC not deployed yet, or network failure
            if (this.isDevMode) { this.activePilotsStr = `1 Active Pilot (dev)`; }
            else { this.activePilotsStr = `-- Active Pilots`; }
        }
    }

    private async fetchTokensBurned() {
        try {
            const res = await fetch(this.SOLANA_RPC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenSupply', params: [this.TARGET_TOKEN_MINT] })
            });
            const data = await res.json();
            const supply = data.result?.value?.uiAmount;
            if (typeof supply === 'number') {
                const burned = Math.max(0, this.INITIAL_TOKEN_SUPPLY - supply);
                this.tokensBurnedStr = `${this.formatCompact(burned)} Tokens Burned`;
                return;
            }
            throw new Error(data.error?.message || 'Invalid mint');
        } catch (e) {
            // Placeholder mint (dev), rate-limited RPC, or network failure
            if (this.isDevMode) { this.tokensBurnedStr = `0 Tokens Burned (dev)`; }
            else { this.tokensBurnedStr = `-- Tokens Burned`; }
        }
    }

    private formatCompact(n: number): string {
        if (n >= 1000000000) return (n / 1000000000).toFixed(2).replace(/\.?0+$/, '') + 'B';
        if (n >= 1000000) return (n / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.?0+$/, '') + 'K';
        return Math.floor(n).toString();
    }

    // Registers this session as "online" and keeps both stats fresh.
    private startPresenceHeartbeat() {
        const beat = () => {
            if (document.visibilityState === 'hidden') return; // tabbed-out players drop off the count
            fetch(`${this.supabaseUrl}/rest/v1/rpc/pilot_heartbeat`, {
                method: 'POST',
                headers: { 'apikey': this.supabaseKey, 'Authorization': `Bearer ${this.supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ p_session_id: this.presenceSessionId })
            }).catch(() => { /* non-critical */ });
        };
        beat();
        if (this.presenceTimer) clearInterval(this.presenceTimer);
        this.presenceTimer = setInterval(beat, 45000); // heartbeat every 45s (< 2 min window)

        if (this.statsTimer) clearInterval(this.statsTimer);
        this.statsTimer = setInterval(() => {
            if (this.currentState === GameState.MENU) this.fetchGlobalStats(); // refresh only where it's visible
        }, 60000);
    }

    // ============================================================
    // --- ON-CHAIN BURN LOGIC FOR REVIVES ---
    // ============================================================
    // Uses the SPL Token `burn` instruction, which permanently destroys tokens
    // and reduces the mint's total supply (truly deflationary — better than
    // transferring to an incinerator wallet, and no destination ATA is needed).
    //
    // Requires:  npm install @solana/web3.js @solana/spl-token
    private async executeBurnTransaction(amount: number): Promise<boolean> {
        if (this.isDevMode) {
            this.tokenBalance -= amount;
            console.log(`[DEV MODE] Simulated burn of ${amount} tokens.`);
            return true;
        }

        if (!this.walletConnected || !this.userPublicKey) {
            console.error("[BURN] Wallet not connected");
            return false;
        }

        if (this.watchOnlyMode) {
            // A pasted address can't sign transactions - burns are impossible.
            console.warn("[BURN] Watch-only mode: cannot sign transactions.");
            this.showToast("WATCH MODE: revives need a signing wallet. Import your pump.fun key into Phantom, then reconnect.", 6000);
            return false;
        }

        const provider = (window as any).activeSolanaProvider;
        if (!provider) {
            console.error("[BURN] No active wallet provider found");
            return false;
        }

        // Re-entrancy guard: prevent double-taps firing two wallet popups
        if (this.burnInProgress) return false;
        this.burnInProgress = true;

        try {
            // --- LAZY LOAD WEB3 LIBRARIES (keeps game boot independent of them) ---
            // Polyfill Node globals BEFORE web3.js module code evaluates.
            const w = window as any;
            if (typeof w.global === 'undefined') w.global = window;
            if (typeof w.process === 'undefined') w.process = { env: {} };
            if (typeof w.Buffer === 'undefined') {
                try { const bufferMod = await import('buffer'); w.Buffer = bufferMod.Buffer; }
                catch (e) { console.warn("[BURN] 'buffer' polyfill package not installed (npm i buffer)"); }
            }

            const { Connection, PublicKey, Transaction } = await import('@solana/web3.js');
            const { createBurnInstruction } = await import('@solana/spl-token');
            // ----------------------------------------------------------------------

            const connection = new Connection(this.SOLANA_RPC_URL, 'confirmed');
            const owner = new PublicKey(this.userPublicKey);
            const mint = new PublicKey(this.TARGET_TOKEN_MINT);

            // 1. Locate the user's token account for this mint.
            //    Parsed response gives us the account address, live balance,
            //    decimals, AND the owning token program (SPL vs Token-2022).
            const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint });
            if (resp.value.length === 0) {
                console.error("[BURN] User holds no token account for this mint");
                return false;
            }

            const tokenAccountPubkey = resp.value[0].pubkey;
            const tokenProgramId = resp.value[0].account.owner; // handles Token-2022 mints too
            const parsedInfo = resp.value[0].account.data.parsed.info;
            const decimals: number = parsedInfo.tokenAmount.decimals;
            const uiBalance: number = parsedInfo.tokenAmount.uiAmount || 0;

            // 2. Verify live on-chain balance (never trust the cached UI number).
            if (uiBalance < amount) {
                console.error(`[BURN] Insufficient on-chain balance: ${uiBalance} < ${amount}`);
                this.tokenBalance = uiBalance; // resync the stale cache
                await this.evaluateShipUnlocks(); this.updateStringCache();
                return false;
            }

            // 3. Convert UI amount -> raw base units (amount * 10^decimals).
            //    BigInt math avoids float precision loss on high-decimal mints.
            const rawAmount = BigInt(amount) * (10n ** BigInt(decimals));

            // 4. Build the burn instruction and transaction.
            const burnIx = createBurnInstruction(
                tokenAccountPubkey,  // account holding the tokens
                mint,                // the mint being burned
                owner,               // authority (the user signs)
                rawAmount,
                [],                  // no multisig signers
                tokenProgramId       // SPL Token or Token-2022
            );

            const transaction = new Transaction().add(burnIx);
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = owner;

            // 5. Sign & send. Phantom / Solflare / Backpack all expose
            //    signAndSendTransaction; fall back to signTransaction + manual send.
            let signature: string;
            if (typeof provider.signAndSendTransaction === 'function') {
                const result = await provider.signAndSendTransaction(transaction);
                signature = typeof result === 'string' ? result : result.signature;
            } else {
                const signed = await provider.signTransaction(transaction);
                signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
            }

            console.log(`[BURN] Transaction sent: ${signature}`);

            // 6. Wait for confirmation before granting the revive.
            const confirmation = await connection.confirmTransaction(
                { signature, blockhash, lastValidBlockHeight },
                'confirmed'
            );
            if (confirmation.value.err) {
                console.error("[BURN] Transaction failed on-chain", confirmation.value.err);
                return false;
            }

            console.log(`[BURN] Confirmed. ${amount} $JMP permanently destroyed. Sig: ${signature}`);

            // 7. Update local state + notify backend (fire-and-forget).
            this.tokenBalance -= amount;
            await this.evaluateShipUnlocks(); this.updateStringCache();
            this.reportBurnToSupabase(amount, signature);
            this.fetchTokensBurned(); // refresh the global burn counter with the new on-chain supply

            return true;
        } catch (e) {
            // Covers: user rejected in wallet popup, RPC failure, blockhash expiry
            console.error("[BURN] Transaction failed or rejected by user", e);
            return false;
        } finally {
            this.burnInProgress = false;
        }
    }

    // Optional: report the confirmed burn to Supabase so the global
    // "Tokens Burned" counter on the main menu reflects real data.
    // The Edge Function should re-verify the signature on-chain before
    // incrementing (never trust the client-reported amount alone).
    private reportBurnToSupabase(amount: number, signature: string) {
        const edgeFunctionUrl = `${this.supabaseUrl}/functions/v1/record-burn`;
        fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: { 'apikey': this.supabaseKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, signature, wallet: this.userPublicKey })
        }).catch(() => { /* non-critical, ignore */ });
    }

    private handleResize() {
        this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
        this.isLandscape = this.canvas.width > this.canvas.height;
        if (this.isLandscape) { this.screenScale = this.canvas.height / this.BASE_DIMENSION; this.birdX = 350 * this.screenScale; } 
        else { this.screenScale = this.canvas.width / this.BASE_DIMENSION; this.birdX = 200 * this.screenScale; }
        this.birdY = this.canvas.height / 2.0;
        if (!this.isLandscape && (this.currentState === GameState.PLAYING || this.currentState === GameState.COUNTDOWN)) {
            this.currentState = GameState.PAUSED; // rotating away mid-run pauses instead of killing the pilot
        }
        this.renderer.initBitmaps(this.canvas.width, this.canvas.height);
        this.renderer.updateLayout(); this.applyDifficulty();
    }

    private async loadGameData() {
        const ship = await this.getData('activeShipIndex'); this.activeShipIndex = parseInt(ship || '0') || 0; this.currentShipIndex = this.activeShipIndex;
        const bg = await this.getData('bgColorIndex'); this.bgColorIndex = parseInt(bg || '0') || 0; 
        const laser = await this.getData('laserColorIndex'); this.laserColorIndex = parseInt(laser || '4') || 4;
        const savedDiff = await this.getData('difficulty'); const diffVal = parseInt(savedDiff || '0') || 0;
        this.currentDifficulty = diffVal === 0 ? Difficulty.EASY : (diffVal === 1 ? Difficulty.MEDIUM : Difficulty.HARD);
        const savedObs = await this.getData('obstacle_mode'); this.obstacleMode = parseInt(savedObs || '0') || 0;

        // Restore a previously saved watch-mode wallet (pump.fun / pasted address)
        const watchAddr = await this.getData('watchAddress');
        if (!this.isDevMode && watchAddr && this.isValidSolanaAddress(watchAddr)) {
            this.userPublicKey = watchAddr; this.walletConnected = true; this.watchOnlyMode = true;
            this.syncOnChainTokenBalance(); // async, fire-and-forget
        }

        this.updateStringCache(); await this.loadHighScore(); await this.evaluateShipUnlocks();
    }

    private getHighScoreKey(diff: Difficulty, mode: number): string {
        const diffStr = diff === Difficulty.EASY ? "EASY" : (diff === Difficulty.MEDIUM ? "MEDIUM" : "HARD");
        const modeStr = mode === Obstacle.TYPE_LASER ? "LASER" : (mode === Obstacle.TYPE_BLADE ? "BLADE" : "MISSILE");
        return `HIGHSCORE_${diffStr}_${modeStr}`;
    }

    private async loadHighScore() { const best = await this.getData(this.getHighScoreKey(this.currentDifficulty, this.obstacleMode)); this.highScore = parseInt(best || '0') || 0; this.highScoreStr = `Best: ${this.highScore}`; }

    private applyDifficulty() {
        if (this.isLandscape) {
            this.gravity = 0.75 * this.screenScale; this.jumpForce = -11.0 * this.screenScale;
            let laserBase = 0, otherBase = 0;
            switch (this.currentDifficulty) { case Difficulty.EASY: laserBase = 19.2; otherBase = 9.6; this.missileTrackingMultiplier = 0.18; break; case Difficulty.MEDIUM: laserBase = 24.0; otherBase = 14.4; this.missileTrackingMultiplier = 0.42; break; case Difficulty.HARD: laserBase = 28.8; otherBase = 19.2; this.missileTrackingMultiplier = 0.72; break; }
            this.pipeSpeed = (this.obstacleMode === Obstacle.TYPE_LASER ? laserBase : otherBase) * this.screenScale;
        } else {
            this.gravity = 1.5 * this.screenScale; this.jumpForce = -22.0 * this.screenScale;
            let laserBase = 0, otherBase = 0;
            switch (this.currentDifficulty) { case Difficulty.EASY: laserBase = 24.0; otherBase = 12.0; this.missileTrackingMultiplier = 0.48; break; case Difficulty.MEDIUM: laserBase = 30.0; otherBase = 18.0; this.missileTrackingMultiplier = 0.96; break; case Difficulty.HARD: laserBase = 36.0; otherBase = 24.0; this.missileTrackingMultiplier = 1.38; break; }
            this.pipeSpeed = (this.obstacleMode === Obstacle.TYPE_LASER ? laserBase : otherBase) * this.screenScale;
        }
        this.loadHighScore();
    }

    public updateStringCache() {
        this.musicStatusStr = `MUSIC: ${this.audio.isMusicEnabled ? "ON" : "OFF"}`; this.sfxStatusStr = `SFX: ${this.audio.isSfxEnabled ? "ON" : "OFF"}`;
        this.diffStatusStr = `DIFFICULTY: ${Difficulty[this.currentDifficulty]}`; this.obstacleStatusStr = `OBSTACLES: ${this.obstacleMode === 0 ? "LASER" : (this.obstacleMode === 1 ? "BLADE" : "MISSILE")}`;
        this.scoreStr = `Score: ${this.score}`; this.shieldStr = `SHIELD: ${this.shieldCount}`;
    }

    public triggerSpark(x: number, y: number) { if (this.particles.length < 10) this.particles.push(new Particle(x, y, "yellow", this.screenScale)); }

    private setupInputs() {
        window.addEventListener('pointerdown', (e) => { if (document.getElementById("arcade-wallet-modal") || document.getElementById("intro-video-overlay")) return; this.isDragging = true; this.dragStartX = e.clientX; this.dragStartY = e.clientY; this.handleInput(e.clientX, e.clientY); });
        window.addEventListener('pointermove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.dragStartX; const dy = e.clientY - this.dragStartY;
            this.dragStartX = e.clientX; this.dragStartY = e.clientY;
            if (this.currentState === GameState.ABOUT) this.aboutScrollY -= dy * 1.5;
            else if (this.currentState === GameState.TOKENOMICS) this.tokenomicsScrollY -= dy * 1.5;
            else if (this.currentState === GameState.LEADERBOARDS) {
                this.leaderboardScrollX -= dx * 1.5;
                const page = Math.max(0, Math.min(8, Math.round(this.leaderboardScrollX / this.canvas.width)));
                this.leaderboardScrollY[page] -= dy * 1.5;
            }
        });
        window.addEventListener('pointerup', () => { 
            this.isBoosting = false; this.isDragging = false; 
            if (this.currentState === GameState.LEADERBOARDS) { this.leaderboardScrollX = Math.max(0, Math.min(8, Math.round(this.leaderboardScrollX / this.canvas.width))) * this.canvas.width; }
        });
        window.addEventListener('keydown', (e) => {
            if (document.getElementById("intro-video-overlay")) return; // intro handles its own keys
            if ((e.target as HTMLElement)?.tagName === 'INPUT') return; // typing in the wallet address field
            if (e.code === 'Space') { e.preventDefault(); this.handleVirtualKey('Space'); }
            if (e.code === 'Escape') this.handleVirtualKey('Escape');
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.handleVirtualKey('ArrowLeft');
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.handleVirtualKey('ArrowRight');
            
            if (this.isDevMode) {
                if (e.code === 'KeyK') { this.tokenBalance += 500000; this.evaluateShipUnlocks(); this.updateStringCache(); console.log(`[DEV MODE] Injected 500k Tokens. Balance: ${this.tokenBalance}`); }
                if (e.code === 'KeyL') { this.tokenBalance = 0; this.evaluateShipUnlocks(); this.updateStringCache(); console.log("[DEV MODE] Reset token balance to 0."); }
            }
        });
        window.addEventListener('keyup', (e) => { if (e.code === 'Space') { this.isBoosting = false; } });
    }

    private pollGamepad() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        let gp = null; for (let i = 0; i < gamepads.length; i++) { if (gamepads[i]) { gp = gamepads[i]; break; } } if (!gp) return;
        const pressed = (index: number) => gp?.buttons[index]?.pressed || false;
        const justPressed = (index: number) => pressed(index) && !this.lastGamepadState[index];
        if (justPressed(0)) this.handleVirtualKey('Space');
        if (justPressed(1) || justPressed(9)) this.handleVirtualKey('Escape');
        if (justPressed(14)) this.handleVirtualKey('ArrowLeft');
        if (justPressed(15)) this.handleVirtualKey('ArrowRight');
        if (this.currentState === GameState.PLAYING) { this.isBoosting = pressed(0) || pressed(7); }
        for (let i = 0; i < gp.buttons.length; i++) { this.lastGamepadState[i] = pressed(i); }
    }

    private async handleVirtualKey(code: string) {
        if (!this.isLandscape) return; // rotate prompt is showing
        if (code === 'Space') {
            if (this.audio.isMusicEnabled) this.audio.resumeMusic(this.bgColorIndex);
            if (this.currentState === GameState.PLAYING) { this.hasStartedFalling = true; this.velocity = this.jumpForce; this.isBoosting = true; } 
            else if (this.currentState === GameState.MENU || this.currentState === GameState.GAME_OVER) { this.handleInput(this.canvas.width / 2, this.canvas.height / 2); }
            else if (this.currentState === GameState.TUTORIAL) { this.handleInput(this.renderer.tutorialNextRect.centerX(), this.renderer.tutorialNextRect.centerY()); }
        }
        else if (code === 'Escape') {
            if (this.currentState === GameState.PLAYING) { this.audio.playClickSound(); this.currentState = GameState.PAUSED; } 
            else if (this.currentState === GameState.PAUSED) { this.audio.playClickSound(); this.countdownValue = 3; this.lastCountdownUpdate = Date.now(); this.currentState = GameState.COUNTDOWN; } 
            else if (this.currentState === GameState.SETTINGS || this.currentState === GameState.CUSTOMIZE || this.currentState === GameState.HANGAR || this.currentState === GameState.ABOUT || this.currentState === GameState.LEADERBOARDS || this.currentState === GameState.TUTORIAL || this.currentState === GameState.TOKENOMICS) { this.audio.playClickSound(); this.currentState = this.stateBeforeSettings; }
        }
        else if (code === 'ArrowLeft') {
            if (this.currentState === GameState.LEADERBOARDS) { this.audio.playClickSound(); this.leaderboardScrollX = Math.max(0, this.leaderboardScrollX - this.canvas.width); } 
            else if (this.currentState === GameState.HANGAR) { this.audio.playClickSound(); this.currentShipIndex = (this.currentShipIndex - 1 + this.shipResIds.length) % this.shipResIds.length; } 
            else if (this.currentState === GameState.CUSTOMIZE) { this.audio.playClickSound(); const nextBg = (this.bgColorIndex - 1 + this.bgImageIds.length) % this.bgImageIds.length; this.bgColorIndex = nextBg; await this.setData("bgColorIndex", this.bgColorIndex.toString()); this.audio.playThemeMusic(this.bgColorIndex); } 
            else if (this.currentState === GameState.MENU) { this.audio.playClickSound(); this.obstacleMode = (this.obstacleMode - 1 + 3) % 3; await this.setData("obstacle_mode", this.obstacleMode.toString()); this.applyDifficulty(); this.updateStringCache(); }
        }
        else if (code === 'ArrowRight') {
            if (this.currentState === GameState.LEADERBOARDS) { this.audio.playClickSound(); this.leaderboardScrollX = Math.min(8 * this.canvas.width, this.leaderboardScrollX + this.canvas.width); } 
            else if (this.currentState === GameState.HANGAR) { this.audio.playClickSound(); this.currentShipIndex = (this.currentShipIndex + 1) % this.shipResIds.length; } 
            else if (this.currentState === GameState.CUSTOMIZE) { this.audio.playClickSound(); const nextBg = (this.bgColorIndex + 1) % this.bgImageIds.length; this.bgColorIndex = nextBg; await this.setData("bgColorIndex", this.bgColorIndex.toString()); this.audio.playThemeMusic(this.bgColorIndex); } 
            else if (this.currentState === GameState.MENU) { this.audio.playClickSound(); this.obstacleMode = (this.obstacleMode + 1) % 3; await this.setData("obstacle_mode", this.obstacleMode.toString()); this.applyDifficulty(); this.updateStringCache(); }
        }
    }

    // --- MULTI-WALLET POPUP INTEGRATION ---
    public async connectSolanaWallet() {
        if (this.isDevMode) {
            this.userPublicKey = "DEV_MOCK_WALLET_8374829374928374";
            this.walletConnected = true; this.tokenBalance = 650000; 
            await this.evaluateShipUnlocks(); this.updateStringCache();
            console.log("[DEV MODE] Simulated Multi-Wallet Connection successful.");
            return;
        }
        this.showWalletSelectorModal();
    }

    private showWalletSelectorModal() {
        if (document.getElementById("arcade-wallet-modal")) return;
        const overlay = document.createElement("div"); overlay.id = "arcade-wallet-modal";
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background-color:rgba(0,0,0,0.85); z-index:99999; display:flex; justify-content:center; align-items:center; font-family:'VT323', monospace;";

        const modal = document.createElement("div");
        modal.style.cssText = "background-color:#111; border:4px solid #FF9900; padding:40px; text-align:center; box-shadow:0 0 30px #FF6600; max-width:400px; width:90%;";

        const title = document.createElement("h2");
        title.innerText = "SELECT WALLET INTERFACE";
        title.style.cssText = "color:#FFF; font-size:38px; margin:0 0 30px 0; letter-spacing:2px;";
        modal.appendChild(title);

        const createWalletButton = (name: string, checkProvider: () => any, downloadUrl: string) => {
            const btn = document.createElement("button");
            btn.innerText = name;
            btn.style.cssText = "width:100%; padding:15px; margin:10px 0; font-size:28px; font-family:'VT323', monospace; cursor:pointer; background-color:#222; color:#00FFFF; border:2px solid #00FFFF; transition:all 0.2s ease;";
            btn.onmouseover = () => { btn.style.backgroundColor = "#00FFFF"; btn.style.color = "#000"; btn.style.boxShadow = "0 0 15px #00FFFF"; };
            btn.onmouseout = () => { btn.style.backgroundColor = "#222"; btn.style.color = "#00FFFF"; btn.style.boxShadow = "none"; };
            btn.onclick = async () => {
                const provider = checkProvider();
                if (provider) {
                    try {
                        const response = await provider.connect();
                        this.userPublicKey = (response.publicKey ? response.publicKey.toString() : response.toString());
                        this.walletConnected = true; this.watchOnlyMode = false; (window as any).activeSolanaProvider = provider;
                        await this.setData('watchAddress', ''); // extension wallet supersedes any saved watch address
                        await this.syncOnChainTokenBalance();
                        this.fetchActiveReward(); // identity changed to WL_... - re-check for an active reward
                        this.audio.playClickSound(); document.body.removeChild(overlay);
                    } catch (err) { console.error(`${name} link authorization rejected`, err); }
                } else { window.open(downloadUrl, "_blank"); }
            };
            return btn;
        };

        modal.appendChild(createWalletButton("1. PHANTOM", () => (window as any).phantom?.solana || (window as any).solana, "https://phantom.app/"));
        modal.appendChild(createWalletButton("2. SOLFLARE", () => (window as any).solflare, "https://solflare.com/"));
        modal.appendChild(createWalletButton("3. BACKPACK", () => (window as any).backpack, "https://backpack.app/"));

        // Pump.fun's built-in wallet has no browser extension and cannot sign on
        // external sites, so those players connect by pasting their address
        // (read-only: balance unlocks work, burn revives do not).
        const watchBtn = document.createElement("button");
        watchBtn.innerText = "4. PUMP.FUN / WALLET ADDRESS";
        watchBtn.style.cssText = "width:100%; padding:15px; margin:10px 0; font-size:26px; font-family:'VT323', monospace; cursor:pointer; background-color:#221500; color:#FF9900; border:2px solid #FF9900; transition:all 0.2s ease;";
        watchBtn.onmouseover = () => { watchBtn.style.backgroundColor = "#FF9900"; watchBtn.style.color = "#000"; watchBtn.style.boxShadow = "0 0 15px #FF9900"; };
        watchBtn.onmouseout = () => { watchBtn.style.backgroundColor = "#221500"; watchBtn.style.color = "#FF9900"; watchBtn.style.boxShadow = "none"; };
        watchBtn.onclick = () => { this.audio.playClickSound(); this.showAddressEntryView(modal, overlay); };
        modal.appendChild(watchBtn);

        if (this.walletConnected) {
            const disconnectBtn = document.createElement("button");
            disconnectBtn.innerText = "[ DISCONNECT WALLET ]";
            disconnectBtn.style.cssText = "background:none; border:none; color:#FFAA00; font-size:20px; margin-top:15px; cursor:pointer; font-family:'VT323', monospace; display:block; width:100%;";
            disconnectBtn.onclick = async () => {
                this.audio.playClickSound();
                this.walletConnected = false; this.watchOnlyMode = false; this.userPublicKey = ""; this.tokenBalance = 0;
                (window as any).activeSolanaProvider = null;
                await this.setData('watchAddress', '');
                await this.evaluateShipUnlocks(); this.updateStringCache();
                document.body.removeChild(overlay);
            };
            modal.appendChild(disconnectBtn);
        }

        const cancelBtn = document.createElement("button");
        cancelBtn.innerText = "[ ABORT MISSION ]";
        cancelBtn.style.cssText = "background:none; border:none; color:#FF3333; font-size:22px; margin-top:25px; cursor:pointer; font-family:'VT323', monospace;";
        cancelBtn.onclick = () => { this.audio.playClickSound(); document.body.removeChild(overlay); };
        modal.appendChild(cancelBtn); overlay.appendChild(modal); document.body.appendChild(overlay);
    }

    // --- WATCH-MODE (PUMP.FUN / PASTED ADDRESS) CONNECTION ---
    private showAddressEntryView(modal: HTMLElement, overlay: HTMLElement) {
        modal.innerHTML = "";

        const title = document.createElement("h2");
        title.innerText = "ENTER WALLET ADDRESS";
        title.style.cssText = "color:#FFF; font-size:34px; margin:0 0 15px 0; letter-spacing:2px;";
        modal.appendChild(title);

        const hint = document.createElement("p");
        hint.innerText = "Pump.fun players: open pump.fun, tap your profile picture, and copy your wallet address. Holding $JMP there unlocks modes, ships & backgrounds. NOTE: revives (token burns) need a signing wallet - import your pump.fun key into Phantom to use them.";
        hint.style.cssText = "color:#AAA; font-size:19px; line-height:1.35; margin:0 0 20px 0; text-align:left;";
        modal.appendChild(hint);

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Solana wallet address...";
        input.autocomplete = "off"; input.spellcheck = false;
        input.style.cssText = "width:100%; box-sizing:border-box; padding:12px; font-size:22px; font-family:'VT323', monospace; background-color:#000; color:#00FF88; border:2px solid #00FFFF; outline:none; margin-bottom:8px;";
        modal.appendChild(input);

        const errorLabel = document.createElement("div");
        errorLabel.style.cssText = "color:#FF5555; font-size:20px; min-height:24px; margin-bottom:8px;";
        modal.appendChild(errorLabel);

        const connectBtn = document.createElement("button");
        connectBtn.innerText = "CONNECT (READ-ONLY)";
        connectBtn.style.cssText = "width:100%; padding:15px; font-size:28px; font-family:'VT323', monospace; cursor:pointer; background-color:#003322; color:#00FF88; border:2px solid #00FF88;";
        connectBtn.onclick = async () => {
            const addr = input.value.trim();
            if (!this.isValidSolanaAddress(addr)) {
                errorLabel.innerText = "INVALID ADDRESS. Check for typos or missing characters.";
                return;
            }
            connectBtn.innerText = "SYNCING BALANCE...";
            connectBtn.style.pointerEvents = "none";
            await this.connectWatchOnly(addr);
            this.audio.playClickSound();
            document.body.removeChild(overlay);
        };
        modal.appendChild(connectBtn);

        const backBtn = document.createElement("button");
        backBtn.innerText = "[ BACK ]";
        backBtn.style.cssText = "background:none; border:none; color:#FF3333; font-size:22px; margin-top:20px; cursor:pointer; font-family:'VT323', monospace;";
        backBtn.onclick = () => { this.audio.playClickSound(); document.body.removeChild(overlay); this.showWalletSelectorModal(); };
        modal.appendChild(backBtn);

        setTimeout(() => input.focus(), 50);
    }

    public isValidSolanaAddress(addr: string): boolean {
        // Base58 charset (no 0, O, I, l), typical Solana pubkey length
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
    }

    public async connectWatchOnly(address: string) {
        this.userPublicKey = address.trim();
        this.walletConnected = true;
        this.watchOnlyMode = true;
        (window as any).activeSolanaProvider = null;
        await this.setData('watchAddress', this.userPublicKey);
        await this.syncOnChainTokenBalance();
        this.fetchActiveReward(); // identity changed to WL_... - re-check for an active reward
        console.log(`[WALLET] Watch-only connection: ${this.userPublicKey}`);
    }

    // Lightweight in-game toast for messages the canvas UI can't show
    private showToast(message: string, durationMs: number = 5000) {
        const existing = document.getElementById("arcade-toast");
        if (existing) existing.remove();
        const toast = document.createElement("div");
        toast.id = "arcade-toast";
        toast.innerText = message;
        toast.style.cssText = "position:fixed; bottom:6%; left:50%; transform:translateX(-50%); max-width:80vw; background-color:#111; color:#FF9900; border:2px solid #FF9900; padding:14px 22px; font-family:'VT323', monospace; font-size:22px; z-index:99998; text-align:center; box-shadow:0 0 20px rgba(255,153,0,0.5);";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), durationMs);
    }

    public async syncOnChainTokenBalance() {
        if (this.isDevMode || !this.userPublicKey) return;
        try {
            const response = await fetch(this.SOLANA_RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner", params: [ this.userPublicKey, { mint: this.TARGET_TOKEN_MINT }, { encoding: "jsonParsed" } ] }) });
            const data = await response.json(); const accounts = data.result?.value || [];
            this.tokenBalance = accounts.length > 0 ? accounts[0].account.data.parsed.info.tokenAmount.uiAmount || 0 : 0;
            await this.evaluateShipUnlocks(); this.updateStringCache();
        } catch (e) { console.error("Solana cluster node fetch failure", e); }
    }

    private async handleInput(x: number, y: number) {
        if (!this.isLandscape) return; // rotate prompt is showing
        if (this.audio.isMusicEnabled) this.audio.resumeMusic(this.bgColorIndex);

        if (this.currentState === GameState.MENU) {
            if (this.renderer.menuTokenomicsRect.contains(x, y)) { this.audio.playClickSound(); this.stateBeforeSettings = this.currentState; this.currentState = GameState.TOKENOMICS; }
            if (this.renderer.menuCaRect.contains(x, y)) {
                this.audio.playClickSound();
                try { navigator.clipboard.writeText(this.CONTRACT_ADDRESS); } catch (e) {}
                this.caCopiedTimer = 60;
            }
            if (this.renderer.menuWalletRect.contains(x, y)) { this.audio.playClickSound(); await this.connectSolanaWallet(); }
            if (this.renderer.menuTapToStartRect.contains(x, y)) { 
                if (!this.isObstacleModeUnlocked(this.obstacleMode)) {
                    this.audio.playExplosionSound(); return; 
                }
                this.audio.playClickSound(); this.resetGame(); this.currentState = GameState.PLAYING;
            }
            if (this.renderer.menuSettingsRect.contains(x, y)) { this.audio.playClickSound(); this.stateBeforeSettings = this.currentState; this.currentState = GameState.SETTINGS; }
            
            if (this.renderer.menuDiffLeftArrowRect.contains(x, y)) { this.audio.playClickSound(); this.currentDifficulty = this.currentDifficulty === Difficulty.EASY ? Difficulty.HARD : (this.currentDifficulty === Difficulty.MEDIUM ? Difficulty.EASY : Difficulty.MEDIUM); await this.setData("difficulty", this.currentDifficulty.toString()); this.applyDifficulty(); this.updateStringCache(); }
            if (this.renderer.menuDiffRightArrowRect.contains(x, y)) { this.audio.playClickSound(); this.currentDifficulty = this.currentDifficulty === Difficulty.EASY ? Difficulty.MEDIUM : (this.currentDifficulty === Difficulty.MEDIUM ? Difficulty.HARD : Difficulty.EASY); await this.setData("difficulty", this.currentDifficulty.toString()); this.applyDifficulty(); this.updateStringCache(); }
            if (this.renderer.menuLeftArrowRect.contains(x, y)) { await this.handleVirtualKey('ArrowLeft'); }
            if (this.renderer.menuRightArrowRect.contains(x, y)) { await this.handleVirtualKey('ArrowRight'); }
        } 
        else if (this.currentState === GameState.PLAYING) {
            if (this.renderer.hudPauseRect.contains(x, y)) { this.audio.playClickSound(); this.currentState = GameState.PAUSED; return; }
            this.handleVirtualKey('Space');
        } 
        else if (this.currentState === GameState.PAUSED) {
            if (this.renderer.pauseResumeRect.contains(x, y)) { this.audio.playClickSound(); this.countdownValue = 3; this.lastCountdownUpdate = Date.now(); this.currentState = GameState.COUNTDOWN; }
            if (this.renderer.pauseMenuRect.contains(x, y)) { this.audio.playClickSound(); this.currentState = GameState.MENU; }
            if (this.renderer.pauseSettingsRect.contains(x, y)) { this.audio.playClickSound(); this.stateBeforeSettings = this.currentState; this.currentState = GameState.SETTINGS; }
        }
        else if (this.currentState === GameState.GAME_OVER) {
            if (!this.usedRecovery && this.renderer.recoverBtnRect.contains(x, y)) {
                this.audio.playClickSound();
                if (this.tokenBalance >= this.REVIVE_COST || this.isDevMode) {
                    
                    // Trigger Wallet Transaction for Burn
                    const burnSuccess = await this.executeBurnTransaction(this.REVIVE_COST);
                    
                    if (burnSuccess) {
                        this.usedRecovery = true; this.birdY = this.canvas.height / 2; this.velocity = 0; this.obstacles = [];
                        this.shieldCount = 1; this.hasShield = true; this.updateStringCache();
                        this.countdownValue = 3; this.lastCountdownUpdate = Date.now(); 
                        this.currentState = GameState.COUNTDOWN;
                    } else {
                        // User rejected transaction or lack of funds
                        this.audio.playExplosionSound();
                    }
                }
            }
            if (this.renderer.restartBtnRect.contains(x, y)) { this.audio.playClickSound(); this.resetGame(); this.currentState = GameState.PLAYING; }
            if (this.renderer.gameOverMenuRect.contains(x, y)) { this.audio.playClickSound(); this.currentState = GameState.MENU; }
        }
        else if (this.currentState === GameState.SETTINGS) {
            if (this.renderer.settingsCloseRect.contains(x, y)) { await this.handleVirtualKey('Escape'); }
            if (this.renderer.settingsMusicRect.contains(x, y)) { this.audio.playClickSound(); this.audio.toggleMusic(this.bgColorIndex); this.updateStringCache(); }
            if (this.renderer.settingsSfxRect.contains(x, y)) { this.audio.playClickSound(); this.audio.toggleSfx(); this.updateStringCache(); }
            if (this.renderer.settingsCustomizeRect.contains(x, y)) { this.audio.playClickSound(); this.currentState = GameState.CUSTOMIZE; }
            if (this.renderer.settingsLeaderboardRect.contains(x, y)) { this.audio.playClickSound(); this.fetchLeaderboards(); this.currentState = GameState.LEADERBOARDS; }
            if (this.renderer.settingsTutorialRect.contains(x, y)) { this.audio.playClickSound(); this.currentState = GameState.TUTORIAL; }
            if (this.renderer.settingsAboutRect.contains(x, y)) { this.audio.playClickSound(); this.currentState = GameState.ABOUT; }
        }
        else if (this.currentState === GameState.CUSTOMIZE) {
            if (this.renderer.customizeCloseRect.contains(x, y)) { await this.handleVirtualKey('Escape'); }
            if (this.renderer.customizeHangarRect.contains(x, y)) { this.audio.playClickSound(); this.currentState = GameState.HANGAR; }
            if (this.renderer.bgLeftArrowRect.contains(x, y)) { await this.handleVirtualKey('ArrowLeft'); }
            if (this.renderer.bgRightArrowRect.contains(x, y)) { await this.handleVirtualKey('ArrowRight'); }
            if (this.renderer.laserLeftArrowRect.contains(x, y) || this.renderer.laserRightArrowRect.contains(x, y)) { this.audio.playClickSound(); this.laserColorIndex = (this.laserColorIndex + 1) % this.laserColors.length; await this.setData("laserColorIndex", this.laserColorIndex.toString()); }
        }
        else if (this.currentState === GameState.HANGAR) {
            if (this.renderer.hangarBackRect.contains(x, y)) { this.audio.playClickSound(); this.currentState = GameState.CUSTOMIZE; }
            if (this.renderer.customizeLeftArrowRect.contains(x, y)) { await this.handleVirtualKey('ArrowLeft'); }
            if (this.renderer.customizeRightArrowRect.contains(x, y)) { await this.handleVirtualKey('ArrowRight'); }
            if (this.renderer.customizeShipRect.contains(x, y)) {
                this.audio.playClickSound();
                if (this.isShipUnlocked(this.currentShipIndex)) { this.activeShipIndex = this.currentShipIndex; this.renderer.playerBitmap = this.renderer.shipBitmaps[this.activeShipIndex]; await this.setData('activeShipIndex', this.activeShipIndex.toString()); }
            }
        }
        else if (this.currentState === GameState.TUTORIAL) {
            if (this.renderer.tutorialNextRect.contains(x, y)) {
                this.audio.playClickSound();
                if (this.currentTutorialPage < this.renderer.game.tutorialPages.length - 1) this.currentTutorialPage++;
                else { this.currentTutorialPage = 0; await this.setData('tutorialSeen', 'true'); this.currentState = this.stateBeforeSettings !== GameState.LOADING ? this.stateBeforeSettings : GameState.MENU; }
            }
        }
        else if (this.currentState === GameState.ABOUT) {
            if (this.renderer.aboutBackRect.contains(x, y)) { await this.handleVirtualKey('Escape'); }
            if (this.renderer.aboutPrivacyRect.contains(x, y)) { this.audio.playClickSound(); window.open("https://sites.google.com/view/2bit-dev-privacy/data-privacy", "_blank"); }
        }
        else if (this.currentState === GameState.TOKENOMICS) {
            if (this.renderer.tokenomicsBackRect.contains(x, y)) { await this.handleVirtualKey('Escape'); }
        }
        else if (this.currentState === GameState.LEADERBOARDS) {
            if (this.renderer.leaderboardCloseRect.contains(x, y)) { await this.handleVirtualKey('Escape'); }
            if (this.renderer.leaderboardLeftArrowRect.contains(x, y)) { await this.handleVirtualKey('ArrowLeft'); }
            if (this.renderer.leaderboardRightArrowRect.contains(x, y)) { await this.handleVirtualKey('ArrowRight'); }
        }
    }

    private spawnObstacle() {
        const w = this.canvas.width; const h = this.canvas.height;
        let obW, obH, sy, speed; let bmp = null;
        switch (this.obstacleMode) {
            case Obstacle.TYPE_BLADE: bmp = this.renderer.bmpBlade; obW = (this.isLandscape ? 150 : 297) * this.screenScale; obH = obW; speed = this.pipeSpeed * (1.5 + Math.random() * 1.5) * 0.49; sy = Math.random() * (h - obH); this.obstacles.push(new Obstacle(bmp, w, sy, speed, this.obstacleMode, obW, obH, this.screenScale, this.missileTrackingMultiplier)); break;
            case Obstacle.TYPE_MISSILE: bmp = this.renderer.bmpMissile; obW = (this.isLandscape ? 121 : 216 * 1.5) * this.screenScale; obH = obW; speed = this.pipeSpeed * 0.7; sy = Math.random() * Math.max(1, h - obH); this.obstacles.push(new Obstacle(bmp, w, sy, speed, this.obstacleMode, obW, obH, this.screenScale, this.missileTrackingMultiplier)); break;
            case Obstacle.TYPE_LASER: default: obW = 30 * this.screenScale; obH = (this.isLandscape ? 400 : 500) * this.screenScale; sy = Math.random() * Math.max(1, h - obH); speed = this.pipeSpeed * (0.45 + (this.score / 100)) * 0.525; this.obstacles.push(new Obstacle(null, w, sy, speed, Obstacle.TYPE_LASER, obW, obH, this.screenScale, this.missileTrackingMultiplier)); break;
        }
    }

    private addShield() {
        let max = 0; switch (this.activeShipIndex) { case 0: max = 1; break; case 1: max = 2; break; case 2: max = 3; break; case 3: case 4: case 5: max = 5; break; }
        if (this.shieldCount < max) { this.shieldCount++; this.hasShield = true; } this.updateStringCache();
    }

    private incrementScore() {
        this.score++; this.updateStringCache();
        if (this.score >= 25 && this.score % 10 === 0) this.pipeSpeed += (this.isLandscape ? 0.8 : 1.2) * this.screenScale;
        if (this.activeShipIndex === 5) { if (this.score === 10 || (this.score > 0 && this.score % 20 === 0)) this.addShield(); } 
        else if (this.score === 10 || (this.score > 0 && this.score % 25 === 0)) { this.addShield(); }
    }

    private loop(timestamp: number) {
        if (!this.lastFrameTime) this.lastFrameTime = timestamp;
        let dt = (timestamp - this.lastFrameTime) / 1000.0;
        if (dt > 0.1) dt = 1.0 / 60.0;
        this.lastFrameTime = timestamp;
        this.pollGamepad();

        if (this.caCopiedTimer > 0) this.caCopiedTimer--; 

        if (this.currentState === GameState.PLAYING) this.updateGame(dt);
        else if (this.currentState === GameState.COUNTDOWN) {
            if (Date.now() - this.lastCountdownUpdate >= 1000) { this.countdownValue--; this.lastCountdownUpdate = Date.now(); if (this.countdownValue <= 0) this.currentState = GameState.PLAYING; }
        }
        this.draw(dt); requestAnimationFrame((t) => this.loop(t));
    }

    private updateGame(dt: number) {
        const efm = 60 * dt; const dist = 1200 * this.screenScale;
        if (this.obstacles.length === 0 || this.obstacles[this.obstacles.length - 1].x < this.canvas.width - dist) this.spawnObstacle();

        if (this.hasStartedFalling) {
            this.velocity += this.gravity * efm; this.birdY += this.velocity * efm;
            const targetRot = (this.velocity >= 0) ? (this.isLandscape ? 12.0 : 18.75) : (this.isLandscape ? -12.0 : -18.75);
            const rotSpeed = this.isLandscape ? 0.06 : 0.1; this.shipRotation += (targetRot - this.shipRotation) * rotSpeed * efm;
        } else { this.shipRotation += (0 - this.shipRotation) * 0.05 * efm; }

        const hbw = this.renderer.playerWidth * 0.70; const hbh = this.renderer.playerHeight * 0.50;
        this.renderer.tempRectF.set(this.birdX - hbw/2, this.birdY - hbh/2, this.birdX + hbw/2, this.birdY + hbh/2);

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const ob = this.obstacles[i]; if (this.hasStartedFalling) ob.update(this.birdY, dt);

            if (ob.checkCollision(this.renderer.tempRectF, this.canvas.height)) {
                if (this.shieldCount > 0) { this.shieldCount--; this.hasShield = (this.shieldCount > 0); this.shakeTimer = 10; this.audio.playExplosionSound(); this.updateStringCache(); this.obstacles.splice(i, 1); continue; }
                this.handleGameOver("STATUS: DESTROYED. Hardware requires systematic optimization."); return;
            }

            // --- PATH A TELEMETRY LOGGING ---
            if (!ob.scored && ob.x + ob.width < this.birdX) {
                ob.scored = true;
                
                // Log the exact relative millisecond this obstacle was passed
                this.telemetryLog.push(Date.now() - this.runStartTime);
                
                if (ob.getType() === Obstacle.TYPE_LASER) { this.incrementScore(); } 
                else if (ob.getType() === Obstacle.TYPE_BLADE) { this.bladesPassed++; if (this.bladesPassed % 3 === 0) this.incrementScore(); } 
                else if (ob.getType() === Obstacle.TYPE_MISSILE) { this.missilesPassed++; if (this.missilesPassed % 2 === 0) this.incrementScore(); }
            }
            if (ob.x + ob.width < 0) this.obstacles.splice(i, 1);
        }

        if (this.birdY > this.canvas.height || this.birdY < 0) {
            if (this.shieldCount > 0) { this.shieldCount--; this.hasShield = (this.shieldCount > 0); this.shakeTimer = 10; this.audio.playExplosionSound(); this.updateStringCache(); this.birdY = (this.birdY < 0) ? 75 * this.screenScale : this.canvas.height - 75 * this.screenScale; this.velocity = 0; } 
            else { this.handleGameOver("STATUS: LOST IN SPACE. Gravitational pull exceeded thruster capacity."); return; }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) { this.particles[i].update(dt); if (this.particles[i].alpha <= 0) this.particles.splice(i, 1); }
    }

    private handleGameOver(quote: string) {
        this.audio.triggerVibration(300); this.audio.playExplosionSound(); this.saveHighScore(); 
        this.currentDeathQuote = quote; this.shakeTimer = 10; this.currentState = GameState.GAME_OVER;
    }

    private draw(dt: number) {
        this.ctx.imageSmoothingEnabled = false; this.ctx.save();
        if (this.shakeTimer > 0) { this.ctx.translate((Math.random() * 20) - 10, (Math.random() * 20) - 10); this.shakeTimer--; }
        this.ctx.fillStyle = 'black'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Landscape-only game: portrait devices get a rotate prompt instead of a layout
        if (!this.isLandscape) { this.renderer.drawRotatePrompt(this.ctx); this.ctx.restore(); return; }

        if (this.currentState === GameState.PLAYING || this.currentState === GameState.MENU || this.currentState === GameState.HANGAR) { this.renderer.updateNebulaState(dt); }
        this.renderer.drawMainBackground(this.ctx);
        if (this.currentState === GameState.PLAYING || this.currentState === GameState.PAUSED) { this.renderer.drawParallax(this.ctx); }

        switch (this.currentState) {
            case GameState.LOADING: this.ctx.fillStyle = "white"; this.ctx.font = `40px "VT323", monospace`; this.ctx.textAlign = "center"; this.ctx.fillText("LOADING ASSETS...", this.canvas.width/2, this.canvas.height/2); break;
            case GameState.MENU: this.renderer.drawMainMenu(this.ctx); break;
            case GameState.PLAYING: this.renderer.drawGame(this.ctx); this.renderer.drawHUD(this.ctx); for (const p of this.particles) { this.ctx.fillStyle = `rgba(255, 255, 0, ${p.alpha / 255})`; this.ctx.fillRect(p.x, p.y, 8 * this.screenScale, 8 * this.screenScale); } break;
            case GameState.GAME_OVER: this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); this.renderer.drawGameOverScreenContent(this.ctx); break;
            case GameState.SETTINGS: this.renderer.drawSettingsScreen(this.ctx); break;
            case GameState.CUSTOMIZE: this.renderer.drawCustomizeScreen(this.ctx); break;
            case GameState.HANGAR: if (Date.now() - this.lastHangarFrameTime > 1000 / 30) { this.hangarFrameIndex = (this.hangarFrameIndex + 1) % 120; this.lastHangarFrameTime = Date.now(); } this.renderer.drawHangarScreen(this.ctx, this.getShipFullDescription(this.currentShipIndex), this.getShipTitle(this.currentShipIndex), this.getShipUnlockCondition(this.currentShipIndex), this.isShipUnlocked(this.currentShipIndex), this.hangarFrameIndex); break;
            case GameState.TUTORIAL: this.renderer.drawTutorialScreen(this.ctx, this.currentTutorialPage); break;
            case GameState.ABOUT: this.renderer.drawAboutScreen(this.ctx); break;
            case GameState.TOKENOMICS: this.renderer.drawTokenomicsScreen(this.ctx); break;
            case GameState.LEADERBOARDS: this.renderer.drawLeaderboardsScreen(this.ctx); break;
            case GameState.PAUSED: this.renderer.drawGame(this.ctx); this.renderer.drawHUD(this.ctx); this.renderer.drawPauseOverlay(this.ctx); break;
            case GameState.COUNTDOWN: this.renderer.drawGame(this.ctx); this.renderer.drawHUD(this.ctx); this.renderer.drawCountdownOverlay(this.ctx, this.countdownValue); break;
        }
        this.ctx.restore();
    }

    public hasRewardUnlock(): boolean { return Date.now() < this.rewardUnlockUntil; }
    public isObstacleModeUnlocked(mode: number): boolean { return this.isDevMode || this.hasRewardUnlock() || this.tokenBalance >= this.obsTokenThresholds[mode]; }
    public async evaluateShipUnlocks() { this.unlockedShips[0] = true; for (let i = 1; i < this.shipResIds.length; i++) { this.unlockedShips[i] = this.hasRewardUnlock() || this.tokenBalance >= this.shipTokenThresholds[i]; } }
    public isShipUnlocked(index: number): boolean { if (this.isDevMode) return true; return this.unlockedShips[index] || false; }
    public isBackgroundUnlocked(index: number): boolean { if (this.isDevMode) return true; return this.hasRewardUnlock() || this.tokenBalance >= this.bgTokenThresholds[index]; }

    public getShipTitle(index: number): string { switch (index) { case 0: return "THE COSMIC VANGUARD"; case 1: return "EXO-117"; case 2: return "HELIOS VANGUARD"; case 3: return "EMERALD DREADNOUGHT"; case 4: return "OBSIDIAN FURY"; case 5: return "STARSHIP ODYSSEY"; default: return "UNKNOWN SHIP"; } }
    public getShipFullDescription(index: number): string { let d = ""; let m = 0; let i = ""; switch (index) { case 0: d = "A reliable interceptor balanced for all missions."; m = 1; break; case 1: d = "A tactical fighter designed for high-speed evasion."; m = 2; break; case 2: d = "An elegant royal guard vessel with solar fins."; m = 3; break; case 3: d = "A heavy-armored siege bomber with fusion bay."; m = 5; break; case 4: d = "Classified stealth striker. Built on volatile plasma."; i = " Starts with 1 shield."; m = 5; break; case 5: d = "A legendary deep-space pioneer. Max firepower."; i = " Starts with 2 shields, gains 1 every 20 pts."; m = 5; break; } return `${d} ${i} (Max shields: ${m})`; }
    public getShipUnlockCondition(index: number): string { if (index === 0) return "Unlocked by default."; return `Hold ${this.shipTokenThresholds[index].toLocaleString()} $JMP Tokens`; }

    public resetGame() {
        this.birdY = this.canvas.height / 2; this.velocity = 0; this.shipRotation = 0; this.score = 0; this.scoreStr = "Score: 0"; this.obstacles = [];
        this.hasStartedFalling = false; this.particles = []; this.bladesPassed = 0; this.missilesPassed = 0; this.usedRecovery = false;
        
        // Reset Telemetry for the new run
        this.runStartTime = Date.now();
        this.telemetryLog = [];
        
        if (!this.isBackgroundUnlocked(this.bgColorIndex)) { this.bgColorIndex = 0; }
        this.applyDifficulty(); this.shieldCount = 0; if (this.activeShipIndex === 4) this.shieldCount = 1; if (this.activeShipIndex === 5) this.shieldCount = 2; this.hasShield = (this.shieldCount > 0); this.updateStringCache();
    }
}