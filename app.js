/*
  The Blue Snail Challenge - safe, absurd parody game
  Single-file JS engine with modular challenge definitions.
*/

// ---------- Audio: fake ominous elevator loop via WebAudio ----------
class ElevatorAudio {
  constructor() {
    this.ctx = null;
    this.nodes = [];
    this.isMuted = false;
  }
  start() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.05;
    master.connect(ctx.destination);
    const baseFreqs = [110, 220, 277, 330];
    baseFreqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i % 2 ? "sine" : "triangle";
      osc.frequency.value = f;
      g.gain.value = 0.05;
      osc.connect(g).connect(master);
      osc.start();
      // slow LFO on gain for wobble
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = "sine";
      lfo.frequency.value = 0.05 + i * 0.03;
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain).connect(g.gain);
      lfo.start();
      this.nodes.push(osc, g, lfo, lfoGain, master);
    });
  }
  toggleMute() {
    if (!this.ctx) this.start();
    this.isMuted = !this.isMuted;
    this.nodes.forEach(n => {
      if (n instanceof GainNode) n.gain.value = this.isMuted ? 0 : (n.gain.value || 0.05);
    });
    return this.isMuted;
  }
}

// ---------- Utilities ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const sleep = ms => new Promise(res => setTimeout(res, ms));
const fmtTime = s => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
};

// ---------- Game State ----------
const state = {
  currentLevel: 1,
  totalLevels: 50,
  timerStartMs: 0,
  timerInterval: null,
  patience: 0,
  patienceInterval: null,
  rageClicks: 0,
  completedLevels: new Set(),
};

// ---------- Views and Navigation ----------
function showView(id) {
  $$('.view').forEach(v => v.classList.remove('visible'));
  $(`#${id}`).classList.add('visible');
}

function showPopup(text) {
  const el = document.createElement('div');
  el.className = 'popup';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ---------- Timer & Patience ----------
function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerStartMs = Date.now();
  state.timerInterval = setInterval(() => {
    const elapsed = (Date.now() - state.timerStartMs) / 1000;
    $('#timer-value').textContent = fmtTime(elapsed);
  }, 500);
}

function resetPatience() {
  state.patience = 0;
  state.rageClicks = 0;
  updatePatience(0);
}

function updatePatience(delta) {
  state.patience = clamp(state.patience + delta, 0, 100);
  $('#patience-fill').style.width = `${state.patience}%`;
}

function bindRage() {
  const handler = () => {
    state.rageClicks += 1;
    updatePatience(2);
    if (state.rageClicks % 7 === 0) {
      showPopup(["You're not worthy yet.", "Snail is watching.", "Try again, human."][Math.floor(Math.random()*3)]);
    }
  };
  $('#challenge-container').addEventListener('click', handler, { passive: true });
  return () => $('#challenge-container').removeEventListener('click', handler);
}

// ---------- Fake Verification ----------
async function fakeVerifyFlow(successText = "Snails approve.") {
  const container = $('#challenge-container');
  const box = document.createElement('div');
  box.innerHTML = `
    <div class="grid">
      <div>Checking your snail aura…</div>
      <div class="progress"><div></div></div>
      <div id="verify-msg" class="muted"></div>
    </div>
  `;
  container.appendChild(box);
  const bar = box.querySelector('.progress > div');
  const msg = box.querySelector('#verify-msg');
  const steps = [3, 13, 37, 69, 88, 97, 420, 100];
  for (const s of steps) {
    await sleep(400 + Math.random()*600);
    bar.style.width = `${Math.min(s, 100)}%`;
    msg.textContent = [
      'Measuring patience cache…',
      'Consulting cabbage oracle…',
      'Analyzing funky vibes…',
      'Estimating snail energy…'
    ][Math.floor(Math.random()*4)];
  }
  await sleep(400);
  msg.textContent = successText;
}

