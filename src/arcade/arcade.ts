// ============================================================
// 2BITARCADE - LANDING PAGE
// Intro video -> lazy-Susan cabinet selector -> games.
// The wallet connected here is restored inside every game via the
// shared localStorage keys 'walletType' / 'watchAddress'.
// ============================================================
import { playIntroVideo } from '../IntroVideo';

// --- SHARED ARCADE CONFIG (keep in sync with the games) ---
// All token/backend config comes from the single source of truth
// (arcade-config.js -> window.ARCADE_CONFIG). Edit that ONE file at launch.
const CONTRACT_ADDRESS = window.ARCADE_CONFIG.CONTRACT_ADDRESS;
const TARGET_TOKEN_MINT = window.ARCADE_CONFIG.TOKEN_MINT;
const SOLANA_RPC_URL = window.ARCADE_CONFIG.SOLANA_RPC_URL;
const SUPABASE_URL = window.ARCADE_CONFIG.SUPABASE_URL;
const SUPABASE_KEY = window.ARCADE_CONFIG.SUPABASE_KEY;
const INITIAL_TOKEN_SUPPLY = window.ARCADE_CONFIG.INITIAL_TOKEN_SUPPLY;

// defaultFeatured: seeds the lazy Susan until enough ratings exist to rank it.
// category: drives the catalog filter chips.
interface Game { id: string; title: string; desc: string; img: string; url: string; category: string; defaultFeatured?: boolean; unranked?: boolean; }
const GAMES: Game[] = [
    {
        id: 'origami', defaultFeatured: true, category: 'Platformer',
        title: 'ORIGAMI ASCENT',
        desc: 'Embark on a breathtaking journey through the endless sky in Origami Ascent, a beautifully crafted 2D papercraft platformer where precision meets serenity.',
        img: './arcade/origami_arcade.png',
        url: './origami.html',
    },
    {
        id: 'jumpfighter', defaultFeatured: true, category: 'Arcade',
        title: 'JUMPFIGHTER',
        desc: 'Pilot your Jump Fighter! Dodge deadly lasers, unlock epic ships, and survive.',
        img: './arcade/jumpfighter_arcade.png',
        url: './jumpfighter.html',
    },
    {
        id: 'radiusraid', defaultFeatured: true, category: 'Shooter',
        title: 'RADIUS RAID',
        desc: 'A relentless space shoot-\u2019em-up: 13 enemy types, screen-shaking explosions and neon particle chaos. How long can you hold the center?',
        img: './arcade/radiusraid_arcade.png',
        url: './rraid.html',
    },
    {
        id: 'bullethell', category: 'Shooter',
        title: 'BULLET HELL',
        desc: 'Weave through storms of enemy fire in this frantic danmaku shooter. Bank your bombs, clear the screen, and push your score before the patterns swallow you.',
        img: './arcade/bullethell_arcade.png',
        url: './bullethell.html',
    },
    {
        id: 'spacepi', category: 'Shooter',
        title: 'SPACEPI',
        desc: 'Defend your home world across 13 escalating levels of orbital combat. Precise mouse-aim gunnery, chained accuracy bonuses, and a rising cumulative score on the champion boards.',
        img: './arcade/spacepi_arcade.png',
        url: './spacepi.html',
    },
    {
        id: 'luckyalien', category: 'Platformer',
        title: 'LUCKY ALIEN',
        desc: 'A retro jungle platformer in the classic console tradition. Dash and jump through Grassland and Forest, grab powerups, collect coins, and take down the boss. The more coins you bank in a run, the higher you climb the boards.',
        img: './arcade/luckyalien_arcade.png',
        url: './luckyalien.html',
    },
    {
        id: 'neonrunner', category: 'Runner',
        title: 'NEON RUNNER',
        desc: 'An original 2bitArcade cabinet. A pixel robot dashes through an endless neon cyber city \u2014 leap the barriers, duck the drones, and outrun a speed that never stops climbing. Distance is everything.',
        img: './arcade/neonrunner_arcade.png',
        url: './neonrunner.html',
    },
    {
        id: 'neonracer', category: 'Racing',
        title: 'NEON NIGHT RACER',
        desc: 'Weave through neon traffic at full throttle in this synthwave highway racer. Three lives, no brakes on ambition \u2014 dodge cars and stay on the road as lanes tighten the farther you push. Distance driven is your score.',
        img: './arcade/neonracer_arcade.png',
        url: './neonracer.html',
    },
    {
        id: 'sunsetdrift', category: 'Racing',
        title: 'SUNSET DRIFT',
        desc: 'An original 2bitArcade cabinet \u2014 an early-90s style pseudo-3D canyon racer. Carve curving mountain roads into the sunset, crest hills, and weave past traffic. Pure arcade driving; the farther you get, the higher you rank.',
        img: './arcade/sunsetdrift_arcade.png',
        url: './sunsetdrift.html',
    },
    {
        id: 'junglestrike', category: 'Run & Gun',
        title: 'JUNGLE STRIKE',
        desc: 'An original 2bitArcade run-and-gun. Fight through four stages \u2014 jungle, river, cave, and the enemy base \u2014 each with its own look, enemies, and end boss. Grab spread, machine-gun, and laser power-ups. Run, jump, aim 8 ways, survive.',
        img: './arcade/junglestrike_arcade.png',
        url: './junglestrike.html',
    },
];

