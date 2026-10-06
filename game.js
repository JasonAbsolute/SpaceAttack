(() => {
  'use strict';

  const canvas = document.querySelector('#arena');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const ui = {
    start: document.querySelector('#startButton'), restart: document.querySelector('#restartButton'),
    overlay: document.querySelector('#screenOverlay'), end: document.querySelector('#endOverlay'),
    frame: document.querySelector('.game-frame'),
    bossFill: document.querySelector('#bossHealthFill'), bossBar: document.querySelector('.boss-bar'),
    bossPhase: document.querySelector('#bossPhase'), score: document.querySelector('#scoreValue'),
    wave: document.querySelector('#waveValue'), shots: document.querySelector('#shotsCount'),
    pikmin: document.querySelector('#nextPikmin'), pikminName: document.querySelector('#pikminName'),
    pikminDescription: document.querySelector('#pikminDescription'), pikminSprite: document.querySelector('#pikminSprite'),
    bossTag: document.querySelector('#bossStatusTag'), captainCard: document.querySelector('#captainCard'),
    captainSprite: document.querySelector('#olimarSprite'), captainStatus: document.querySelector('#captainStatus'),
    hpFill: document.querySelector('#playerHealthFill'),
    hp: document.querySelector('#hpValue'), lives: document.querySelector('#livesValue'),
    bossStatus: document.querySelector('#bossStatusValue'), resultEyebrow: document.querySelector('#resultEyebrow'),
    resultTitle: document.querySelector('#resultTitle'), resultCopy: document.querySelector('#resultCopy'),
    finalScore: document.querySelector('#finalScore'), sound: document.querySelector('#soundToggle'),
    music: document.querySelector('#bossMusic'),
    musicToggle: document.querySelector('#musicToggle'), musicVolume: document.querySelector('#musicVolume'),
  };

  const pikmin = [
    { id: 'red', name: 'RED', color: '#ff686f', sprite: 'assets/pikmin-red.png', description: 'Double damage.<br />A bold little spark.' },
    { id: 'electric', name: 'ELECTRIC', color: '#f3d85b', sprite: 'assets/pikmin-electric.png', description: 'Stuns Sans for 3 seconds.<br />That ought to rattle him.' },
    { id: 'blue', name: 'BLUE', color: '#67b6ff', sprite: 'assets/pikmin-blue.png', description: 'Slows the boss down.<br />A cool head in a crisis.' },
    { id: 'white', name: 'WHITE', color: '#ededf4', sprite: 'assets/pikmin-white.png', description: 'Poison for 10 seconds.<br />2 damage every second.' },
    { id: 'purple', name: 'PURPLE', color: '#b08af5', sprite: 'assets/pikmin-purple.png', description: 'Four times the damage.<br />Small ship, big bonk.' },
  ];
  const bossSprites = ['assets/sans-standing.png', 'assets/sans-attack-a.png', 'assets/sans-shrug.png'].map((src) => {
    const image = new Image(); image.src = src; return image;
  });
  const captainFrames = [1, 2, 3, 4, 5].map((n) => `assets/olimar-idle-${n}.png`);
  const flowerSprite = new Image(); flowerSprite.src = 'assets/pikmin-flower.png';
  const damageFxSprite = new Image();
  damageFxSprite.src = 'sprites/damage effects.png';
  const effectAudio = Object.fromEntries(Object.entries({
    sansVoice: 'sound%20effect/voice_sans.mp3',
    pikminAttack: 'sound%20effect/attack1.mp3',
    pikminMiss: 'sound%20effect/throw.mp3',
    sansHit: 'sound%20effect/undertale-damage-taken.mp3',
    shipDeath: 'sound%20effect/death2.mp3',
    bossDefeat: 'sound%20effect/undertale-game-over.mp3',
    battleStart: 'sound%20effect/undertale-battle-start.mp3',
  }).map(([name, src]) => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.volume = .32;
    return [name, audio];
  }));
  const shipSprite = new Image();
  shipSprite.src = 'assets/olimar-ship.png';
  const pikminSprites = new Map(pikmin.map((p) => {
    const image = new Image(); image.src = p.sprite;
    return [p.id, image];
  }));
  const moveNames = ['', 'SIDEWINDER', 'BONE ORBIT', 'BLUE SOUL LOCK', 'BONE WALL', 'GASTER BEAM', 'BONE STORM', 'CROSS CUT', 'TRIPLE CRUSH'];
  const sansQuips = [
    'wow, your ship is tiny.', 'flower power. neat.', 'you call that a laser?',
    "i'm bonely impressed.", 'nice dodging. mostly.', 'captain, steer us home.',
    "your aim's out of orbit.", 'welp. this is awkward.',
  ];
  const keys = new Set();
  const stars = Array.from({ length: 96 }, (_, i) => ({
    x: (i * 173 + 29) % W, y: (i * 97 + 11) % H,
    size: i % 8 === 0 ? 2 : 1, phase: i * 1.72, drift: .2 + (i % 6) * .12,
  }));
  const state = {
    mode: 'title', last: 0, elapsed: 0, standoffTime: 0, wave: 1, score: 0,
    bossMax: 900, bossHp: 900, bossX: W / 2, bossY: 100, bossVx: 105,
    bossFire: 1.25, pressure: 0, unlockedMoves: 0, attackCursor: 0, frenzy: false,
    telegraph: null, beam: null, callout: '', calloutLeft: 0,
    bossAttackLeft: 0, bossAttackCount: 0, bossHurtLeft: 0, bossQuip: '', bossQuipLeft: 0, bossQuipProgress: 0,
    bossHitSfxLeft: 0,
    introStep: '', introTime: 0, deathTime: 0,
    cutsceneStep: '', cutsceneTime: 0, cutsceneShotLength: 0, cutsceneEndTimer: 0,
    captainWorryLeft: 0, captainAnimationTime: 0, captainFrame: 0,
    hitFx: [],
    poisonTick: 0, poisonLeft: 0, stunLeft: 0, slowLeft: 0,
    player: { x: W / 2, y: H - 76, hp: 100, lives: 3, invuln: 0, fire: 0, shots: 0, moved: false },
    bolts: [], shots: [], particles: [], shake: 0, burst: 0,
    audio: null, audioOn: true, audioTimer: null, audioStep: 0,
  };

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function formatScore(score) { return String(Math.max(0, Math.floor(score))).padStart(6, '0'); }

  function setNextPikmin() {
    const next = pikmin[Math.floor(state.player.shots / 10) % pikmin.length];
    ui.pikmin.dataset.kind = next.id;
    ui.pikminName.textContent = next.name;
    ui.pikminDescription.innerHTML = next.description;
    ui.pikminSprite.src = next.sprite;
    ui.pikminSprite.alt = `${next.name.toLowerCase()} Pikmin on deck`;
    document.querySelectorAll('.deck-item').forEach((el) => el.classList.toggle('active', el.dataset.kind === next.id));
    const left = 10 - (state.player.shots % 10);
    ui.shots.innerHTML = `${left} <small>SHOT${left === 1 ? '' : 'S'}</small>`;
  }

  function updateHUD() {
    const bossRatio = clamp(state.bossHp / state.bossMax, 0, 1);
    const oldMoves = state.unlockedMoves;
    state.pressure = Math.min(20, Math.floor((1 - bossRatio) * 20 + 0.0001));
    state.unlockedMoves = Math.min(9, Math.floor((1 - bossRatio) * 10 + 0.0001));
    state.frenzy = bossRatio <= .1;
    state.wave = state.unlockedMoves + 1;
    ui.frame.classList.toggle('is-frenzy', state.frenzy);
    if (state.unlockedMoves > oldMoves && state.mode === 'fight') {
      const title = state.unlockedMoves >= 9 ? 'FINAL FRENZY' : moveNames[state.unlockedMoves];
      state.callout = `NEW MOVE: ${title}`;
      state.calloutLeft = 1.8;
      state.burst = 1.25;
      state.attackCursor = state.unlockedMoves;
    }
    ui.score.textContent = formatScore(state.score);
    ui.wave.textContent = String(state.wave).padStart(2, '0');
    ui.bossPhase.textContent = state.mode === 'intro'
      ? state.introStep === 'health' ? 'BOSS HP · SYNCHRONIZING' : 'INCOMING · DEEP SPACE'
      : state.frenzy ? 'FINAL FRENZY · HEAT 20/20'
        : `MOVE ${String(state.unlockedMoves + 1).padStart(2, '0')}/10 · HEAT ${String(state.pressure).padStart(2, '0')}/20`;
    const introRatio = state.mode === 'intro' && state.introStep === 'health'
      ? clamp(state.introTime / 1.7, 0, 1) * bossRatio
      : state.mode === 'intro' ? 0 : bossRatio;
    ui.frame.classList.toggle('is-intro', state.mode === 'intro');
    ui.frame.classList.toggle('is-intro-hidden', state.mode === 'intro' && state.introStep !== 'health');
    ui.bossFill.style.width = `${introRatio * 100}%`;
    ui.bossBar.setAttribute('aria-valuenow', String(Math.ceil(introRatio * 100)));
    const hpRatio = clamp(state.player.hp / 100, 0, 1);
    ui.hpFill.style.width = `${hpRatio * 100}%`;
    ui.hp.textContent = `${Math.ceil(state.player.hp)} / 100`;
    ui.lives.textContent = `${state.player.lives > 0 ? '♥ '.repeat(state.player.lives).trim() : '—'}${state.player.lives > 0 ? ' ♡'.repeat(3 - state.player.lives) : ''}`;
    ui.lives.setAttribute('aria-label', `${state.player.lives} lives`);
    const statuses = [];
    if (state.poisonLeft > 0) statuses.push(`POISONED ${state.poisonLeft.toFixed(1)}s`);
    if (state.stunLeft > 0) statuses.push(`STUNNED ${state.stunLeft.toFixed(1)}s`);
    if (state.slowLeft > 0) statuses.push(state.slowLeft < 2 ? `SLOWED ${state.slowLeft.toFixed(1)}s` : 'SLOWED DOWN');
    ui.bossTag.hidden = statuses.length === 0;
    ui.bossTag.className = `boss-state-chip${state.poisonLeft > 0 ? ' has-poison' : state.stunLeft > 0 ? ' has-stun' : ''}`;
    ui.bossTag.textContent = statuses.join(' · ');
    if (statuses.length) {
      ui.bossStatus.className = 'status-active';
      ui.bossStatus.textContent = statuses.join(' · ');
    } else {
      ui.bossStatus.className = 'status-idle';
      ui.bossStatus.textContent = state.mode === 'standoff' ? 'STANDOFF · SANS IS WATCHING'
        : state.mode === 'cutscene' ? 'SIGNAL DEFEATED · FINAL SHOT'
          : state.frenzy ? 'BERSERK · MOVE FAST' : 'LOOKING PRETTY CHILL';
    }
    setNextPikmin();
  }

  function reset() {
    // Don't let a key held during the previous run leak into the new one.
    keys.clear();
    Object.assign(state, {
      mode: 'intro', elapsed: 0, standoffTime: 0, wave: 1, score: 0,
      bossHp: state.bossMax, bossX: W / 2, bossY: -155, bossVx: 105, bossFire: 1.25,
      pressure: 0, unlockedMoves: 0, attackCursor: 0, frenzy: false,
      telegraph: null, beam: null, callout: '', calloutLeft: 0,
      bossAttackLeft: 0, bossAttackCount: 0, bossHurtLeft: 0,
      bossQuip: '', bossQuipLeft: 0, bossQuipProgress: 0, bossHitSfxLeft: 0,
      introStep: 'arrival', introTime: 0, deathTime: 0,
      cutsceneStep: '', cutsceneTime: 0, cutsceneShotLength: 0, cutsceneEndTimer: 0,
      captainWorryLeft: 0, captainAnimationTime: 0, captainFrame: 0,
      hitFx: [],
      poisonTick: 0, poisonLeft: 0, stunLeft: 0, slowLeft: 0,
      bolts: [], shots: [], particles: [], shake: 0, burst: 0,
    });
    Object.assign(state.player, { x: W / 2, y: H + 120, hp: 100, lives: 3, invuln: 0, fire: 0, shots: 0, moved: false });
    ui.overlay.classList.add('is-hidden');
    ui.end.classList.add('is-hidden');
    updateHUD();
    canvas.focus({ preventScroll: true });
    ui.music.currentTime = 0;
    ui.music.play().then(() => {
      updateMusicButton();
      canvas.focus({ preventScroll: true });
    }).catch(updateMusicButton);
    if (state.audioOn) startAudio();
  }

  function beginFight() {
    if (state.mode !== 'standoff') return;
    state.mode = 'fight';
    state.elapsed = 0;
    state.wave = 1;
    state.bossFire = 1.25;
    state.bossY = 100;
    playEffect('battleStart', .33);
    updateHUD();
  }

  function endGame(won) {
    state.mode = won ? 'won' : 'lost';
    if (!won) {
      ui.music.pause();
      ui.music.currentTime = 0;
      stopAudio();
      updateMusicButton();
    }
    ui.resultEyebrow.textContent = won ? 'SIGNAL RESTORED' : 'SIGNAL LOST';
    ui.resultTitle.textContent = won ? 'YOU WIN!' : 'GAME OVER';
    ui.resultTitle.style.color = won ? '#68e5da' : '';
    ui.resultCopy.textContent = won ? 'The little ship saved the stars. Nice flying.' : 'The stars are still there. So is your rematch.';
    ui.finalScore.textContent = formatScore(state.score);
    ui.end.classList.remove('is-hidden');
    updateHUD();
  }

  function beginVictorySequence() {
    if (state.mode === 'cutscene') return;
    state.mode = 'cutscene';
    state.cutsceneStep = 'charge';
    state.cutsceneTime = 0;
    state.cutsceneEndTimer = 0;
    state.bolts = [];
    state.shots = [];
    state.telegraph = null;
    state.beam = null;
    state.poisonLeft = 0;
    state.stunLeft = 0;
    state.slowLeft = 0;
    state.bossAttackLeft = 0;
    state.bossHurtLeft = .62;
    state.hitFx = [];
    playEffect('bossDefeat', .4);
    addDamageFlash(state.bossX, state.bossY + 30, 92);
    updateHUD();
  }

  function fireFinalBlow() {
    state.cutsceneStep = 'final-shot';
    state.cutsceneTime = 0;
    state.cutsceneShotLength = Math.hypot(state.player.x - state.bossX, state.player.y - state.bossY);
    state.shake = .25;
  }

  function updateCutscene(dt) {
    state.cutsceneTime += dt;
    if (state.cutsceneStep === 'charge' && state.cutsceneTime >= 1.85) {
      state.cutsceneStep = 'await-final';
      state.cutsceneTime = 0;
    } else if (state.cutsceneStep === 'final-shot' && state.cutsceneTime >= .82) {
      state.cutsceneStep = 'depart';
      state.cutsceneTime = 0;
      addDamageFlash(state.bossX, state.bossY + 28, 120);
      burstAt(state.bossX, state.bossY + 26, '#7edcff', 36, 210);
    } else if (state.cutsceneStep === 'depart') {
      const p = state.player;
      p.x += 105 * dt;
      p.y -= 430 * dt;
      state.cutsceneEndTimer += dt;
      if (state.cutsceneEndTimer > 1.1 || p.y < -150 || p.x > W + 100) endGame(true);
    }
    updateHitFx(dt);
    for (const part of state.particles) {
      part.x += part.vx * dt; part.y += part.vy * dt;
      part.vx *= .97; part.vy *= .97; part.life -= dt;
    }
    state.particles = state.particles.filter((part) => part.life > 0);
    state.shake = Math.max(0, state.shake - dt);
  }

  function updateIntro(dt) {
    const p = state.player;
    state.introTime += dt;
    tickSansQuip(dt);
    const progress = clamp(state.introTime / (state.introStep === 'arrival' ? 1.35 : state.introStep === 'boss-entrance' ? 1.55 : state.introStep === 'shrug' ? 1.05 : 1.7), 0, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    if (state.introStep === 'arrival') {
      p.y = H + 120 + (H - 76 - (H + 120)) * easeOut;
      p.x = W / 2 + Math.sin(state.introTime * 1.8) * 14 * (1 - progress);
      if (progress >= 1) { p.y = H - 76; state.introStep = 'boss-entrance'; state.introTime = 0; }
    } else if (state.introStep === 'boss-entrance') {
      state.bossY = -155 + (100 + 155) * easeOut;
      if (progress >= 1) {
        state.bossY = 100; state.introStep = 'shrug'; state.introTime = 0;
        state.bossQuip = 'heh.'; state.bossQuipLeft = 1.05; state.bossQuipProgress = 0;
      }
    } else if (state.introStep === 'shrug') {
      state.bossY = 100;
      state.bossX = W / 2;
      if (progress >= 1) { state.introStep = 'health'; state.introTime = 0; updateHUD(); }
    } else if (state.introStep === 'health') {
      state.bossY = 100;
      const fill = Math.round(progress * 100);
      ui.bossFill.style.width = `${fill}%`;
      ui.bossBar.setAttribute('aria-valuenow', String(fill));
      if (progress >= 1) {
        state.mode = 'standoff'; state.introStep = ''; state.introTime = 0; state.standoffTime = 0;
        updateHUD();
      }
    }
  }

  function updateDeath(dt) {
    state.deathTime += dt;
    state.bolts = []; state.shots = []; state.telegraph = null; state.beam = null;
    updateHitFx(dt);
    for (const part of state.particles) {
      part.x += part.vx * dt; part.y += part.vy * dt;
      part.vx *= .97; part.vy *= .97; part.life -= dt;
    }
    state.particles = state.particles.filter((part) => part.life > 0);
    state.shake = Math.max(0, state.shake - dt);
    if (state.deathTime >= 1.15) endGame(false);
  }

  function updateCaptain(dt) {
    if (['fight', 'standoff'].includes(state.mode)) {
      const p = state.player;
      const nearBone = state.bolts.some((bolt) => Math.hypot(bolt.x - p.x, bolt.y - p.y) < 112);
      const nearBeam = state.beam && Math.abs(p.x - state.beam.x) < 128 && p.y > state.bossY + 45;
      if (nearBone || nearBeam) state.captainWorryLeft = Math.max(state.captainWorryLeft, .62);
    }
    state.captainWorryLeft = Math.max(0, state.captainWorryLeft - dt);
    const worried = state.captainWorryLeft > 0;
    state.captainAnimationTime += dt;
    const frameInterval = worried ? .1 : .2;
    if (state.captainAnimationTime >= frameInterval) {
      state.captainAnimationTime %= frameInterval;
      state.captainFrame = (state.captainFrame + 1) % captainFrames.length;
      ui.captainSprite.src = captainFrames[state.captainFrame];
    }
    ui.captainCard.dataset.mood = worried ? 'worried' : 'steady';
    if (worried) ui.captainStatus.textContent = 'ALERT · BONES CLOSE';
    else if (state.mode === 'intro') ui.captainStatus.textContent = 'READY FOR LIFTOFF';
    else if (state.mode === 'cutscene') ui.captainStatus.textContent = state.cutsceneStep === 'depart' ? 'CREW EXTRACTED!' : 'LAST SHOT · CHARGING';
    else if (state.player.hp <= 30) ui.captainStatus.textContent = 'HULL CRITICAL · DANGER';
    else ui.captainStatus.textContent = `CREW ABOARD · ${state.player.lives} LIVES`;
  }

  function tickSansQuip(dt) {
    if (state.bossQuipLeft <= 0 || !state.bossQuip) return;
    const oldLength = Math.floor(state.bossQuipProgress);
    state.bossQuipProgress = Math.min(state.bossQuip.length, state.bossQuipProgress + dt * 25);
    const newLength = Math.floor(state.bossQuipProgress);
    for (let i = oldLength; i < newLength; i++) {
      if (/\S/.test(state.bossQuip[i])) playEffect('sansVoice', .15);
    }
    state.bossQuipLeft = Math.max(0, state.bossQuipLeft - dt);
  }

  function burstAt(x, y, color, count = 10, power = 120) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = rand(power * .25, power);
      state.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: rand(.22, .65), max: .65, color, size: Math.random() < .35 ? 3 : 2 });
    }
  }

  function addDamageFlash(x, y, size) {
    state.hitFx.push({ x, y, size, age: 0, duration: .34, angle: rand(-.3, .3) });
    if (state.hitFx.length > 8) state.hitFx.shift();
  }

  function updateHitFx(dt) {
    for (const flash of state.hitFx) flash.age += dt;
    state.hitFx = state.hitFx.filter((flash) => flash.age < flash.duration);
  }

  function drawHitFx() {
    if (!damageFxSprite.complete || !damageFxSprite.naturalWidth) return;
    for (const flash of state.hitFx) {
      const progress = flash.age / flash.duration;
      const scale = .75 + progress * .7;
      ctx.save();
      ctx.translate(flash.x, flash.y);
      ctx.rotate(flash.angle);
      ctx.globalAlpha = 1 - progress;
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'hue-rotate(182deg) saturate(1.55)';
      ctx.shadowColor = '#51dfff';
      ctx.shadowBlur = 20 * (1 - progress);
      ctx.drawImage(damageFxSprite, 193, 0, 60, 70, -flash.size * scale / 2, -flash.size * scale / 2, flash.size * scale, flash.size * scale);
      ctx.restore();
    }
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function firePlayerShot() {
    const isSpecial = (state.player.shots + 1) % 10 === 0;
    const next = pikmin[Math.floor(state.player.shots / 10) % pikmin.length];
    state.player.shots += 1;
    state.player.fire = .205;
    if (state.mode === 'standoff') beginFight();
    state.shots.push({
      x: state.player.x, y: state.player.y - 16, vy: isSpecial ? -365 : -505,
      w: isSpecial ? 15 : 5, h: isSpecial ? 21 : 10, color: isSpecial ? next.color : '#70f5ed',
      special: isSpecial, kind: isSpecial ? next : null,
    });
    if (isSpecial) playEffect('pikminAttack', .33);
    if (state.audioOn) soundShot(isSpecial ? 560 : 510, isSpecial ? .09 : .07, 'sine', isSpecial ? .015 : .012);
    updateHUD();
  }

  function addBone(x, y, vx, vy, options = {}) {
    state.bolts.push({
      x, y, vx, vy, w: options.w || 12, h: options.h || 30,
      color: options.color || '#d9dae8', kind: 'bone', angle: Math.atan2(vx, vy), hit: false,
    });
  }

  function fireAimedFan(targetX = state.player.x, targetY = state.player.y, count = 3, spread = 52, speed = 225) {
    const originX = state.bossX;
    const originY = state.bossY + 66;
    const dx = targetX - originX;
    const baseAngle = Math.atan2(targetY - originY, dx);
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i - (count - 1) / 2) * spread * Math.PI / 180;
      addBone(originX, originY, Math.cos(angle) * speed, Math.sin(angle) * speed, { color: i % 2 ? '#d9dce9' : '#9bcaff' });
    }
  }

  function fireAttack(move) {
    const pressure = state.pressure;
    const speed = 185 + pressure * 8;
    const target = state.player;
    const count = Math.min(5, 3 + Math.floor(pressure / 6));
    const originX = state.bossX;
    const originY = state.bossY + 66;
    state.bossAttackCount += 1;
    state.bossAttackLeft = .7;
    if (state.bossAttackCount % 2 === 1) {
      state.bossQuip = sansQuips[Math.floor(Math.random() * sansQuips.length)];
      state.bossQuipLeft = 1.45;
      state.bossQuipProgress = 0;
    }
    if (move === 0) {
      fireAimedFan(target.x, target.y, count, 15 + pressure * .45, speed);
    } else if (move === 1) {
      // Sidewinder: two bones sweep in from opposite edges along the pilot's lane.
      const laneY = clamp(target.y - 58, 300, H - 70);
      addBone(4, laneY - 26, 315 + pressure * 7, 32, { h: 32, color: '#a8c9ff' });
      addBone(W - 4, laneY + 26, -315 - pressure * 7, -24, { h: 32 });
    } else if (move === 2) {
      // Bone orbit opens into a curved fan around the boss.
      for (let i = 0; i < 7; i++) {
        const angle = (.13 + i * .31) * Math.PI;
        addBone(originX, originY, Math.cos(angle) * speed, Math.sin(angle) * speed, { color: i % 2 ? '#e7e5ec' : '#8bd8ff' });
      }
    } else if (move === 3) {
      // Blue soul lock: mark the old position, then punish anyone who stays there.
      state.telegraph = { type: 'soul', x: target.x, y: target.y, timer: .72 };
    } else if (move === 4) {
      // Bone wall leaves one bright, readable gap for a quick dodge.
      const gap = clamp(target.x + rand(-86, 86), 120, W - 120);
      for (let i = 0; i < 8; i++) {
        const x = 50 + i * 123;
        if (Math.abs(x - gap) < 95) continue;
        addBone(x, originY - 5, rand(-12, 12), speed + 100, { h: 46, color: i % 2 ? '#e2e2ed' : '#a6caff' });
      }
    } else if (move === 5) {
      // A long charge makes the vertical blaster beam dodgeable.
      state.telegraph = { type: 'beam', x: clamp(target.x + rand(-115, 115), 60, W - 60), timer: .86 };
    } else if (move === 6) {
      for (let i = 0; i < 9; i++) {
        const x = 38 + i * 110 + rand(-14, 14);
        if (Math.abs(x - target.x) < 55) continue;
        addBone(x, originY - rand(0, 35), rand(-34, 34), speed + rand(60, 125), { h: 32, color: '#dfe6ff' });
      }
    } else if (move === 7) {
      // Crossing bones cut through the arena in opposite directions.
      const y = clamp(target.y + rand(-100, 90), 300, H - 65);
      for (let i = 0; i < 4; i++) {
        const fromLeft = i % 2 === 0;
        addBone(fromLeft ? 0 : W, y + (i - 1.5) * 24, (fromLeft ? 1 : -1) * (270 + pressure * 8), fromLeft ? 18 : -18, { h: 38, color: i % 2 ? '#e8e4ed' : '#9ec9ff' });
      }
    } else {
      // Triple crush, then the 10% frenzy layers in a fan and a broken bone wall.
      fireAimedFan(target.x, target.y, 5, 25, speed + 28);
      if (state.frenzy) {
        for (let i = 0; i < 7; i++) {
          const x = 68 + i * 137;
          if (Math.abs(x - target.x) < 80) continue;
          addBone(x, originY, rand(-25, 25), speed + 130, { h: 34, color: '#ff8aa2' });
        }
        state.shake = Math.max(state.shake, .14);
      }
    }
    if (state.audioOn) soundShot(state.frenzy ? 95 : 135, .11);
  }

  function damageBoss(amount, sourceColor, kind, quiet = false) {
    if (state.bossHp <= 0 || state.mode === 'cutscene') return;
    if (!quiet && state.bossHitSfxLeft <= 0) {
      playEffect('sansHit', .28);
      state.bossHitSfxLeft = .25;
    }
    state.bossHp = Math.max(0, state.bossHp - amount);
    state.score += Math.round(amount * 5);
    state.shake = Math.max(state.shake, kind ? .16 : .06);
    const impactX = state.bossX + rand(-35, 35);
    const impactY = state.bossY + rand(0, 48);
    burstAt(impactX, impactY, sourceColor, kind ? 14 : 4, kind ? 140 : 65);
    addDamageFlash(impactX, impactY, kind ? 58 : 42);
    state.bossHurtLeft = Math.max(state.bossHurtLeft, kind ? .18 : .11);
    updateHUD();
    if (state.bossHp <= 0) {
      state.score += 500;
      beginVictorySequence();
    }
  }

  function applyPikmin(shot) {
    const id = shot.kind.id;
    if (id === 'red') damageBoss(18, shot.color, shot.kind);
    else if (id === 'electric') {
      damageBoss(9, shot.color, shot.kind);
      state.stunLeft = Math.max(state.stunLeft, 3);
    } else if (id === 'blue') {
      damageBoss(9, shot.color, shot.kind);
      state.slowLeft = Math.max(state.slowLeft, 7);
    } else if (id === 'white') {
      damageBoss(9, shot.color, shot.kind);
      state.poisonLeft = Math.max(state.poisonLeft, 10);
      state.poisonTick = 1;
    } else if (id === 'purple') damageBoss(36, shot.color, shot.kind);
    if (state.audioOn) soundShot(690, .09, 'triangle', .014);
    updateHUD();
  }

  function hitPlayer() {
    if (state.player.invuln > 0 || state.mode !== 'fight') return;
    state.player.hp -= 25;
    state.shake = .16;
    burstAt(state.player.x, state.player.y, '#69d8ff', 8, 110);
    addDamageFlash(state.player.x, state.player.y, 54);
    state.captainWorryLeft = Math.max(state.captainWorryLeft, 1.25);
    if (state.player.hp <= 0) {
      state.player.lives -= 1;
      if (state.player.lives <= 0) {
        state.player.hp = 0;
          state.mode = 'death';
          state.deathTime = 0;
          state.bolts = []; state.shots = []; state.telegraph = null; state.beam = null;
          state.shake = .44;
          state.captainWorryLeft = 1.5;
          ui.music.pause();
          ui.music.currentTime = 0;
          stopAudio();
          updateMusicButton();
          playEffect('shipDeath', .42);
          addDamageFlash(state.player.x, state.player.y, 118);
          burstAt(state.player.x, state.player.y, '#fff1a5', 34, 210);
          burstAt(state.player.x, state.player.y, '#59dfff', 22, 165);
        updateHUD();
        return;
      }
      state.player.hp = 100;
    }
    state.player.invuln = 1.15;
    updateHUD();
  }

  function update(dt, time) {
    if (state.mode === 'title' || state.mode === 'won' || state.mode === 'lost') { updateCaptain(dt); return; }
    if (state.mode === 'intro') { updateIntro(dt); updateCaptain(dt); return; }
    if (state.mode === 'death') { updateDeath(dt); updateCaptain(dt); return; }
    if (state.mode === 'cutscene') { updateCutscene(dt); updateCaptain(dt); return; }
    updateCaptain(dt);
    tickSansQuip(dt);
    const p = state.player;
    if (state.mode === 'standoff') {
      state.standoffTime += dt;
      if (state.standoffTime > 2.8) beginFight();
    } else if (state.mode === 'fight') {
      state.elapsed += dt;
    }

    const dx = Number(keys.has('ArrowRight') || keys.has('d') || keys.has('D')) - Number(keys.has('ArrowLeft') || keys.has('a') || keys.has('A'));
    const dy = Number(keys.has('ArrowDown') || keys.has('s') || keys.has('S')) - Number(keys.has('ArrowUp') || keys.has('w') || keys.has('W'));
    if (dx || dy) {
      const mag = Math.hypot(dx, dy) || 1;
      p.x += dx / mag * 360 * dt;
      p.y += dy / mag * 360 * dt;
      p.moved = true;
    }
    p.x = clamp(p.x, 60, W - 60);
    p.y = clamp(p.y, 254, H - 54);
    p.fire = Math.max(0, p.fire - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    state.bossAttackLeft = Math.max(0, state.bossAttackLeft - dt);
    state.bossHurtLeft = Math.max(0, state.bossHurtLeft - dt);
    state.shake = Math.max(0, state.shake - dt);
    state.burst = Math.max(0, state.burst - dt);
    state.calloutLeft = Math.max(0, state.calloutLeft - dt);
    state.bossHitSfxLeft = Math.max(0, state.bossHitSfxLeft - dt);

    if ((keys.has(' ') || keys.has('Space')) && p.fire <= 0 && (state.mode === 'standoff' || state.mode === 'fight')) firePlayerShot();

    if (state.mode === 'fight') {
      const slowFactor = state.slowLeft > 0 ? .48 : 1;
      const frozen = state.stunLeft > 0;
      if (!frozen && state.bossAttackLeft > 0) {
        state.bossX += (W / 2 - state.bossX) * Math.min(1, dt * 4);
      } else if (!frozen) {
        const speed = 105 + state.pressure * 12;
        state.bossX += Math.sign(state.bossVx || 1) * speed * slowFactor * dt;
        if (state.bossX > W - 145 || state.bossX < 145) state.bossVx *= -1;
        state.bossX = clamp(state.bossX, 145, W - 145);
      }
      const attackRate = state.frenzy ? .3 : Math.max(.48, 1.34 - state.pressure * .043);
      state.bossFire -= dt;
      if (state.bossFire <= 0 && !frozen) {
        const move = state.frenzy ? 8 : state.attackCursor > 0 ? state.attackCursor : Math.floor(Math.random() * (state.unlockedMoves + 1));
        state.attackCursor = 0;
        fireAttack(move);
        state.bossFire = attackRate;
      }
    }

    if (state.telegraph) {
      state.telegraph.timer -= dt;
      if (state.telegraph.timer <= 0) {
        if (state.telegraph.type === 'beam') {
          state.beam = { x: state.telegraph.x, timer: state.frenzy ? .65 : .48, hit: false };
        } else {
          fireAimedFan(state.telegraph.x, state.telegraph.y, state.frenzy ? 5 : 3, 9, 310 + state.pressure * 8);
          if (state.audioOn) soundShot(230, .16);
        }
        state.telegraph = null;
      }
    }
    if (state.beam) {
      state.beam.timer -= dt;
      const beamHit = Math.abs(p.x - state.beam.x) < 23 && p.y > state.bossY + 70;
      if (beamHit && !state.beam.hit) { state.beam.hit = true; hitPlayer(); }
      if (state.beam.timer <= 0) state.beam = null;
    }

    state.stunLeft = Math.max(0, state.stunLeft - dt);
    state.slowLeft = Math.max(0, state.slowLeft - dt);
    if (state.poisonLeft > 0 && state.mode === 'fight') {
      state.poisonLeft = Math.max(0, state.poisonLeft - dt);
      state.poisonTick -= dt;
      if (state.poisonTick <= 0 && state.poisonLeft > 0) {
        damageBoss(2, '#d8ecf2', null, true);
        state.poisonTick += 1;
      }
    }

    for (const s of state.shots) {
      s.y += s.vy * dt;
      if (s.y <= -30 && s.special) playEffect('pikminMiss', .25);
    }
    state.shots = state.shots.filter((s) => s.y > -30);
    for (const b of state.bolts) { b.x += b.vx * dt; b.y += b.vy * dt; }
    state.bolts = state.bolts.filter((b) => b.y < H + 50);

    for (let i = state.shots.length - 1; i >= 0; i--) {
      const s = state.shots[i];
      if (s.y < state.bossY + 72 && s.y > state.bossY - 66 && Math.abs(s.x - state.bossX) < 70) {
        if (s.special) applyPikmin(s); else damageBoss(9, s.color, null);
        state.shots.splice(i, 1);
      }
    }
    for (let i = state.bolts.length - 1; i >= 0; i--) {
      const b = state.bolts[i];
      const hit = Math.abs(b.x - p.x) < 20 + b.w * .35 && Math.abs(b.y - p.y) < 17 + b.h * .28;
      if (hit) {
        state.bolts.splice(i, 1);
        hitPlayer();
        // A fatal hit clears every bolt. Stop iterating the now-cleared array.
        if (state.mode === 'death') return;
      }
    }
    if (state.mode === 'death') return;
    for (const part of state.particles) { part.x += part.vx * dt; part.y += part.vy * dt; part.vx *= .97; part.vy *= .97; part.life -= dt; }
    state.particles = state.particles.filter((part) => part.life > 0);
    updateHitFx(dt);
    if (Math.floor(time / 180) % 2 === 0) updateHUD();
  }

  function drawBackground(time) {
    const drift = time * (state.frenzy ? .055 : .022);
    ctx.fillStyle = '#070910';
    ctx.fillRect(0, 0, W, H);
    // Slow, overlapping nebula clouds give the arena depth at several parallax speeds.
    ctx.globalCompositeOperation = 'screen';
    const clouds = [
      { x: 158, y: 215, r: 245, c: state.frenzy ? 'rgba(180,55,110,.17)' : 'rgba(58,88,143,.17)', speed: .20 },
      { x: 740, y: 298, r: 300, c: state.frenzy ? 'rgba(238,63,95,.13)' : 'rgba(106,57,143,.17)', speed: -.14 },
      { x: 470, y: 88, r: 220, c: 'rgba(47,144,154,.11)', speed: .1 },
      { x: 380, y: 492, r: 260, c: 'rgba(145,72,122,.09)', speed: -.08 },
    ];
    for (const cloud of clouds) {
      const x = cloud.x + Math.sin(time * .00012 + cloud.speed) * 65 + drift * cloud.speed;
      const y = cloud.y + Math.cos(time * .00011 + cloud.speed) * 30;
      const glow = ctx.createRadialGradient(x, y, cloud.r * .06, x, y, cloud.r);
      glow.addColorStop(0, cloud.c);
      glow.addColorStop(.42, cloud.c.replace(/\.\d+\)$/, '.045)'));
      glow.addColorStop(1, 'rgba(8,10,18,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
    // A distant ringed planet drifts behind the action.
    ctx.save();
    ctx.translate(812 + Math.sin(time * .00012) * 16, 366 + Math.cos(time * .00016) * 8);
    ctx.globalAlpha = .27;
    ctx.strokeStyle = '#a98de8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 79, 23, -.25, 0, Math.PI * 2); ctx.stroke();
    const planet = ctx.createRadialGradient(-16, -17, 3, 0, 0, 43);
    planet.addColorStop(0, '#d5c5ff'); planet.addColorStop(.4, '#8474c1'); planet.addColorStop(1, '#302849');
    ctx.fillStyle = planet; ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    for (const star of stars) {
      const speed = star.drift * (state.frenzy ? .09 : .04);
      const y = (star.y + time * speed) % H;
      const x = (star.x + time * star.drift * (state.frenzy ? -.008 : -.003)) % W;
      const twinkle = .34 + .66 * (.5 + .5 * Math.sin(time * .0015 + star.phase));
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = star.size > 1 ? '#d1caf4' : '#a2bfd6';
      if (state.frenzy && star.size > 1) {
        ctx.fillRect(x - 1, y, 9, 1.5);
        ctx.fillStyle = '#ffadc0'; ctx.fillRect(x, y - 1, 1.5, 4);
      } else {
        ctx.beginPath(); ctx.arc(x, y, star.size * .7, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // Soft drifting motes move at a different depth than the starfield.
    for (let i = 0; i < 16; i++) {
      const x = (i * 67 + Math.sin(time * .00021 + i) * 34 + W) % W;
      const y = (i * 53 + time * (.006 + (i % 4) * .002)) % H;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(128,239,235,.35)' : 'rgba(230,184,244,.28)';
      ctx.beginPath(); ctx.arc(x, y, 1.2 + (i % 2), 0, Math.PI * 2); ctx.fill();
    }
    const vignette = ctx.createRadialGradient(W / 2, H / 2, 140, W / 2, H / 2, 610);
    vignette.addColorStop(0, 'rgba(4,5,10,0)'); vignette.addColorStop(1, 'rgba(4,5,10,.58)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
  }

  function drawBoss(time) {
    if (state.mode === 'cutscene' && state.cutsceneStep === 'depart') return;
    const x = state.bossX;
    const defeated = state.mode === 'cutscene';
    const y = state.bossY + Math.sin(time * .0018) * (defeated ? 3 : 7) + (defeated ? 7 : 0);
    const enraged = state.frenzy || state.bossHp < state.bossMax * .28;
    const stunned = state.stunLeft > 0;
    const poisoned = state.poisonLeft > 0;
    const attacking = state.bossAttackLeft > 0 && !defeated;
    const attackFrame = Math.floor((.7 - state.bossAttackLeft) * 12) % 8;
    const showBlasterPose = attackFrame === 1 || attackFrame === 2 || attackFrame === 5 || attackFrame === 6;
    const shrugging = state.mode === 'intro' && state.introStep === 'shrug';
    const bossSprite = shrugging ? bossSprites[2] : attacking && showBlasterPose ? bossSprites[1] : bossSprites[0];
    ctx.save();
    ctx.translate(x, y);
    if (attacking && state.player.x < x) ctx.scale(-1, 1);
    ctx.rotate(defeated ? -.09 + Math.sin(time * .006) * .045 : attacking ? Math.sin(time * .014) * .025 : Math.sin(time * .0011) * .018);
    const scale = 1 + Math.sin(time * .0024) * .014 + (enraged ? .025 : 0) - (defeated ? .035 : 0);
    ctx.scale(scale, scale);
    if (enraged && !stunned && !defeated) { ctx.shadowColor = '#ff547d'; ctx.shadowBlur = state.frenzy ? 35 : 18; }
    const halo = 91 + Math.sin(time * .003) * 2;
    const haloFill = ctx.createRadialGradient(0, -22, 5, 0, -22, halo + 22);
    haloFill.addColorStop(0, poisoned ? 'rgba(124,245,109,.26)' : enraged && !defeated ? 'rgba(255,93,137,.22)' : 'rgba(121,115,168,.27)');
    haloFill.addColorStop(.72, 'rgba(43,39,65,.14)');
    haloFill.addColorStop(1, 'rgba(43,39,65,0)');
    ctx.fillStyle = haloFill; ctx.beginPath(); ctx.arc(0, -22, halo + 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = poisoned ? 'rgba(144,245,108,.72)' : enraged && !defeated ? 'rgba(255,100,141,.58)' : 'rgba(201,189,236,.46)';
    ctx.lineWidth = stunned ? 3 : 1.5; ctx.beginPath(); ctx.ellipse(0, -22, halo + (stunned ? 9 : 0), halo - 6, 0, 0, Math.PI * 2); ctx.stroke();
    if (bossSprite.complete && bossSprite.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      ctx.shadowColor = poisoned ? '#86ff68' : state.bossHurtLeft > 0 ? '#49caff' : enraged ? '#ff547d' : '#a9a1d4';
      ctx.shadowBlur = poisoned ? 24 : state.bossHurtLeft > 0 ? 27 : enraged ? 22 : 12;
      ctx.globalAlpha = defeated ? .77 + Math.sin(time * .012) * .05 : 1;
      if (poisoned) ctx.filter = 'sepia(1) hue-rotate(68deg) saturate(1.8) brightness(1.06)';
      else if (defeated) ctx.filter = 'saturate(.5) brightness(.82)';
      else if (state.bossHurtLeft > 0) ctx.filter = 'hue-rotate(176deg) saturate(1.3) brightness(1.2)';
      if (attacking && showBlasterPose) ctx.drawImage(bossSprite, -96, -103, 192, 204);
      else ctx.drawImage(bossSprite, -77, -106, 154, 212);
      ctx.filter = 'none';
    } else {
      const fallback = ctx.createRadialGradient(-20, -40, 5, 0, 0, 75);
      fallback.addColorStop(0, '#fffdf4'); fallback.addColorStop(1, '#9da2b8');
      ctx.fillStyle = fallback; ctx.beginPath(); ctx.ellipse(0, -4, 60, 60, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#14141d'; ctx.beginPath(); ctx.ellipse(-22, -9, 10, 16, 0, 0, Math.PI * 2); ctx.ellipse(22, -9, 10, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-31, 23, 62, 8); ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) ctx.fillRect(-26 + i * 10, 23, 4, 7);
    }
    if (poisoned) {
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 6; i++) {
        const angle = time * .002 + i * Math.PI / 3;
        const radius = 54 + (i % 3) * 12;
        ctx.globalAlpha = .38 + .28 * Math.sin(time * .009 + i);
        ctx.fillStyle = '#98fa65';
        ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, -25 + Math.sin(angle) * radius * .64, 2 + (i % 2), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (stunned) {
      ctx.shadowColor = '#f8e67c'; ctx.shadowBlur = 28;
      ctx.strokeStyle = 'rgba(248,230,124,.7)';
      ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -22, 102, 102, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = defeated ? '#8eddfa' : poisoned ? '#a6ed79' : enraged ? '#ff9daf' : '#c7c2d2';
    ctx.font = '10px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(defeated ? 'BARELY STANDING' : shrugging ? 'SANS · THE SKELETON' : poisoned ? 'POISONED · LOSING PATIENCE' : attacking ? 'GASTER BLASTER!' : state.frenzy ? 'FINAL FRENZY' : enraged ? 'YOU ACTUALLY HIT ME?' : 'SANS · THE SKELETON', x, y + 118);
  }

  function drawBossQuip() {
    if (state.mode !== 'fight' || state.bossQuipLeft <= 0 || !state.bossQuip) return;
    ctx.save();
    ctx.font = '10px "DM Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const width = Math.min(220, ctx.measureText(state.bossQuip).width + 18);
    const side = state.bossX < W / 2 ? 1 : -1;
    const centerX = clamp(state.bossX + side * 118, width / 2 + 9, W - width / 2 - 9);
    const centerY = state.bossY + 153;
    ctx.globalAlpha = Math.min(1, state.bossQuipLeft / .18);
    ctx.fillStyle = 'rgba(227,241,210,.96)'; ctx.strokeStyle = 'rgba(158,204,116,.9)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(centerX - width / 2, centerY - 14, width, 28, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(centerX - side * 28, centerY - 14); ctx.lineTo(state.bossX + side * 60, centerY - 24); ctx.lineTo(centerX - side * 8, centerY - 14); ctx.fill();
    ctx.fillStyle = '#26321e'; ctx.fillText(state.bossQuip.slice(0, Math.floor(state.bossQuipProgress)), centerX, centerY + 1);
    ctx.restore();
  }

  function drawShip(time) {
    const p = state.player;
    const departing = state.mode === 'cutscene' && state.cutsceneStep === 'depart';
    if (!departing && state.mode !== 'cutscene' && p.invuln > 0 && Math.floor(time / 75) % 2 === 0) return;
    const bob = departing ? 0 : Math.sin(time * .0035) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(departing ? -.36 : Math.sin(time * .002) * .035);
    if (shipSprite.complete && shipSprite.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      ctx.shadowColor = '#84f2e9'; ctx.shadowBlur = 15;
      ctx.drawImage(shipSprite, -35, -58, 70, 116);
    } else {
      ctx.fillStyle = '#ff765f'; ctx.beginPath(); ctx.ellipse(0, -3, 25, 35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#83f1e7'; ctx.beginPath(); ctx.ellipse(0, -13, 11, 14, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawShot(s) {
    ctx.save(); ctx.translate(Math.round(s.x), Math.round(s.y));
    if (s.special) {
      const image = pikminSprites.get(s.kind.id);
      ctx.shadowColor = s.color; ctx.shadowBlur = 16;
      if (image?.complete && image.naturalWidth) ctx.drawImage(image, -24, -26, 48, 52);
      else { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); }
      if (flowerSprite.complete && flowerSprite.naturalWidth) {
        const flowerFilters = { red: 'hue-rotate(0deg)', electric: 'hue-rotate(70deg)', blue: 'hue-rotate(200deg)', white: 'grayscale(1) brightness(1.5)', purple: 'hue-rotate(255deg)' };
        ctx.filter = flowerFilters[s.kind.id] || 'none';
        ctx.drawImage(flowerSprite, -8, -32, 16, 12);
        ctx.filter = 'none';
      }
      ctx.globalAlpha = .45; ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 21 + Math.sin(performance.now() * .009) * 3, 0, Math.PI * 2); ctx.stroke();
    } else {
      const trail = ctx.createLinearGradient(0, 10, 0, -10);
      trail.addColorStop(0, 'rgba(99,229,224,0)'); trail.addColorStop(1, '#cffffc');
      ctx.shadowColor = '#63e5e0'; ctx.shadowBlur = 12; ctx.fillStyle = trail;
      ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5ffff'; ctx.beginPath(); ctx.ellipse(0, -2, 1.6, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBolt(b) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle || 0);
    ctx.shadowColor = b.color; ctx.shadowBlur = 9;
    ctx.lineCap = 'round'; ctx.strokeStyle = '#46434f'; ctx.lineWidth = b.w + 5;
    ctx.beginPath(); ctx.moveTo(0, -b.h * .46); ctx.lineTo(0, b.h * .46); ctx.stroke();
    ctx.strokeStyle = b.color; ctx.lineWidth = b.w;
    ctx.beginPath(); ctx.moveTo(0, -b.h * .43); ctx.lineTo(0, b.h * .43); ctx.stroke();
    ctx.fillStyle = '#fff9f2';
    for (const y of [-b.h * .42, b.h * .42]) {
      ctx.beginPath(); ctx.arc(-b.w * .34, y, b.w * .42, 0, Math.PI * 2); ctx.arc(b.w * .34, y, b.w * .42, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-1, -b.h * .27); ctx.lineTo(-1, b.h * .25); ctx.stroke();
    ctx.restore();
  }

  function drawAttackTelegraphs(time) {
    if (state.telegraph) {
      const charge = 1 - clamp(state.telegraph.timer / (state.telegraph.type === 'beam' ? .86 : .72), 0, 1);
      const x = state.telegraph.x;
      if (state.telegraph.type === 'beam') {
        ctx.save(); ctx.globalAlpha = .25 + charge * .62; ctx.strokeStyle = '#ff567a'; ctx.lineWidth = 3 + charge * 7;
        ctx.setLineDash([11, 8]); ctx.beginPath(); ctx.moveTo(x, state.bossY + 64); ctx.lineTo(x, H); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#ff6e91'; ctx.globalAlpha = .25 + charge * .5; ctx.beginPath(); ctx.arc(x, state.bossY + 66, 12 + charge * 20, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else {
        ctx.save(); ctx.globalAlpha = .28 + charge * .65; ctx.strokeStyle = '#70d7ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, state.telegraph.y, 22 + Math.sin(time * .02) * 5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 17, state.telegraph.y); ctx.lineTo(x + 17, state.telegraph.y); ctx.moveTo(x, state.telegraph.y - 17); ctx.lineTo(x, state.telegraph.y + 17); ctx.stroke(); ctx.restore();
      }
    }
    if (state.beam) {
      const x = state.beam.x;
      const shimmer = Math.sin(time * .045) * 5;
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.shadowColor = '#ff5b8a'; ctx.shadowBlur = 27;
      const beam = ctx.createLinearGradient(x - 29, 0, x + 29, 0);
      beam.addColorStop(0, 'rgba(255,72,124,.02)'); beam.addColorStop(.32, 'rgba(255,95,145,.62)'); beam.addColorStop(.5, 'rgba(255,255,245,.98)'); beam.addColorStop(.7, 'rgba(255,95,145,.62)'); beam.addColorStop(1, 'rgba(255,72,124,.02)');
      ctx.fillStyle = beam; ctx.fillRect(x - 31 + shimmer, state.bossY + 60, 62, H);
      ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(x - 2 + shimmer, state.bossY + 60, 4, H);
      ctx.restore();
    }
  }

  function drawStandoff(time) {
    const centerX = (state.bossX + state.player.x) / 2;
    const centerY = (state.bossY + state.player.y) / 2;
    const alpha = .26 + .22 * Math.sin(time * .004);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#a9d778'; ctx.setLineDash([3, 9]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(state.bossX, state.bossY + 120); ctx.lineTo(state.player.x, state.player.y - 55); ctx.stroke();
    ctx.setLineDash([]); ctx.beginPath(); ctx.arc(centerX, centerY, 17 + Math.sin(time * .004) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d6e8c1'; ctx.font = '10px "DM Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('STANDOFF · MOVE OR TAKE THE FIRST SHOT', W / 2, centerY - 28);
  }

  function drawCutscene(time) {
    if (state.mode === 'intro') {
      ctx.save();
      ctx.textAlign = 'center'; ctx.font = '700 10px "DM Mono", monospace';
      ctx.shadowColor = '#91db72'; ctx.shadowBlur = 14; ctx.fillStyle = '#d9efc6';
      if (state.introStep === 'arrival') {
        ctx.fillText('SPROUT SHIP · ARRIVAL VECTOR LOCKED', W / 2, H * .61);
        ctx.globalAlpha = .42;
        ctx.strokeStyle = '#8bd9d7'; ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) {
          const x = state.player.x - 44 + i * 15;
          const y = state.player.y + 24 + (i % 3) * 11;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 31 + (i % 2) * 20); ctx.stroke();
        }
      } else if (state.introStep === 'boss-entrance') {
        ctx.fillText('A SKELETON SIGNAL IS ENTERING THE FIELD', W / 2, 254);
      } else if (state.introStep === 'shrug') {
        ctx.fillText('SANS // THE SKELETON', W / 2, 250);
        ctx.shadowBlur = 0; ctx.font = '11px "Space Grotesk", Arial, sans-serif';
        const bx = state.bossX + 108; const by = state.bossY - 4;
        ctx.fillStyle = 'rgba(11,15,12,.88)'; ctx.strokeStyle = 'rgba(173,204,141,.65)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx - 25, by - 13, 50, 26, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e4ebdc'; ctx.fillText(state.bossQuip.slice(0, Math.floor(state.bossQuipProgress)), bx, by + 4);
      } else if (state.introStep === 'health') {
        ctx.fillText('TARGET LOCKED · BOSS HEALTH SYNCING', W / 2, 252);
      }
      ctx.restore();
      return;
    }
    if (state.mode !== 'cutscene') return;
    ctx.save();
    if (state.cutsceneStep === 'depart') {
      const glow = ctx.createLinearGradient(0, H * .28, 0, H * .72);
      glow.addColorStop(0, 'rgba(26,105,159,0)');
      glow.addColorStop(.5, 'rgba(37,133,190,.12)');
      glow.addColorStop(1, 'rgba(26,105,159,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = '800 34px "DM Mono", monospace';
      ctx.shadowColor = '#65dfff'; ctx.shadowBlur = 24;
      ctx.fillStyle = '#dafaff'; ctx.fillText('YOU WIN!', W / 2, H * .48);
      ctx.font = '10px "DM Mono", monospace'; ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(203,230,255,.72)'; ctx.fillText('SIGNAL RESTORED · CREW EXTRACTED', W / 2, H * .48 + 27);
      const bubbleX = clamp(state.player.x + 55, 86, W - 72);
      const bubbleY = clamp(state.player.y - 57, 39, H - 34);
      ctx.fillStyle = 'rgba(8,15,27,.9)'; ctx.strokeStyle = 'rgba(131,226,255,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(bubbleX - 36, bubbleY - 13, 72, 26, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#dafaff'; ctx.font = '700 10px "DM Mono", monospace'; ctx.fillText('YOU WIN!', bubbleX, bubbleY + 4);
    } else if (state.cutsceneStep === 'final-shot') {
      const p = state.player;
      const progress = clamp(state.cutsceneTime / .82, 0, 1);
      const startX = p.x;
      const startY = p.y - 46;
      const targetX = state.bossX;
      const targetY = state.bossY + 26;
      const endX = startX + (targetX - startX) * progress;
      const endY = startY + (targetY - startY) * progress;
      const width = 5 + progress * 20;
      ctx.globalCompositeOperation = 'screen';
      ctx.lineCap = 'round';
      ctx.shadowColor = '#5edfff'; ctx.shadowBlur = 29;
      const beam = ctx.createLinearGradient(startX, startY, endX, endY);
      beam.addColorStop(0, '#f5ffff'); beam.addColorStop(.28, '#72e8ff'); beam.addColorStop(1, 'rgba(137,126,255,.96)');
      ctx.strokeStyle = beam; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(2, width * .19);
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
      ctx.fillStyle = '#ddfbff'; ctx.beginPath(); ctx.arc(endX, endY, 7 + progress * 13, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.textAlign = 'center'; ctx.font = '800 17px "DM Mono", monospace';
      ctx.shadowColor = '#61dcff'; ctx.shadowBlur = 20; ctx.fillStyle = '#efffff';
      ctx.fillText('FINAL BLOW!', W / 2, H * .43);
    } else {
      const fullyCharged = state.cutsceneStep === 'await-final';
      const charge = fullyCharged ? 1 : clamp(state.cutsceneTime / 1.85, 0, 1);
      const p = state.player;
      const pulse = Math.sin(time * .012) * 4;
      ctx.globalCompositeOperation = 'screen';
      const aura = ctx.createRadialGradient(p.x, p.y - 37, 1, p.x, p.y - 37, 35 + charge * 32 + pulse);
      aura.addColorStop(0, 'rgba(240,255,255,.92)'); aura.addColorStop(.18, 'rgba(81,220,255,.52)'); aura.addColorStop(1, 'rgba(78,119,255,0)');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(p.x, p.y - 37, 70 + charge * 12 + pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(111,226,255,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 37, 20 + charge * 15 + pulse, 8 + charge * 5, time * .002, 0, Math.PI * 2); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';

      ctx.fillStyle = 'rgba(6,9,20,.82)'; ctx.strokeStyle = 'rgba(112,214,255,.38)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(W / 2 - 190, H - 98, 380, 76, 10); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center'; ctx.font = '700 10px "DM Mono", monospace'; ctx.fillStyle = 'rgba(204,226,245,.72)';
      ctx.fillText('FINAL STRIKE · LAST POWER CELL', W / 2, H - 73);
      ctx.fillStyle = 'rgba(129,162,188,.28)'; ctx.fillRect(W / 2 - 130, H - 59, 260, 4);
      ctx.fillStyle = '#75e7ff'; ctx.shadowColor = '#54d9ff'; ctx.shadowBlur = 12;
      ctx.fillRect(W / 2 - 130, H - 59, 260 * charge, 4);
      ctx.shadowBlur = 0;
      ctx.font = '800 13px "DM Mono", monospace';
      ctx.fillStyle = fullyCharged ? (Math.sin(time * .008) > 0 ? '#faffff' : '#7ceaff') : '#d7eaf4';
      ctx.fillText(fullyCharged ? 'PRESS SPACE FOR THE FINAL BLOW' : 'CHARGING THE LAST SHOT…', W / 2, H - 36);
    }
    ctx.restore();
  }

  function draw(time) {
    drawBackground(time);
    if (state.mode === 'title') {
      // Floating silhouettes tease the encounter behind the title card.
      drawBoss(time); drawShip(time);
      return;
    }
    drawBoss(time);
    drawBossQuip();
    if (state.mode === 'standoff') drawStandoff(time);
    drawAttackTelegraphs(time);
    for (const shot of state.shots) drawShot(shot);
    for (const bolt of state.bolts) drawBolt(bolt);
    if (!(state.mode === 'death' || (state.mode === 'lost' && state.player.lives === 0))) drawShip(time);
    for (const part of state.particles) {
      ctx.globalAlpha = clamp(part.life / part.max, 0, 1);
      ctx.fillStyle = part.color; ctx.fillRect(Math.round(part.x), Math.round(part.y), part.size, part.size);
    }
    ctx.globalAlpha = 1;
    drawHitFx();
    if (state.burst > 0 && state.mode === 'fight') {
      ctx.fillStyle = `rgba(${state.frenzy ? '255, 55, 104' : '255, 99, 142'}, ${Math.min(.1, state.burst * .06)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = state.frenzy ? '#ffd6df' : '#fff0d9'; ctx.font = '700 14px "DM Mono", monospace'; ctx.textAlign = 'center';
      ctx.shadowColor = state.frenzy ? '#ff5a87' : '#79eee8'; ctx.shadowBlur = 18;
      ctx.fillText(state.callout || `ATTACK ${String(state.wave).padStart(2, '0')} UNLOCKED`, W / 2, 45);
      ctx.shadowBlur = 0;
    }
    drawCutscene(time);
  }

  function frame(timestamp) {
    const dt = state.last ? Math.min(.04, (timestamp - state.last) / 1000) : 0;
    state.last = timestamp;
    ctx.save();
    if (state.shake > 0) ctx.translate(rand(-2, 2) * (state.shake * 5), rand(-2, 2) * (state.shake * 5));
    update(dt, timestamp);
    draw(timestamp);
    ctx.restore();
    requestAnimationFrame(frame);
  }

  function startAudio() {
    if (!state.audioOn) return;
    if (!state.audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      state.audio = new AudioContext();
    }
    state.audio.resume();
  }

  function stopAudio() {
    if (state.audio) state.audio.suspend();
  }

  function playEffect(name, volume = .32) {
    if (!state.audioOn) return;
    const source = effectAudio[name];
    if (!source) return;
    const audio = source.cloneNode();
    audio.volume = volume;
    audio.play().catch(() => {});
  }

  function soundShot(freq, duration, waveform = 'sine', volume = .018) {
    if (!state.audioOn || !state.audio) return;
    const osc = state.audio.createOscillator(); const gain = state.audio.createGain(); const now = state.audio.currentTime;
    osc.type = waveform; osc.frequency.setValueAtTime(freq, now); osc.frequency.exponentialRampToValueAtTime(Math.max(65, freq * .6), now + duration);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain); gain.connect(state.audio.destination); osc.start(now); osc.stop(now + duration + .01);
  }

  function updateMusicButton() {
    const playing = !ui.music.paused;
    ui.musicToggle.setAttribute('aria-pressed', String(playing));
    ui.musicToggle.setAttribute('aria-label', playing ? 'Pause Megalovania' : 'Play Megalovania');
    ui.musicToggle.innerHTML = playing ? '♫ <span>PAUSE MUSIC</span>' : '♫ <span>PLAY MUSIC</span>';
  }

  ui.start.addEventListener('click', reset);
  ui.restart.addEventListener('click', reset);
  ui.music.volume = Number(ui.musicVolume.value);
  ui.musicVolume.addEventListener('input', () => { ui.music.volume = Number(ui.musicVolume.value); });
  ui.musicToggle.addEventListener('click', () => {
    if (ui.music.paused) {
      ui.music.play().then(updateMusicButton).catch(updateMusicButton);
    } else {
      ui.music.pause(); updateMusicButton();
    }
  });
  ui.music.addEventListener('play', updateMusicButton);
  ui.music.addEventListener('pause', updateMusicButton);
  ui.sound.addEventListener('click', () => {
    state.audioOn = !state.audioOn;
    ui.sound.setAttribute('aria-pressed', String(state.audioOn));
    ui.sound.setAttribute('aria-label', state.audioOn ? 'Turn sound effects off' : 'Turn sound effects on');
    ui.sound.innerHTML = state.audioOn ? '♫ <span>SFX ON</span>' : '♫ <span>SFX OFF</span>';
    if (state.audioOn) startAudio(); else stopAudio();
  });
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    keys.add(event.key);
    const fireKey = event.code === 'Space' || event.key === ' ' || event.key === 'Space';
    if (fireKey && state.mode === 'cutscene' && state.cutsceneStep === 'await-final' && !event.repeat) fireFinalBlow();
    if (fireKey && !event.repeat && state.player.fire <= 0 && (state.mode === 'standoff' || state.mode === 'fight')) firePlayerShot();
    if (event.key === 'Enter' && state.mode === 'title') reset();
    if (event.key.toLowerCase() === 'r' && (state.mode === 'won' || state.mode === 'lost')) reset();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key));
  window.addEventListener('blur', () => keys.clear());
  window.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));

  updateHUD();
  requestAnimationFrame(frame);
})();