// ---------- Challenges ----------
const Challenges = {
  1: {
    title: 'Stare at the spinner without blinking',
    desc: 'Do nothing. Become one with the wheel.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="challenge-title">Level 1</h3>
          <p class="challenge-desc">Stare at this spinner for 10 minutes. Or 10 seconds. We\'re not strict.</p>
          <div style="display:inline-block;width:64px;height:64px;border:6px solid #21345c;border-top-color:var(--accent);border-radius:50%;animation:spin 1.2s linear infinite"></div>
          <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        </div>
      `;
      setTimeout(onComplete, 8000); // mercy
    }
  },
  5: {
    title: 'Rename your desktop like a true snail lord',
    desc: 'Self-report your devotion. We trust the snail spirit.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="grid">
          <h3 class="challenge-title">Level 5</h3>
          <p class="challenge-desc">Rename your desktop files to snail_lord_01… then upload proof. We won\'t actually check.</p>
          <input type="file" class="input" multiple />
          <button class="secondary" id="upload-btn">Upload proof</button>
          <div id="upload-status"></div>
        </div>
      `;
      $('#upload-btn').addEventListener('click', async () => {
        $('#upload-status').textContent = 'Nice. We didn\'t check, but we trust the snail spirit in you.';
        await fakeVerifyFlow();
        onComplete();
      });
    }
  },
  10: {
    title: 'Find the hidden snail emoji',
    desc: 'Among the chaos, only the snail is calm.',
    render(container, onComplete) {
      const emojis = '😀😅😂🤣😊😍🤩😴😎🤖👻🍕🌮🥑⚽️🏀🚗🚀🦄🐶🐱🐸🐙🦕🌈🔥💧🍀🌻⭐️🌙🎲🎧🎮📀📎📌🔑🧲🧪🧠🧱🧨🥇🥈🥉🍭🍩🍪🍰🧁🧋🥤🍺🍷🍸🍹🍾🥂🍽️🍴🥢🧂🧃🧊🧇🧈🥞🥓🥚🧇🧁🪙🪵🪩🪞🪟🗿🗿🗿🗿'.split('');
      const grid = document.createElement('div');
      grid.className = 'grid emoji';
      const snailIndex = Math.floor(Math.random()*200) + 50;
      for (let i=0;i<300;i++) {
        const s = document.createElement('span');
        s.textContent = i === snailIndex ? '🐌' : emojis[Math.floor(Math.random()*emojis.length)];
        s.addEventListener('click', () => {
          if (s.textContent === '🐌') {
            s.style.filter = 'drop-shadow(0 0 8px #59ffa5)';
            fakeVerifyFlow('Snail found. Snails approve.').then(onComplete);
          } else {
            showPopup('That has insufficient snail vibes.');
            updatePatience(1);
          }
        });
        grid.appendChild(s);
      }
      container.innerHTML = `<h3 class="challenge-title">Level 10</h3><p class="challenge-desc">Find the hidden snail among impostors.</p>`;
      container.appendChild(grid);
    }
  },
  15: {
    title: 'Watch paint dry',
    desc: 'Click “I feel enlightened.” when you truly do.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="grid center">
          <h3 class="challenge-title">Level 15</h3>
          <p class="challenge-desc">Stare at this calming gradient.</p>
          <div style="height:180px;border-radius:12px;background:linear-gradient(90deg,#333,#666,#444);animation:shade 8s linear infinite"></div>
          <style>@keyframes shade{0%{filter:saturate(60%)}50%{filter:saturate(120%)}100%{filter:saturate(60%)}}</style>
          <button class="primary" id="enlightened">I feel enlightened</button>
        </div>
      `;
      $('#enlightened').addEventListener('click', async () => {
        await fakeVerifyFlow('Beige-certified. Proceed.');
        onComplete();
      });
    }
  },
  20: {
    title: 'Essay: Why snails are faster than Wi‑Fi',
    desc: '300 words. Or thereabouts. The snail will know.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="grid">
          <h3 class="challenge-title">Level 20</h3>
          <p class="challenge-desc">Write your truth. We will skim 0 words.</p>
          <textarea id="essay" placeholder="Channel your inner snail…"></textarea>
          <button class="primary" id="submit-essay">Submit to Snail Council</button>
        </div>
      `;
      $('#submit-essay').addEventListener('click', async () => {
        await fakeVerifyFlow('Profound. Snail speed transcends routers.');
        onComplete();
      });
    }
  },
  25: {
    title: 'Set snail speed to exactly 42',
    desc: 'Precision is an illusion. The snail forgives… sometimes.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="grid">
          <h3 class="challenge-title">Level 25</h3>
          <div class="slider-row">
            <input id="snail-slider" type="range" min="0" max="100" value="41" />
            <div>Value: <span id="slider-val">41</span></div>
          </div>
        </div>
      `;
      const slider = $('#snail-slider');
      const out = $('#slider-val');
      slider.addEventListener('input', () => {
        out.textContent = slider.value;
        if (slider.value === '42') {
          fakeVerifyFlow('Close enough, we\'ll let it slide.').then(onComplete);
        }
      });
    }
  },
  30: {
    title: 'Cabbage Captcha',
    desc: 'Select all images with cabbage energy.',
    render(container, onComplete) {
      const options = Array.from({ length: 9 }, (_, i) => ({ id: i, cabbage: Math.random() < 0.3 }));
      container.innerHTML = `
        <div class="grid">
          <h3 class="challenge-title">Level 30</h3>
          <p class="challenge-desc">Which cabbage looks more trustworthy?</p>
          <div class="grid" style="grid-template-columns:repeat(3,1fr)">
            ${options.map(o => `<div data-id="${o.id}" class="cbox" style="height:70px;border-radius:12px;background:${o.cabbage? '#2f5' : '#3a5'};border:2px solid #264" tabindex="0"></div>`).join('')}
          </div>
          <button class="secondary" id="captcha-verify">I\'m definitely a snail</button>
          <div id="captcha-msg" class="muted"></div>
        </div>
      `;
      const picks = new Set();
      $$('#challenge-container .cbox').forEach(el => {
        el.addEventListener('click', () => {
          el.style.outline = '3px solid #59ffa5';
          picks.add(Number(el.dataset.id));
        });
      });
      $('#captcha-verify').addEventListener('click', async () => {
        $('#captcha-msg').textContent = 'Correct. You are now cabbage-certified.';
        await fakeVerifyFlow();
        onComplete();
      });
    }
  },
  40: {
    title: 'Password Strength From Hell',
    desc: 'Enter a password. We will reject it for reasons.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="grid pwd-box">
          <h3 class="challenge-title">Level 40</h3>
          <input id="pwd" class="input" type="password" placeholder="Enter a strong password" />
          <button class="secondary" id="pwd-btn">Submit</button>
          <div id="pwd-status" class="muted"></div>
        </div>
      `;
      const reasons = [
        'Too weak: lacks snail emojis.',
        'Rejected: contains insufficient cabbage entropy.',
        'Denied: password remembered by a goldfish.',
        'Nope: requires at least 3 silent letters and a haiku.',
        'Try again: does not start with "I respect snails".'
      ];
      let attempts = 0;
      $('#pwd-btn').addEventListener('click', () => {
        attempts++;
        if (attempts < 5) {
          $('#pwd-status').textContent = reasons[(attempts-1) % reasons.length];
          updatePatience(3);
        } else {
          fakeVerifyFlow('Fine. Password spiritually strong.').then(onComplete);
        }
      });
    }
  },
  49: {
    title: 'Stare at Shrek until he blinks',
    desc: 'We will use very real AI to detect blinking.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="grid shrek-box">
          <h3 class="challenge-title">Level 49</h3>
          <div class="shrek" aria-label="Shrek"></div>
          <button class="primary" id="blink-btn">I witnessed the blink</button>
          <div id="blink-status" class="muted"></div>
        </div>
      `;
      $('#blink-btn').addEventListener('click', async () => {
        $('#blink-status').textContent = 'Analyzing your eyes… detected 37% snail energy.';
        await fakeVerifyFlow('Blink verified by cutting-edge imagination.');
        onComplete();
      });
    }
  },
  50: {
    title: 'You are the Snail Overlord',
    desc: 'Confetti. Everyone is last place.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="challenge-title">Level 50</h3>
          <p class="challenge-desc">Scanning desktop… scanning fridge… scanning brainwaves… LOL we didn\'t check.</p>
          <h2>Congratulations. You\'re now the Snail Overlord.</h2>
          <canvas id="confetti" width="800" height="240" style="width:100%;height:240px"></canvas>
        </div>
      `;
      fireConfetti();
      onComplete();
    }
  }
};