// --- ratings state ---
let ratings: Record<string, { avg: number; count: number; mine: number }> = {};
const PER_PAGE = 8;
let catalogPage = 0;
let activeCategory = 'All';

const sbHeaders = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

// ============================================================
// LAZY SUSAN CAROUSEL
// ============================================================
let susanIndex = 0;
let susanAngle = 0;
let autoSpinTimer: ReturnType<typeof setInterval> | null = null;
let lastSwipeAt = 0; // suppress the click that follows a swipe
let FEATURED: Game[] = GAMES.filter(g => g.defaultFeatured); // reseeded once ratings load
let STEP = 360 / Math.max(1, FEATURED.length);

// Top 3 by average rating; ties and unrated games fall back to default-featured order.
function computeFeatured() {
    const rated = [...GAMES].filter(g => ratings[g.id]?.count > 0);
    if (rated.length === 0) { FEATURED = GAMES.filter(g => g.defaultFeatured); }
    else {
        rated.sort((a, b) => (ratings[b.id].avg - ratings[a.id].avg) || (ratings[b.id].count - ratings[a.id].count));
        const top = rated.slice(0, 3);
        // pad to 3 with default-featured games not already included
        for (const g of GAMES) { if (top.length >= 3) break; if (!top.includes(g) && g.defaultFeatured) top.push(g); }
        FEATURED = top;
    }
    STEP = 360 / Math.max(1, FEATURED.length);
    susanIndex = Math.min(susanIndex, FEATURED.length - 1);
}

function buildSusan() {
    const ring = document.getElementById('susan-ring');
    if (!ring) return;
    ring.innerHTML = '';
    FEATURED.forEach((g, i) => {
        const panel = document.createElement('div');
        panel.className = 'susan-panel';
        panel.dataset.index = i.toString();
        panel.style.transform = `rotateY(${i * STEP}deg) translateZ(var(--susan-radius))`;
        if (g.img) {
            const img = document.createElement('img');
            img.src = g.img; img.alt = g.title; img.draggable = false;
            // Cabinet art not uploaded yet? Fall back to a styled title card
            img.onerror = () => {
                panel.innerHTML = `<div class="soon-card"><span>\u25B6</span><p>${g.title.replace(' ', '<br>')}</p></div>`;
            };
            panel.appendChild(img);
        } else {
            panel.classList.add('coming-soon');
            panel.innerHTML = `<div class="soon-card"><span>?</span><p>MORE GAMES<br>COMING SOON</p></div>`;
        }
        panel.addEventListener('click', () => {
            if (Date.now() - lastSwipeAt < 350) return; // that "click" was the end of a swipe
            const target = parseInt(panel.dataset.index!);
            if (target === susanIndex && FEATURED[target].url) { attemptLaunch(FEATURED[target].url!); return; }
            rotateTo(target);
        });
        ring.appendChild(panel);
    });
    applyRotation();
    updateInfo();
    startAutoSpin();
}

function rotateBy(dir: number) {
    susanIndex = (susanIndex + dir + FEATURED.length) % FEATURED.length;
    susanAngle -= dir * STEP;
    applyRotation(); updateInfo(); startAutoSpin();
}

function rotateTo(target: number) {
    const diff = (target - susanIndex + FEATURED.length) % FEATURED.length;
    rotateBy(diff > FEATURED.length / 2 ? diff - FEATURED.length : diff);
}

function applyRotation() {
    const ring = document.getElementById('susan-ring');
    if (!ring) return;
    ring.style.transform = `rotateY(${susanAngle}deg)`;
    document.querySelectorAll('.susan-panel').forEach((p) => {
        p.classList.toggle('active', parseInt((p as HTMLElement).dataset.index!) === susanIndex);
    });
}

function updateInfo() {
    const g = FEATURED[susanIndex];
    const title = document.getElementById('game-title');
    const desc = document.getElementById('game-desc');
    const playBtn = document.getElementById('play-btn') as HTMLButtonElement | null;
    if (title) title.textContent = g.title;
    if (desc) desc.textContent = g.desc;
    if (playBtn) {
        if (g.url) { playBtn.style.display = 'inline-block'; playBtn.textContent = 'INSERT COIN \u25B6 PLAY'; }
        else { playBtn.style.display = 'none'; }
    }
}

function startAutoSpin() {
    if (autoSpinTimer) clearInterval(autoSpinTimer);
    autoSpinTimer = setInterval(() => rotateBy(1), 6000);
}

function launchGame(url: string) { window.location.href = url; }

// ---------- ACCESS GATE (wallet + username required; 8h free trial; then >=1000 $2BA) ----------
async function checkAccess(): Promise<{ allowed: boolean; reason: string }> {
    if (!walletConnected || !userPublicKey) return { allowed: false, reason: 'connect' };
    if (!arcadeUsername) return { allowed: false, reason: 'username' };
    // holding enough tokens => always allowed (skip trial check)
    if (tokenBalance >= MIN_TOKENS_TO_PLAY) return { allowed: true, reason: 'tokens' };
    // otherwise consult the server-side trial clock (starts it on first play)
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_or_start_trial`, {
            method: 'POST', headers: sbHeaders, body: JSON.stringify({ p_wallet: userPublicKey })
        });
        const data = await res.json();
        const secondsLeft = (data && typeof data.seconds_left === 'number') ? data.seconds_left : 0;
        if (secondsLeft > 0) return { allowed: true, reason: 'trial:' + secondsLeft };
        return { allowed: false, reason: 'tokengate' };
    } catch (e) {
        // if the trial service is unreachable, fail OPEN for holders only; others blocked
        return { allowed: false, reason: 'tokengate' };
    }
}

async function attemptLaunch(url: string) {
    const access = await checkAccess();
    if (access.allowed) { launchGame(url); return; }
    if (access.reason === 'connect') { showWalletModal(); return; }
    if (access.reason === 'username') { showUsernameModal(false); return; }
    showTokenGateModal(); // trial over + under 1000 $2BA
}

function showTokenGateModal() {
    if (document.getElementById('arcade-gate-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'arcade-gate-modal';
    overlay.innerHTML = `
      <div class="wm-dialog">
        <h2>\uD83D\uDD12 ARCADE LOCKED</h2>
        <p class="wm-hint">Your 8-hour free trial has ended. To keep playing every cabinet in
        the arcade, hold at least <b>${MIN_TOKENS_TO_PLAY.toLocaleString()} $2BA</b> in your
        connected wallet. Your balance unlocks everything \u2014 you never spend it to play
        (only revives burn tokens).</p>
        <p class="wm-hint">Your balance: <b>${Math.floor(tokenBalance).toLocaleString()} $2BA</b></p>
        <a id="gate-buy" class="wm-btn wm-go" href="#" target="_blank" rel="noopener">GET $2BA</a>
        <button class="wm-btn" id="gate-refresh">I ADDED TOKENS \u2014 RE-CHECK</button>
        <button class="wm-cancel" id="gate-close">[ CLOSE ]</button>
      </div>`;
    document.body.appendChild(overlay);
    const buy = document.getElementById('gate-buy') as HTMLAnchorElement;
    // buy link: pump.fun token page if CA is set, else a placeholder
    buy.href = (CONTRACT_ADDRESS && CONTRACT_ADDRESS !== 'YOUR_CA_HERE')
        ? `https://pump.fun/coin/${CONTRACT_ADDRESS}` : '#';
    document.getElementById('gate-refresh')?.addEventListener('click', async () => {
        await syncBalance();
        (document.querySelector('#arcade-gate-modal .wm-hint b') as HTMLElement)?.replaceWith();
        overlay.remove();
        // re-evaluate immediately
        if (tokenBalance >= MIN_TOKENS_TO_PLAY) showToast('Unlocked! ' + Math.floor(tokenBalance).toLocaleString() + ' $2BA \u2014 enjoy the arcade.');
        else showTokenGateModal();
    });
    document.getElementById('gate-close')?.addEventListener('click', () => overlay.remove());
}

function showToast(msg: string) {
    document.getElementById('arcade-toast')?.remove();
    const t = document.createElement('div');
    t.id = 'arcade-toast'; t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:6%;left:50%;transform:translateX(-50%);background:#111;color:#00ff88;border:2px solid #00ff88;padding:12px 20px;font-family:monospace;font-size:15px;z-index:99999;text-align:center;max-width:80vw;';
    document.body.appendChild(t); setTimeout(() => t.remove(), 4000);
}

// ---------- CHAMPION STANDINGS ----------
async function fetchChampions() {
    const dailyEl = document.getElementById('champ-daily');
    const weeklyEl = document.getElementById('champ-weekly');
    if (!dailyEl || !weeklyEl) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_champion_standings`, { method: 'POST', headers: sbHeaders, body: '{}' });
        const data = await res.json();
        renderChampList(dailyEl, data.daily || [], 3);
        renderChampList(weeklyEl, data.weekly || [], 10);
    } catch (e) {
        dailyEl.innerHTML = '<li class="champ-empty">Standings load when play begins.</li>';
        weeklyEl.innerHTML = '';
    }
}

function renderChampList(el: HTMLElement, rows: any[], max: number) {
    el.innerHTML = '';
    if (rows.length === 0) { el.innerHTML = '<li class="champ-empty">No runs yet \u2014 be the first.</li>'; return; }
    const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
    rows.slice(0, max).forEach((r, i) => {
        const li = document.createElement('li');
        const badge = i < 3 ? medals[i] : `#${i + 1}`;
        li.innerHTML = `<span class="champ-pos">${badge}</span><span class="champ-name">${r.player}</span>`;
        el.appendChild(li);
    });
}