// ---------- Confetti ----------
function fireConfetti() {
  const canvas = $('#confetti');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const pieces = Array.from({ length: 160 }, () => ({
    x: Math.random()*canvas.width,
    y: Math.random()*-canvas.height,
    r: 4 + Math.random()*6,
    c: `hsl(${Math.random()*360},80%,60%)`,
    v: 1 + Math.random()*3
  }));
  let raf;
  const tick = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for (const p of pieces) {
      p.y += p.v;
      if (p.y > canvas.height) p.y = -10;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  };
  tick();
  setTimeout(() => cancelAnimationFrame(raf), 8000);
}

// ---------- Engine ----------
function loadLevel(index) {
  state.currentLevel = index;
  $('#level-index').textContent = String(index);
  $('#next-btn').disabled = true;
  $('#verify-btn').disabled = false;
  const container = $('#challenge-container');
  container.innerHTML = '';
  resetPatience();
  startTimer();
  if (index in Challenges) {
    let completed = false;
    const complete = () => {
      if (completed) return;
      completed = true;
      state.completedLevels.add(index);
      $('#next-btn').disabled = false;
    };
    const cleanupRage = bindRage();
    Challenges[index].render(container, () => {
      cleanupRage();
      complete();
    });
  } else {
    // Placeholder troll levels auto-complete via fake verify
    container.innerHTML = `
      <h3 class="challenge-title">Level ${index}</h3>
      <p class="challenge-desc">A mysterious trial. Probably rigged.</p>
    `;
  }
}