// ---------- RATINGS ----------
async function fetchRatings() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_ratings`, {
            method: 'POST', headers: sbHeaders,
            body: JSON.stringify({ p_wallet: userPublicKey || '' })
        });
        const rows = await res.json();
        ratings = {};
        if (Array.isArray(rows)) {
            for (const r of rows) ratings[r.game_id] = { avg: Number(r.avg_stars) || 0, count: Number(r.vote_count) || 0, mine: r.my_stars || 0 };
        }
    } catch (e) { /* ratings RPC not deployed yet - stars show as unrated */ }
    computeFeatured();
    buildSusan();
    buildCatalog();
}

async function submitRating(gameId: string, stars: number) {
    if (!walletConnected || !userPublicKey) { alert('Connect your wallet to rate games.'); return; }
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_game`, {
            method: 'POST', headers: sbHeaders,
            body: JSON.stringify({ p_game: gameId, p_wallet: userPublicKey, p_stars: stars })
        });
        if (await res.json() === true) await fetchRatings();
    } catch (e) {}
}

function starRow(gameId: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cat-stars' + (walletConnected ? '' : ' readonly');
    const r = ratings[gameId];
    const filled = r ? Math.round(r.avg) : 0;
    const mine = r?.mine || 0;
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = 'star' + (i <= (mine || filled) ? ' filled' : '');
        star.textContent = '\u2605';
        if (walletConnected) {
            star.title = `Rate ${i}/5`;
            star.addEventListener('click', (e) => { e.stopPropagation(); submitRating(gameId, i); });
        }
        wrap.appendChild(star);
    }
    return wrap;
}

// ---------- FULL CATALOG GRID (paginated, filterable) ----------
function categories(): string[] {
    return ['All', ...Array.from(new Set(GAMES.map(g => g.category)))];
}

function buildCategoryBar() {
    const bar = document.getElementById('catalog-categories');
    if (!bar) return;
    bar.innerHTML = '';
    categories().forEach(cat => {
        const chip = document.createElement('div');
        chip.className = 'cat-chip' + (cat === activeCategory ? ' active' : '');
        chip.textContent = cat.toUpperCase();
        chip.addEventListener('click', () => { activeCategory = cat; catalogPage = 0; buildCatalog(); });
        bar.appendChild(chip);
    });
}

function buildCatalog() {
    buildCategoryBar();
    const grid = document.getElementById('catalog-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = GAMES.filter(g => activeCategory === 'All' || g.category === activeCategory);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    catalogPage = Math.min(catalogPage, totalPages - 1);
    const pageGames = filtered.slice(catalogPage * PER_PAGE, catalogPage * PER_PAGE + PER_PAGE);

    pageGames.forEach((g) => {
        const tile = document.createElement('div');
        tile.className = 'cat-tile';
        const img = document.createElement('img');
        img.src = g.img; img.alt = g.title;
        img.onerror = () => { img.style.display = 'none'; };
        tile.appendChild(img);
        const h3 = document.createElement('h3'); h3.textContent = g.title; tile.appendChild(h3);
        tile.appendChild(starRow(g.id));
        const r = ratings[g.id];
        const meta = document.createElement('div');
        meta.className = 'cat-rating-meta';
        if (g.unranked) meta.innerHTML = '<span class="cat-unranked">UNRANKED</span>';
        else meta.textContent = r && r.count > 0 ? `${r.avg.toFixed(1)} \u2605 (${r.count})` : 'Not yet rated';
        tile.appendChild(meta);
        const p = document.createElement('p'); p.textContent = g.desc; tile.appendChild(p);
        const play = document.createElement('span'); play.className = 'cat-play'; play.textContent = '\u25B6 PLAY'; tile.appendChild(play);
        tile.addEventListener('click', () => { if (g.url) attemptLaunch(g.url); });
        grid.appendChild(tile);
    });

    // "coming soon" tile only on the last page of the All view
    if (activeCategory === 'All' && catalogPage === totalPages - 1 && pageGames.length < PER_PAGE) {
        const soon = document.createElement('div');
        soon.className = 'cat-tile cat-soon';
        soon.innerHTML = `<h3>MORE GAMES COMING</h3><p>Building something? Hit CONTACT US and pitch your game.</p><span class="cat-play">\u2026</span>`;
        grid.appendChild(soon);
    }

    const label = document.getElementById('cat-page-label');
    if (label) label.textContent = `PAGE ${catalogPage + 1} / ${totalPages}`;
    const prev = document.getElementById('cat-prev') as HTMLButtonElement | null;
    const next = document.getElementById('cat-next') as HTMLButtonElement | null;
    const pager = document.getElementById('catalog-pager');
    if (pager) pager.style.display = totalPages > 1 ? 'flex' : 'none';
    if (prev) prev.disabled = catalogPage === 0;
    if (next) next.disabled = catalogPage >= totalPages - 1;
}

// ---------- ARROWS + KEYBOARD + SWIPE ----------
function wireInputs() {
    // The carousel arrow buttons (this wiring was missing - keyboard worked, clicks didn't)
    document.getElementById('susan-left')?.addEventListener('click', () => rotateBy(-1));
    document.getElementById('susan-right')?.addEventListener('click', () => rotateBy(1));

    // Arrow keys rotate, Enter launches the front cabinet
    window.addEventListener('keydown', (e) => {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return; // typing a wallet address
        if (document.getElementById('intro-video-overlay')) return; // intro handles its own keys
        if (e.key === 'ArrowLeft') { e.preventDefault(); rotateBy(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); rotateBy(1); }
        else if (e.key === 'Enter') {
            const g = FEATURED[susanIndex];
            if (g.url) attemptLaunch(g.url);
        }
    });

    // Horizontal swipe / drag on the carousel stage
    const stage = document.getElementById('susan-stage');
    if (stage) {
        let startX = 0, startY = 0, tracking = false;
        stage.addEventListener('pointerdown', (e) => { tracking = true; startX = e.clientX; startY = e.clientY; });
        stage.addEventListener('pointerup', (e) => {
            if (!tracking) return; tracking = false;
            const dx = e.clientX - startX, dy = e.clientY - startY;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                lastSwipeAt = Date.now();
                rotateBy(dx < 0 ? 1 : -1); // swipe left -> next cabinet
            }
        });
        stage.addEventListener('pointercancel', () => { tracking = false; });
    }
}

// ============================================================
// LIVE STATS
// ============================================================
const presenceSessionId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function fetchActivePilots() {
    const el = document.getElementById('stat-pilots');
    if (!el) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_active_pilots`, { method: 'POST', headers: sbHeaders, body: '{}' });
        const count = await res.json();
        if (typeof count === 'number') { el.innerHTML = `\u25CF ${count.toLocaleString()} Active Player${count === 1 ? '' : 's'}`; return; }
        throw new Error();
    } catch (e) { el.innerHTML = '\u25CF -- Active Players'; }
}

function formatCompact(n: number): string {
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K';
    return Math.floor(n).toString();
}

async function fetchTokensBurned() {
    const el = document.getElementById('stat-burned');
    if (!el) return;
    try {
        const res = await fetch(SOLANA_RPC_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenSupply', params: [TARGET_TOKEN_MINT] })
        });
        const data = await res.json();
        const supply = data.result?.value?.uiAmount;
        if (typeof supply === 'number') {
            const burned = Math.max(0, INITIAL_TOKEN_SUPPLY - supply);
            el.innerHTML = `\uD83D\uDD25 ${formatCompact(burned)} $2BA Burned`;
            return;
        }
        throw new Error();
    } catch (e) { el.innerHTML = '\uD83D\uDD25 -- $2BA Burned'; }
}

function startPresence() {
    const beat = () => {
        if (document.visibilityState === 'hidden') return;
        fetch(`${SUPABASE_URL}/rest/v1/rpc/pilot_heartbeat`, { method: 'POST', headers: sbHeaders, body: JSON.stringify({ p_session_id: presenceSessionId }) }).catch(() => {});
    };
    beat(); setInterval(beat, 45000);
    fetchActivePilots(); fetchTokensBurned();
    setInterval(() => { fetchActivePilots(); fetchTokensBurned(); }, 60000);
}

// ============================================================
// WALLET (shared with the games via localStorage)
// ============================================================
let walletConnected = false, userPublicKey = '', tokenBalance = 0;
let arcadeUsername = localStorage.getItem('arcadeUsername') || '';
const MIN_TOKENS_TO_PLAY = window.ARCADE_CONFIG.MIN_TOKENS_TO_PLAY; // required $2BA after free trial

function walletLabel() {
    const btn = document.getElementById('wallet-btn');
    if (!btn) return;
    if (walletConnected) {
        const short = `${userPublicKey.substring(0, 4)}..${userPublicKey.substring(userPublicKey.length - 4)}`;
        const watch = localStorage.getItem('watchAddress') === userPublicKey ? '[WATCH] ' : '';
        btn.textContent = `${watch}${short} \u2502 ${Math.floor(tokenBalance).toLocaleString()} $2BA`;
    } else btn.textContent = 'CONNECT WALLET';
}

async function loadUsername() {
    arcadeUsername = '';
    if (!userPublicKey) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_username`, {
            method: 'POST', headers: sbHeaders, body: JSON.stringify({ p_wallet: userPublicKey })
        });
        const name = await res.json();
        if (typeof name === 'string' && name) { arcadeUsername = name; localStorage.setItem('arcadeUsername', name); }
        else { localStorage.removeItem('arcadeUsername'); }
    } catch (e) { /* fall back to WL_ naming */ }
}