function nextLevel() {
  const next = clamp(state.currentLevel + 1, 1, state.totalLevels);
  loadLevel(next);
}

// ---------- Leaderboard ----------
function renderLeaderboard() {
  const list = $('#leaderboard-list');
  list.innerHTML = '';
  const names = ['You','Ava','Liam','Noah','Mia','Olivia','Ethan','Zoe','Kai','Nova'];
  names.forEach(n => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${n}</span><span>Level 2</span>`;
    list.appendChild(li);
  });
}

// ---------- Wiring ----------
const audio = new ElevatorAudio();

function initUI() {
  $('#start-btn').addEventListener('click', () => {
    audio.start();
    showView('game');
    loadLevel(1);
  });
  $('#verify-btn').addEventListener('click', async () => {
    await fakeVerifyFlow();
    $('#next-btn').disabled = false;
  });
  $('#next-btn').addEventListener('click', nextLevel);
  $('#rage-quit').addEventListener('click', () => {
    showPopup('Snail wins again. 🐌');
    showView('landing');
  });
  $('#open-leaderboard').addEventListener('click', () => {
    renderLeaderboard();
    showView('leaderboard');
  });
  $('#back-to-game').addEventListener('click', () => showView('game'));
  $('#toggle-audio').addEventListener('click', (e) => {
    const muted = audio.toggleMute();
    e.target.textContent = muted ? 'Unmute Elevator Music' : 'Mute Elevator Music';
  });

  // Trolling: gently move CTA away on hover
  const cta = $('#start-btn');
  let dodge = 0;
  cta.addEventListener('mousemove', () => {
    dodge = (dodge + 1) % 4;
    const dx = (Math.random()*14 - 7) * (dodge % 2 === 0 ? 1 : -1);
    const dy = (Math.random()*10 - 5);
    cta.style.transform = `translate(${dx}px, ${dy}px)`;
  });
}

window.addEventListener('DOMContentLoaded', initUI);