async function syncBalance() {
    if (!userPublicKey) return;
    try {
        const res = await fetch(SOLANA_RPC_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner', params: [userPublicKey, { mint: TARGET_TOKEN_MINT }, { encoding: 'jsonParsed' }] })
        });
        const data = await res.json();
        const accounts = data.result?.value || [];
        tokenBalance = accounts.length > 0 ? accounts[0].account.data.parsed.info.tokenAmount.uiAmount || 0 : 0;
    } catch (e) {}
    walletLabel();
}

async function restoreWallet() {
    const walletType = localStorage.getItem('walletType');
    if (walletType) {
        const w = window as any;
        const provider = walletType === 'phantom' ? (w.phantom?.solana || w.solana)
            : walletType === 'solflare' ? w.solflare : w.backpack;
        if (provider) {
            try {
                const resp = await provider.connect({ onlyIfTrusted: true });
                userPublicKey = resp?.publicKey?.toString() || provider.publicKey?.toString() || '';
                if (userPublicKey) { walletConnected = true; await syncBalance(); return; }
            } catch (e) {}
        }
    }
    const watchAddr = localStorage.getItem('watchAddress');
    if (watchAddr && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(watchAddr)) {
        userPublicKey = watchAddr; walletConnected = true; await syncBalance();
    }
}

function showWalletModal() {
    if (document.getElementById('arcade-wallet-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'arcade-wallet-modal';
    overlay.innerHTML = `
      <div class="wm-dialog">
        <h2>SELECT WALLET</h2>
        <button class="wm-btn" data-type="phantom">1. PHANTOM</button>
        <button class="wm-btn" data-type="solflare">2. SOLFLARE</button>
        <button class="wm-btn" data-type="backpack">3. BACKPACK</button>
        <button class="wm-btn wm-watch" data-type="watch">4. PUMP.FUN / WALLET ADDRESS</button>
        <div id="wm-watch-entry" style="display:none;">
          <p class="wm-hint">Pump.fun players: open pump.fun, tap your profile picture, and copy your wallet
          address. Holding $2BA there unlocks everything across the arcade. Revives (burns) need a signing
          wallet &mdash; import your pump.fun key into Phantom for those.</p>
          <input id="wm-addr" type="text" placeholder="Solana wallet address..." spellcheck="false" autocomplete="off" />
          <div id="wm-err"></div>
          <button class="wm-btn wm-go">CONNECT (READ-ONLY)</button>
        </div>
        ${walletConnected ? '<button class="wm-username">[ ' + (arcadeUsername ? 'CHANGE USERNAME' : 'SET USERNAME') + ' ]</button>' : ''}
        ${walletConnected ? '<button class="wm-disconnect">[ DISCONNECT ]</button>' : ''}
        <button class="wm-cancel">[ CLOSE ]</button>
      </div>`;
    document.body.appendChild(overlay);

    const providers: Record<string, () => any> = {
        phantom: () => (window as any).phantom?.solana || (window as any).solana,
        solflare: () => (window as any).solflare,
        backpack: () => (window as any).backpack,
    };
    const urls: Record<string, string> = { phantom: 'https://phantom.app/', solflare: 'https://solflare.com/', backpack: 'https://backpack.app/' };

    overlay.querySelectorAll('.wm-btn:not(.wm-go)').forEach(btn => btn.addEventListener('click', async () => {
        const type = (btn as HTMLElement).dataset.type!;
        if (type === 'watch') { (document.getElementById('wm-watch-entry')!).style.display = 'block'; return; }
        const provider = providers[type]();
        if (!provider) { window.open(urls[type], '_blank'); return; }
        try {
            const resp = await provider.connect();
            userPublicKey = resp.publicKey ? resp.publicKey.toString() : resp.toString();
            walletConnected = true;
            (window as any).activeSolanaProvider = provider;
            localStorage.setItem('walletType', type);
            localStorage.removeItem('watchAddress');
            await syncBalance();
            await loadUsername();
            overlay.remove();
            if (!arcadeUsername) showUsernameModal(false);
        } catch (e) { console.error('Wallet connect rejected', e); }
    }));

    overlay.querySelector('.wm-go')?.addEventListener('click', async () => {
        const addr = (document.getElementById('wm-addr') as HTMLInputElement).value.trim();
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
            document.getElementById('wm-err')!.textContent = 'INVALID ADDRESS. Check for typos.'; return;
        }
        userPublicKey = addr; walletConnected = true;
        localStorage.setItem('watchAddress', addr);
        localStorage.removeItem('walletType');
        await syncBalance();
        await loadUsername();
        overlay.remove();
        if (!arcadeUsername) showUsernameModal(false);
    });

    overlay.querySelector('.wm-username')?.addEventListener('click', () => { overlay.remove(); showUsernameModal(!!arcadeUsername); });
    overlay.querySelector('.wm-disconnect')?.addEventListener('click', () => {
        walletConnected = false; userPublicKey = ''; tokenBalance = 0;
        localStorage.removeItem('walletType'); localStorage.removeItem('watchAddress');
        walletLabel(); overlay.remove();
    });
    overlay.querySelector('.wm-cancel')?.addEventListener('click', () => overlay.remove());
}

// ============================================================
// CONTACT US (logged to Supabase via the submit_feedback RPC)
// ============================================================
function showUsernameModal(isEdit: boolean) {
    if (!walletConnected || !userPublicKey) { showWalletModal(); return; }
    if (document.getElementById('arcade-username-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'arcade-username-modal';
    overlay.innerHTML = `
      <div class="wm-dialog">
        <h2>${isEdit ? 'CHANGE USERNAME' : 'CHOOSE YOUR USERNAME'}</h2>
        <p class="wm-hint">This is your name on the leaderboards and champion boards.
        3-16 characters: letters, numbers, underscore. Must be unique and clean.</p>
        <input id="un-input" class="ct-field" type="text" placeholder="e.g. AcePilot" maxlength="16"
          spellcheck="false" autocomplete="off" value="${isEdit ? arcadeUsername : ''}" />
        <div id="un-msg"></div>
        <button class="wm-btn wm-go" id="un-save">${isEdit ? 'SAVE' : 'CLAIM USERNAME'}</button>
        ${isEdit ? '' : '<button class="wm-cancel" id="un-skip">SKIP FOR NOW</button>'}
        ${isEdit ? '<button class="wm-cancel" id="un-cancel">[ CLOSE ]</button>' : ''}
      </div>`;
    document.body.appendChild(overlay);

    const input = document.getElementById('un-input') as HTMLInputElement;
    const msg = document.getElementById('un-msg')!;
    input.focus();

    input.addEventListener('input', () => {
        const v = input.value.trim();
        if (v.length === 0) { msg.textContent = ''; msg.className = ''; return; }
        if (!/^[A-Za-z][A-Za-z0-9_]{2,15}$/.test(v)) {
            msg.textContent = '3-16 chars, start with a letter, letters/numbers/_ only';
            msg.className = 'un-bad';
        } else { msg.textContent = 'Looks good \u2014 checking happens on save'; msg.className = 'un-ok'; }
    });

    const save = document.getElementById('un-save') as HTMLButtonElement;
    save.addEventListener('click', async () => {
        const v = input.value.trim();
        save.disabled = true; save.textContent = 'CHECKING...';
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_username`, {
                method: 'POST', headers: sbHeaders,
                body: JSON.stringify({ p_wallet: userPublicKey, p_username: v })
            });
            const r = await res.json();
            if (r && r.ok) {
                arcadeUsername = r.username;
                localStorage.setItem('arcadeUsername', r.username);
                walletLabel();
                fetchRatings();
                overlay.remove();
            } else {
                msg.textContent = (r && r.error) ? r.error : 'Could not set username.';
                msg.className = 'un-bad';
                save.disabled = false; save.textContent = isEdit ? 'SAVE' : 'CLAIM USERNAME';
            }
        } catch (e) {
            msg.textContent = 'Network error. Try again.'; msg.className = 'un-bad';
            save.disabled = false; save.textContent = isEdit ? 'SAVE' : 'CLAIM USERNAME';
        }
    });

    overlay.querySelector('#un-skip')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#un-cancel')?.addEventListener('click', () => overlay.remove());
}

function showContactModal() {
    if (document.getElementById('arcade-contact-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'arcade-contact-modal';
    overlay.innerHTML = `
      <div class="wm-dialog">
        <h2>WRITE TO US</h2>
        <p class="wm-hint">Question, bug report, or a game you want hosted in the arcade &mdash;
        drop it here and we'll get back to you.</p>
        <select id="ct-category" class="ct-select">
          <option value="feedback">Feedback</option>
          <option value="complaint">Complaint</option>
          <option value="pitch">Pitch your game</option>
        </select>
        <input id="ct-name" class="ct-field" type="text" placeholder="Username / handle" maxlength="40" autocomplete="off" />
        <input id="ct-email" class="ct-field" type="email" placeholder="Email address" maxlength="254" autocomplete="off" />
        <textarea id="ct-msg" class="ct-field" placeholder="Your message..." maxlength="2000" rows="5"></textarea>
        <div id="ct-err"></div>
        <button class="wm-btn wm-go" id="ct-send">SEND TRANSMISSION</button>
        <button class="wm-cancel">[ CLOSE ]</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.wm-cancel')?.addEventListener('click', () => overlay.remove());

    // Auto-populate the username from the connected wallet (still editable)
    if (walletConnected && userPublicKey) {
        (document.getElementById('ct-name') as HTMLInputElement).value =
            `WL_${userPublicKey.substring(0, 6)}`;
    }

    overlay.querySelector('#ct-send')?.addEventListener('click', async () => {
        const name = (document.getElementById('ct-name') as HTMLInputElement).value.trim();
        const email = (document.getElementById('ct-email') as HTMLInputElement).value.trim();
        const msg = (document.getElementById('ct-msg') as HTMLTextAreaElement).value.trim();
        const err = document.getElementById('ct-err')!;
        if (name.length < 2) { err.textContent = 'ENTER A USERNAME (2+ CHARACTERS).'; return; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = 'ENTER A VALID EMAIL ADDRESS.'; return; }
        if (msg.length < 5) { err.textContent = 'YOUR MESSAGE IS TOO SHORT.'; return; }
        err.textContent = '';
        const btn = document.getElementById('ct-send') as HTMLButtonElement;
        btn.textContent = 'TRANSMITTING...'; btn.disabled = true;
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_feedback`, {
                method: 'POST', headers: sbHeaders,
                body: JSON.stringify({ p_email: email, p_username: name, p_message: msg, p_category: (document.getElementById('ct-category') as HTMLSelectElement).value })
            });
            const ok = await res.json();
            if (ok === true) {
                (overlay.querySelector('.wm-dialog') as HTMLElement).innerHTML =
                    '<h2>\u2705 TRANSMISSION RECEIVED</h2><p class="wm-hint" style="text-align:center;">Thanks! We read everything and reply by email.</p>';
                setTimeout(() => overlay.remove(), 2500);
            } else { throw new Error('rejected'); }
        } catch (e) {
            err.textContent = 'TRANSMISSION FAILED. PLEASE TRY AGAIN.';
            btn.textContent = 'SEND TRANSMISSION'; btn.disabled = false;
        }
    });
}

// ============================================================
// CONTRACT ADDRESS CHIP
// ============================================================
function setupCA() {
    const chip = document.getElementById('ca-chip');
    const text = document.getElementById('ca-text');
    if (!chip || !text) return;
    const shortCA = CONTRACT_ADDRESS.length > 20 ? `${CONTRACT_ADDRESS.substring(0, 10)}...${CONTRACT_ADDRESS.substring(CONTRACT_ADDRESS.length - 6)}` : CONTRACT_ADDRESS;
    text.textContent = shortCA;
    chip.addEventListener('click', () => {
        try { navigator.clipboard.writeText(CONTRACT_ADDRESS); } catch (e) {}
        text.textContent = 'COPIED TO CLIPBOARD!';
        setTimeout(() => { text.textContent = shortCA; }, 1500);
    });
}

// ============================================================
// BOOT - runs whether or not DOMContentLoaded already fired,
// and never lets one failing subsystem kill the others.
// ============================================================
function boot() {
    const safe = (label: string, fn: () => void) => {
        try { fn(); } catch (e) { console.error(`[ARCADE] ${label} failed:`, e); }
    };
    safe('carousel', buildSusan);
    safe('catalog', buildCatalog);
    safe('pager', () => {
        document.getElementById('cat-prev')?.addEventListener('click', () => { if (catalogPage > 0) { catalogPage--; buildCatalog(); } });
        document.getElementById('cat-next')?.addEventListener('click', () => { catalogPage++; buildCatalog(); });
    });
    safe('ratings', fetchRatings);
    safe('champions', fetchChampions);
    safe('bounce', () => {
        let reason = '';
        try { reason = sessionStorage.getItem('gateBounce') || ''; sessionStorage.removeItem('gateBounce'); } catch (e) {}
        if (!reason) return;
        // wait for wallet restore to resolve, then show the right prompt
        setTimeout(() => {
            if (reason === 'connect') showWalletModal();
            else if (reason === 'username') showUsernameModal(false);
            else showTokenGateModal();
        }, 800);
    });
    safe('inputs', wireInputs);
    safe('ca', setupCA);
    safe('stats', startPresence);
    safe('wallet', () => { restoreWallet().then(walletLabel); });
    safe('buttons', () => {
        document.getElementById('play-btn')?.addEventListener('click', () => {
            const g = FEATURED[susanIndex];
            if (g.url) attemptLaunch(g.url);
        });
        document.getElementById('wallet-btn')?.addEventListener('click', showWalletModal);
        document.getElementById('contact-btn')?.addEventListener('click', showContactModal);
        document.getElementById('tokenomics-btn')?.addEventListener('click', () => {
            document.getElementById('tokenomics')?.scrollIntoView({ behavior: 'smooth' });
        });
    });
    safe('intro', () => {
        if (sessionStorage.getItem('introPlayed')) return; // once per visit, not per navigation
        sessionStorage.setItem('introPlayed', '1');
        playIntroVideo({ src: './intro.mp4', showOncePerPlayer: false });
    });
    // Belt-and-braces: if the intro overlay somehow sticks, kill it
    setTimeout(() => document.getElementById('intro-video-overlay')?.remove(), 25000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot(); // DOM was already parsed by the time this module ran
}
