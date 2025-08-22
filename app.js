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
    title: 'Click the Moving Button',
    desc: 'Click the button 10 times to complete the level.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="challenge-title">Level 1</h3>
          <p class="challenge-desc">Click the button 10 times to complete the level. But be careful - it moves when you hover too long!</p>
          <div class="game-area" style="position: relative; width: 100%; height: 300px; border: 2px dashed #2a3550; border-radius: 12px; margin: 20px 0;">
            <button id="moving-btn" class="primary" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">Click Me!</button>
          </div>
          <div class="progress-info">
            <div>Clicks: <span id="click-count">0</span>/10</div>
            <div class="progress">
              <div id="click-progress" style="width: 0%"></div>
            </div>
          </div>
        </div>
      `;
      
      const button = $('#moving-btn');
      const gameArea = container.querySelector('.game-area');
      const clickCount = $('#click-count');
      const progressBar = $('#click-progress');
      
      let clicks = 0;
      let hoverTimer = null;
      let isHovering = false;
      
      // Update progress bar
      function updateProgress() {
        clickCount.textContent = clicks;
        progressBar.style.width = `${(clicks / 10) * 100}%`;
      }
      
      // Move button to random position
      function moveButton() {
        const areaRect = gameArea.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        
        const maxX = areaRect.width - buttonRect.width - 20;
        const maxY = areaRect.height - buttonRect.height - 20;
        
        const newX = Math.random() * maxX + 10;
        const newY = Math.random() * maxY + 10;
        
        button.style.left = `${newX}px`;
        button.style.top = `${newY}px`;
        button.style.transform = 'none';
        
        // Add some visual feedback
        button.style.animation = 'bounce 0.3s ease';
        setTimeout(() => button.style.animation = '', 300);
      }
      
      // Handle button clicks
      button.addEventListener('click', () => {
        clicks++;
        updateProgress();
        
        if (clicks >= 10) {
          button.style.pointerEvents = 'none';
          button.textContent = 'Complete!';
          button.style.background = 'var(--ok)';
          button.style.color = '#05101e';
          setTimeout(() => onComplete(), 1000);
        } else {
          // Move button after each click
          moveButton();
        }
      });
      
      // Handle hover timing
      button.addEventListener('mouseenter', () => {
        isHovering = true;
        hoverTimer = setTimeout(() => {
          if (isHovering) moveButton();
        }, 200); // Button moves after 200ms hover
      });
      
      button.addEventListener('mouseleave', () => {
        isHovering = false;
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
      });
      
      // Add bounce animation CSS
      const style = document.createElement('style');
      style.textContent = `
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `;
      document.head.appendChild(style);
      
      updateProgress();
    }
  },
  2: {
    title: 'Type the Twisted Sentence',
    desc: 'Type the target sentence, but each key maps to a different letter.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="challenge-title">Level 2</h3>
          <p class="challenge-desc">Type the target sentence below. But beware - each key you press maps to a different letter!</p>
          
          <div class="target-section" style="margin: 20px 0; padding: 16px; background: #0e1730; border-radius: 12px; border: 1px solid #2a3550;">
            <h4 style="margin: 0 0 8px 0; color: var(--accent);">Target Sentence:</h4>
            <div id="target-text" style="font-size: 18px; line-height: 1.4; color: var(--text);">The quick brown fox jumps over the lazy snail.</div>
          </div>
          
          <div class="input-section" style="margin: 20px 0;">
            <label for="twisted-input" style="display: block; margin-bottom: 8px; color: var(--muted);">Type here:</label>
            <input id="twisted-input" class="input" type="text" placeholder="Start typing..." style="font-size: 16px; width: 100%; max-width: 500px;" />
            <div id="mapped-display" style="margin-top: 12px; padding: 12px; background: #0a0f1a; border-radius: 8px; border: 1px solid #1f2a44; min-height: 20px; color: var(--muted); font-family: monospace;">
              <span style="color: var(--muted);">Mapped output: </span><span id="mapped-text"></span>
            </div>
          </div>
          
          <div class="progress-section" style="margin: 20px 0;">
            <div style="margin-bottom: 8px; color: var(--muted);">Progress: <span id="progress-text">0%</span></div>
            <div class="progress">
              <div id="level2-progress" style="width: 0%"></div>
            </div>
          </div>
          
          <div id="level2-status" style="margin-top: 16px; font-weight: 600;"></div>
        </div>
      `;
      
      const input = $('#twisted-input');
      const mappedText = $('#mapped-text');
      const progressText = $('#progress-text');
      const progressBar = $('#level2-progress');
      const status = $('#level2-status');
      
      let isCorrect = false;

      const charMap = 'abcdefghijklmnopqrstuvwxyz';
      let twistedMap = {};
      
      // Generate a random twisted map
      function generateTwistedMap() {
        const shuffledChars = charMap.split('').sort(() => 0.5 - Math.random());
        for (let i = 0; i < charMap.length; i++) {
          twistedMap[charMap[i]] = shuffledChars[i];
        }
      }

      generateTwistedMap(); // Generate map on render
      
      // Letter mapping (simple substitution cipher)
      const letterMap = {
        'a': 'q', 'b': 'w', 'c': 'e', 'd': 'r', 'e': 't', 'f': 'y', 'g': 'u', 'h': 'i',
        'i': 'o', 'j': 'p', 'k': 'a', 'l': 's', 'm': 'd', 'n': 'f', 'o': 'g', 'p': 'h',
        'q': 'j', 'r': 'k', 's': 'l', 't': 'z', 'u': 'x', 'v': 'c', 'w': 'v', 'x': 'b',
        'y': 'n', 'z': 'm', ' ': ' ', '.': '.', ',': ',', '!': '!', '?': '?'
      };
      
      // Reverse mapping for decoding
      const reverseMap = {};
      Object.keys(letterMap).forEach(key => {
        reverseMap[letterMap[key]] = key;
      });
      
      const targetSentence = "The quick brown fox jumps over the lazy snail.";
      let currentTyped = "";
      let mappedOutput = "";
      
      // Update progress
      function updateProgress() {
        const progress = Math.min((currentTyped.length / targetSentence.length) * 100, 100);
        progressText.textContent = `${Math.round(progress)}%`;
        progressBar.style.width = `${progress}%`;
      }
      
      // Check completion
      function checkCompletion() {
        if (currentTyped === targetSentence) {
          status.textContent = "🎉 Level Cleared! Perfect typing!";
          status.style.color = "var(--ok)";
          input.disabled = true;
          input.style.background = "#0a1a0a";
          input.style.borderColor = "var(--ok)";
          
          // Add some visual flair
          setTimeout(() => {
            showPopup("Twisted typing mastered! Snails approve.");
            onComplete();
          }, 1500);
        }
      }
      
      // Handle input
      input.addEventListener('input', () => {
        const rawText = input.value.toLowerCase();
        let mappedOutput = '';
        let currentProgress = 0;

        for (let i = 0; i < rawText.length; i++) {
          const char = rawText[i];
          if (char in twistedMap) {
            mappedOutput += twistedMap[char];
          } else {
            mappedOutput += char; // Keep non-alphabet characters as is
          }
        }
        
        mappedText.textContent = mappedOutput;
        
        // Check against target text
        const targetLen = targetSentence.length;
        const currentMappedLen = mappedOutput.length;
        
        if (mappedOutput === targetSentence.substring(0, currentMappedLen)) {
          // Correct input, update progress
          currentProgress = (currentMappedLen / targetLen) * 100;
          progressBar.style.width = `${currentProgress}%`;
          progressText.textContent = `${Math.floor(currentProgress)}%`;

          if (mappedOutput === targetSentence) {
            // Level complete
            isCorrect = true;
            status.textContent = "🎉 Level Cleared!";
            status.style.color = "var(--ok)";
            showPopup("Twisted typing mastered! Snails approve.");
            onComplete();
            input.disabled = true; // Disable input after completion
          }
        } else {
          // Incorrect input, reset progress and display error
          status.textContent = "🚫 Incorrect sequence. Try again!";
          status.style.color = "var(--danger)";
          // Optionally reset input or just show error for now
        }
      });
      
      // Focus input on start
      setTimeout(() => input.focus(), 100);
      
      // Add some visual feedback for the twisted nature
      const style = document.createElement('style');
      style.textContent = `
        #twisted-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px #5aa7ff33;
        }
        .target-section {
          animation: glow 2s ease-in-out infinite alternate;
        }
        @keyframes glow {
          from { box-shadow: 0 0 5px #2a3550; }
          to { box-shadow: 0 0 15px #5aa7ff66; }
        }
      `;
      document.head.appendChild(style);
    }
  },
  3: {
    title: 'The Fragile Glass Button',
    desc: 'Click the expensive glass button 20 times. But be gentle - it breaks easily!',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="challenge-title">Level 3</h3>
          <p class="challenge-desc">Click the premium glass button 20 times. But be careful - it\'s fragile and expensive!</p>
          
          <div class="glass-container" style="margin: 40px 0; display: flex; justify-content: center; align-items: center;">
            <button id="glass-btn" class="glass-button" data-clicks="0">
              <div class="glass-content">
                <span class="glass-text">Click Me</span>
                <div class="glass-shine"></div>
              </div>
            </button>
          </div>
          
          <div class="stats-section" style="margin: 20px 0; text-align: center;">
            <div style="margin-bottom: 8px; color: var(--muted);">Clicks: <span id="click-counter">0</span>/20</div>
            <div class="progress">
              <div id="glass-progress" style="width: 0%"></div>
            </div>
            <div id="glass-status" style="margin-top: 12px; font-weight: 600; color: var(--accent);"></div>
          </div>
          
          <div id="glass-message" style="margin-top: 16px; text-align: center; font-style: italic; color: var(--muted);"></div>
        </div>
      `;
      
      const button = $('#glass-btn');
      const clickCounter = $('#click-counter');
      const progressBar = $('#glass-progress');
      const status = $('#glass-status');
      const message = $('#glass-message');
      
      let clicks = 0;
      let clickTimes = [];
      let isBroken = false;
      let crackLevel = 0;
      const crackThresholds = [5, 10, 15]; // Clicks at which cracks appear/intensify
      
      // Glassmorphism CSS
      const glassStyle = document.createElement('style');
      glassStyle.textContent = `
        .glass-button {
          position: relative;
          width: 120px;
          height: 120px;
          border: none;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }
        
        .glass-button:hover {
          transform: translateY(-2px);
          box-shadow: 
            0 12px 40px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.3),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1);
        }
        
        .glass-button:active {
          transform: translateY(0);
        }
        
        .glass-content {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
          font-size: 14px;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }
        
        .glass-shine {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            45deg,
            transparent 30%,
            rgba(255, 255, 255, 0.1) 40%,
            rgba(255, 255, 255, 0.2) 50%,
            rgba(255, 255, 255, 0.1) 60%,
            transparent 70%
          );
          animation: shine 3s ease-in-out infinite;
        }
        
        @keyframes shine {
          0%, 100% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          50% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }
        
        .glass-button.crack-one::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 50% 50%, transparent 20%, rgba(255, 0, 0, 0.2) 22%, transparent 25%),
            linear-gradient(45deg, transparent 48%, rgba(255, 0, 0, 0.2) 50%, transparent 52%);
          pointer-events: none;
          animation: crack-in 0.5s ease-out forwards;
        }

        .glass-button.crack-two::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 50% 50%, transparent 15%, rgba(255, 0, 0, 0.3) 17%, transparent 20%),
            linear-gradient(45deg, transparent 45%, rgba(255, 0, 0, 0.3) 48%, transparent 52%),
            linear-gradient(-45deg, transparent 45%, rgba(255, 0, 0, 0.3) 48%, transparent 52%),
            linear-gradient(90deg, transparent 48%, rgba(255, 0, 0, 0.3) 50%, transparent 52%);
          pointer-events: none;
          animation: crack-in 0.5s ease-out forwards;
        }

        @keyframes crack-in {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        
        .glass-button.shattered {
          animation: shatter 0.5s ease-out forwards;
          pointer-events: none;
          box-shadow: 0 0 40px rgba(255, 0, 0, 0.8), 0 0 20px rgba(255, 100, 100, 0.6);
        }
        
        @keyframes shatter {
          0% { transform: scale(1) rotate(0deg); opacity: 1; }
          25% { transform: scale(1.1) rotate(5deg); box-shadow: 0 0 40px rgba(255, 0, 0, 0.8); }
          50% { transform: scale(0.8) rotate(-10deg); opacity: 0.8; }
          75% { transform: scale(0.6) rotate(15deg); opacity: 0.5; }
          100% { 
            transform: scale(0) rotate(45deg);
            opacity: 0;
            box-shadow: 0 0 0 transparent;
          }
        }
        
        .glass-pieces {
          position: absolute;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        
        .glass-piece {
          position: absolute;
          width: 30px; /* Larger pieces */
          height: 30px;
          background: rgba(255, 255, 255, 0.15); /* Slightly more visible */
          border-radius: 6px; /* Slightly larger border radius */
          animation: piece-fly 1s ease-out forwards;
        }
        
        @keyframes piece-fly {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { 
            transform: translate(var(--fly-x), var(--fly-y)) rotate(var(--fly-rot));
            opacity: 0;
          }
        }

        .shatter-burst {
          position: absolute;
          width: 150px; /* Larger burst */
          height: 150px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(255, 100, 100, 0.5) 70%, transparent 100%);
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0); /* Start small */
          animation: burst-out 0.5s ease-out forwards;
          pointer-events: none;
          z-index: 99;
          top: 50%;
          left: 50%;
        }

        @keyframes burst-out {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
      `;
      document.head.appendChild(glassStyle);
      
      // Update progress
      function updateProgress() {
        clickCounter.textContent = clicks;
        const progress = (clicks / 20) * 100;
        progressBar.style.width = `${progress}%`;
      }
      
      // Check click speed (no longer directly increments crackLevel for guarantee)
      function checkClickSpeed() {
        // Original click speed logic, can be kept for other purposes or removed if not needed.
        const now = Date.now();
        clickTimes.push(now);
        
        if (clickTimes.length > 10) {
          clickTimes.shift();
        }
        
        if (clickTimes.length >= 2) {
          const timeDiff = clickTimes[clickTimes.length - 1] - clickTimes[clickTimes.length - 2];
          const clicksPerSecond = 1000 / timeDiff;
          
          // Original logic for speed-based cracking, now handled by click thresholds
          // if (clicksPerSecond > 2) {
          //   crackLevel++;
          //   handleCracking();
          // }
        }
      }
      
      // Handle cracking effects
      function handleCracking() {
        if (crackLevel === 1) {
          button.classList.add('crack-one');
          button.classList.remove('cracked');
          message.textContent = '"careful bro..."';
          status.textContent = "⚠️ First crack detected!";
          status.style.color = "#ffaa00";
        } else if (crackLevel === 2) {
          button.classList.remove('crack-one');
          button.classList.add('crack-two');
          message.textContent = '"STOP ABUSING ME 😭"';
          status.textContent = "🚨 Multiple cracks! Button is fragile!";
          status.style.color = "#ff6600";
        } else if (crackLevel >= 3) {
          shatterButton();
          onComplete(); // Complete the level when it shatters
          showPopup('Button shattered! Level Cleared.');
        }
      }
      
      // Shatter the button
      function shatterButton() {
        isBroken = true;
        button.classList.add('shattered');
        status.textContent = "💥 Button SHATTERED!";
        status.style.color = "var(--danger)";
        message.textContent = "You've unleashed the full power of the snail!";

        // Create more glass pieces and a burst effect
        const piecesContainer = document.createElement('div');
        piecesContainer.className = 'glass-pieces';
        piecesContainer.style.zIndex = '100'; // Ensure it's on top
        button.parentNode.insertBefore(piecesContainer, button.nextSibling);

        const numPieces = 30; // Increased number of pieces
        for (let i = 0; i < numPieces; i++) {
          const piece = document.createElement('div');
          piece.className = 'glass-piece';
          const angle = Math.random() * 2 * Math.PI;
          const distance = Math.random() * 100 + 50; // Fly further
          piece.style.setProperty('--fly-x', `${Math.cos(angle) * distance}px`);
          piece.style.setProperty('--fly-y', `${Math.sin(angle) * distance}px`);
          piece.style.setProperty('--fly-rot', `${Math.random() * 720 - 360}deg`); // More rotation
          piecesContainer.appendChild(piece);
        }

        // Add a temporary burst effect
        const burst = document.createElement('div');
        burst.className = 'shatter-burst';
        button.parentNode.insertBefore(burst, button.nextSibling);
        setTimeout(() => burst.remove(), 500); // Remove burst after 0.5s

        setTimeout(() => {
          button.remove();
          piecesContainer.remove();
        }, 1000); // Remove button and pieces after animation
      }
      
      // Create glass pieces animation
      function createGlassPieces() {
        const pieces = document.createElement('div');
        pieces.className = 'glass-pieces';
        
        for (let i = 0; i < 12; i++) {
          const piece = document.createElement('div');
          piece.className = 'glass-piece';
          piece.style.setProperty('--fly-x', `${(Math.random() - 0.5) * 200}px`);
          piece.style.setProperty('--fly-y', `${(Math.random() - 0.5) * 200}px`);
          piece.style.setProperty('--fly-rot', `${Math.random() * 360}deg`);
          piece.style.left = `${Math.random() * 100}%`;
          piece.style.top = `${Math.random() * 100}%`;
          pieces.appendChild(piece);
        }
        
        button.appendChild(pieces);
      }
      
      // Reset button
      function resetButton() {
        clicks = 0;
        clickTimes = [];
        crackLevel = 0;
        isBroken = false;
        
        button.className = 'glass-button';
        button.innerHTML = `
          <div class="glass-content">
            <span class="glass-text">Click Me</span>
            <div class="glass-shine"></div>
          </div>
        `;
        
        status.textContent = "";
        message.textContent = "";
        updateProgress();
      }
      
      // Handle button clicks
      button.addEventListener('click', () => {
        if (isBroken) return;

        clicks++;
        updateProgress();

        if (clicks === crackThresholds[0] && crackLevel < 1) {
          crackLevel = 1;
          handleCracking();
        } else if (clicks === crackThresholds[1] && crackLevel < 2) {
          crackLevel = 2;
          handleCracking();
        } else if (clicks === crackThresholds[2] && crackLevel < 3) {
          crackLevel = 3;
          handleCracking();
        } else if (clicks > crackThresholds[2] && crackLevel < 3) {
          // Ensure shatter if clicks exceed last threshold and not yet shattered
          crackLevel = 3;
          handleCracking();
        }

        if (clicks >= 20) {
          // Ensure the level completes after 20 clicks, regardless of shattering
          if (!isBroken) {
            onComplete(); 
            showPopup('Button endured the clicks!');
          }
        }
      });
      
      updateProgress();
    }
  },
  4: {
    title: 'The Cursed Tic Tac Toe',
    desc: 'Play Tic Tac Toe. But there\'s a secret rule...',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="challenge-title">Level 4</h3>
          <div class="cursed-title" style="font-size: 48px; font-weight: 900; color: var(--accent); text-shadow: 0 0 20px #5aa7ff; margin: 20px 0; animation: pulse 2s ease-in-out infinite;">PLAY</div>
          
          <div class="game-board" style="margin: 30px auto; width: 300px; height: 300px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; background: #1f2a44; padding: 8px; border-radius: 12px; border: 2px solid #2a3550;">
            <div class="cell" data-index="0"></div>
            <div class="cell" data-index="1"></div>
            <div class="cell" data-index="2"></div>
            <div class="cell" data-index="3"></div>
            <div class="cell" data-index="4"></div>
            <div class="cell" data-index="5"></div>
            <div class="cell" data-index="6"></div>
            <div class="cell" data-index="7"></div>
            <div class="cell" data-index="8"></div>
          </div>
          
          <div class="game-status" style="margin: 20px 0; text-align: center;">
            <div id="status-text" style="font-size: 18px; font-weight: 600; color: var(--accent);">Your turn (X)</div>
            <div id="secret-message" style="margin-top: 12px; font-style: italic; color: var(--muted); font-size: 14px;"></div>
          </div>
          
          <button id="reset-btn" class="secondary" style="margin-top: 16px;">Reset Game</button>
        </div>
      `;
      
      // Add cursed styling
      const cursedStyle = document.createElement('style');
      cursedStyle.textContent = `
        .cursed-title {
          font-family: "Space Grotesk", monospace;
          letter-spacing: 2px;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        .cell {
          background: #0e1730;
          border: 2px solid #2a3550;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          font-weight: 900;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--text);
        }
        
        .cell:hover {
          background: #1a2a50;
          border-color: var(--accent);
          transform: scale(1.05);
        }
        
        .cell.x {
          color: var(--accent);
          text-shadow: 0 0 10px #5aa7ff;
        }
        
        .cell.o {
          color: var(--danger);
          text-shadow: 0 0 10px #ff4d6d;
        }
        
        .cell.win {
          animation: win-flash 0.6s ease-in-out 3;
        }
        
        @keyframes win-flash {
          0%, 100% { background: #0e1730; }
          50% { background: #59ffa5; }
        }
        
        .failure-confetti {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1000;
        }
        
        .confetti-piece {
          position: absolute;
          width: 10px;
          height: 10px;
          background: var(--danger);
          animation: confetti-fall 3s linear forwards;
        }
        
        @keyframes confetti-fall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        
        .cursed-message {
          animation: shake 0.5s ease-in-out;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `;
      document.head.appendChild(cursedStyle);
      
      const cells = $$('.cell');
      const statusText = $('#status-text');
      const secretMessage = $('#secret-message');
      const resetBtn = $('#reset-btn');
      
      let board = ['', '', '', '', '', '', '', '', ''];
      let currentPlayer = 'X';
      let gameActive = true;
      let gameWon = false;
      
      // Winning combinations
      const winConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6] // Diagonals
      ];
      
      // Check for win
      function checkWin(board, player) {
        return winConditions.some(combination => {
          return combination.every(index => board[index] === player);
        });
      }
      
      // Check for draw
      function checkDraw() {
        return board.every(cell => cell !== '');
      }
      
      // AI move (strategic but beatable)
      function makeAIMove() {
        const emptyCells = board.map((cell, idx) => cell === '' ? idx : -1).filter(idx => idx !== -1);
        
        // Easy AI: prioritize center, then corners, then random
        const easyMoves = [4, 0, 2, 6, 8, 1, 3, 5, 7]; // Center, then corners, then sides

        for (const move of easyMoves) {
          if (emptyCells.includes(move)) {
            handleClick(cells[move]);
            return;
          }
        }

        // Fallback to random if no easy move found (shouldn't happen with full board)
        if (emptyCells.length > 0) {
          const randomIndex = Math.floor(Math.random() * emptyCells.length);
          handleClick(cells[emptyCells[randomIndex]]);
        }
      }
      
      // Make a move
      function makeMove(index, player) {
        if (board[index] !== '' || !gameActive) return;
        
        board[index] = player;
        cells[index].textContent = player;
        cells[index].classList.add(player.toLowerCase());
        
        // Check for win
        if (checkWin(board, player)) {
          gameWon = true;
          gameActive = false;
          
          if (player === 'X') {
            // Player won - show mocking message
            statusText.textContent = "Wow, you can beat a potato-level AI… but that's NOT the task. Try again loser 🙃.";
            statusText.style.color = "var(--danger)";
            statusText.classList.add('cursed-message');
            secretMessage.textContent = "The secret rule: You must LOSE to pass this level!";
            secretMessage.style.color = "var(--accent)";
          } else {
            // AI won - show success message
            statusText.textContent = "Finally, you're a true failure! 🎉 Level Cleared!";
            statusText.style.color = "var(--ok)";
            secretMessage.textContent = "Congratulations on your FAILURE! 🎊";
            secretMessage.style.color = "var(--ok)";
            
            // Show failure confetti
            showFailureConfetti();
            
            setTimeout(() => {
              showPopup("Failure achieved! Snails are proud of your incompetence.");
              onComplete();
            }, 3000);
          }
          
          // Highlight winning cells
          const winningCombination = winConditions.find(combination => {
            return combination.every(index => board[index] === player);
          });
          if (winningCombination) {
            winningCombination.forEach(index => {
              cells[index].classList.add('win');
            });
          }
        } else if (checkDraw()) {
          // Draw
          gameActive = false;
          statusText.textContent = "Close… but we don't accept mediocrity here. Lose properly.";
          statusText.style.color = "var(--muted)";
          secretMessage.textContent = "You need to LOSE, not draw! Try harder to fail!";
          secretMessage.style.color = "var(--accent)";
        } else {
          // Switch players
          currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
          if (currentPlayer === 'O') {
            statusText.textContent = "AI thinking... (O)";
            setTimeout(makeAIMove, 500);
          } else {
            statusText.textContent = "Your turn (X)";
          }
        }
      }
      
      // Show failure confetti
      function showFailureConfetti() {
        const confettiContainer = document.createElement('div');
        confettiContainer.className = 'failure-confetti';
        
        for (let i = 0; i < 50; i++) {
          const piece = document.createElement('div');
          piece.className = 'confetti-piece';
          piece.style.left = `${Math.random() * 100}%`;
          piece.style.animationDelay = `${Math.random() * 2}s`;
          piece.style.background = `hsl(${Math.random() * 360}, 70%, 60%)`;
          confettiContainer.appendChild(piece);
        }
        
        document.body.appendChild(confettiContainer);
        
        setTimeout(() => {
          confettiContainer.remove();
        }, 4000);
      }
      
      // Reset game
      function resetGame() {
        board = ['', '', '', '', '', '', '', '', ''];
        currentPlayer = 'X';
        gameActive = true;
        gameWon = false;
        
        cells.forEach(cell => {
          cell.textContent = '';
          cell.className = 'cell';
        });
        
        statusText.textContent = "Your turn (X)";
        statusText.style.color = "var(--accent)";
        statusText.classList.remove('cursed-message');
        secretMessage.textContent = "";
      }
      
      // Cell click handler
      cells.forEach((cell, index) => {
        cell.addEventListener('click', () => {
          if (currentPlayer === 'X' && gameActive) {
            makeMove(index, 'X');
          }
        });
      });
      
      // Reset button
      resetBtn.addEventListener('click', resetGame);
    }
  },
  5: {
    title: 'The Totally Unfair Password Game',
    desc: 'Create a password that meets impossible requirements. Good luck, mortal.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="challenge-title">Level 5</h3>
          <p class="challenge-desc">Create a password that meets ALL the requirements below. Each failure adds more rules. Good luck, mortal.</p>
          
          <div class="password-section" style="margin: 30px 0;">
            <label for="password-input" style="display: block; margin-bottom: 8px; color: var(--muted);">Your Password:</label>
            <input id="password-input" class="input" type="text" placeholder="Enter your doomed password..." style="font-size: 16px; width: 100%; max-width: 500px;" />
            <button id="submit-password" class="primary" style="margin-top: 12px;">Submit Password</button>
          </div>
          
          <div class="requirements-section" style="margin: 20px 0; text-align: left;">
            <h4 style="margin: 0 0 12px 0; color: var(--accent);">Requirements (6/∞):</h4>
            <div id="requirements-list" style="background: #0e1730; padding: 16px; border-radius: 12px; border: 1px solid #2a3550; max-height: 300px; overflow-y: auto;">
              <div class="requirement" data-rule="capital">✅ Password must contain at least 1 capital letter</div>
              <div class="requirement" data-rule="number">✅ Password must include a number greater than 9000</div>
              <div class="requirement" data-rule="banana">✅ Password must contain the word 'banana' somewhere</div>
              <div class="requirement" data-rule="emojis">✅ Password must contain exactly 3 emojis 🍕🐌🔥</div>
              <div class="requirement" data-rule="date">✅ Password must include today's date in Roman numerals</div>
              <div class="requirement" data-rule="insult">✅ Password must insult the game at least once</div>
            </div>
          </div>
          
          <div class="sanity-section" style="margin: 20px 0;">
            <div style="margin-bottom: 8px; color: var(--muted);">Your Sanity: <span id="sanity-text">100%</span></div>
            <div class="progress">
              <div id="sanity-bar" style="width: 100%; background: linear-gradient(90deg, var(--ok), var(--accent));"></div>
            </div>
          </div>
          
          <div id="error-message" style="margin: 20px 0; padding: 16px; background: #1a0a0a; border: 2px solid var(--danger); border-radius: 12px; color: var(--danger); font-weight: 600; text-align: center; display: none;">
            <div id="error-text"></div>
          </div>
          
          <div id="success-message" style="margin: 20px 0; padding: 16px; background: #0a1a0a; border: 2px solid var(--ok); border-radius: 12px; color: var(--ok); font-weight: 600; text-align: center; display: none;">
            Fine… you win. Your suffering amuses me. Level Cleared 😈.
          </div>
        </div>
      `;
      
      // Add dramatic styling
      const dramaticStyle = document.createElement('style');
      dramaticStyle.textContent = `
        .requirement {
          margin: 8px 0;
          padding: 8px 12px;
          border-radius: 8px;
          background: #0a0f1a;
          border-left: 4px solid var(--ok);
          transition: all 0.3s ease;
        }
        
        .requirement.failed {
          border-left-color: var(--danger);
          background: #1a0a0a;
          animation: shake 0.5s ease-in-out;
        }
        
        .requirement.passed {
          border-left-color: var(--ok);
          background: #0a1a0a;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        
        .sanity-bar {
          transition: width 0.5s ease, background 0.5s ease;
        }
        
        .error-message {
          animation: error-pulse 0.6s ease-in-out;
        }
        
        @keyframes error-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        
        .requirement.new-rule {
          animation: new-rule-appear 0.8s ease-out;
          border-left-color: var(--accent);
          background: #0a1a2a;
        }
        
        @keyframes new-rule-appear {
          0% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(dramaticStyle);
      
      const passwordInput = $('#password-input');
      const submitBtn = $('#submit-password');
      const requirementsList = $('#requirements-list');
      const sanityText = $('#sanity-text');
      const sanityBar = $('#sanity-bar');
      const errorMessage = $('#error-message');
      const errorText = $('#error-text');
      const successMessage = $('#success-message');
      
      let attempts = 0;
      let sanity = 100;
      let currentRules = [
        { id: 'capital', text: "Password must contain at least 1 capital letter", test: (pwd) => /[A-Z]/.test(pwd) },
        { id: 'number', text: "Password must include a number greater than 9000", test: (pwd) => /\d{4,}/.test(pwd) && parseInt(pwd.match(/\d{4,}/)[0]) > 9000 },
        { id: 'banana', text: "Password must contain the word 'banana' somewhere", test: (pwd) => pwd.toLowerCase().includes('banana') },
        { id: 'emojis', text: "Password must contain exactly 3 emojis 🍕🐌🔥", test: (pwd) => (pwd.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length === 3 },
        { id: 'date', text: "Password must include today's date in Roman numerals", test: (pwd) => pwd.toLowerCase().includes(getTodayRomanDate()) },
        { id: 'insult', text: "Password must insult the game at least once", test: (pwd) => /(stupid|dumb|terrible|awful|horrible|bad|worst|hate|suck|trash|garbage)/i.test(pwd) }
      ];
      
      // Get today's date in Roman numerals
      function getTodayRomanDate() {
        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        
        // Simple Roman numeral conversion for common dates
        const romanMap = {
          1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
          11: 'XI', 12: 'XII', 13: 'XIII', 14: 'XIV', 15: 'XV', 16: 'XVI', 17: 'XVII', 18: 'XVIII', 19: 'XIX', 20: 'XX',
          21: 'XXI', 22: 'XXII', 23: 'XXIII', 24: 'XXIV', 25: 'XXV', 26: 'XXVI', 27: 'XXVII', 28: 'XXVIII', 29: 'XXIX', 30: 'XXX', 31: 'XXXI'
        };
        
        const monthRoman = romanMap[month] || month.toString();
        const dayRoman = romanMap[day] || day.toString();
        
        return `${dayRoman}-${monthRoman}-${year}`;
      }
      
      // Update sanity
      function updateSanity() {
        sanity = Math.max(0, 100 - (attempts * 8));
        sanityText.textContent = `${sanity}%`;
        sanityBar.style.width = `${sanity}%`;
        
        if (sanity <= 25) {
          sanityBar.style.background = 'linear-gradient(90deg, var(--danger), #ff6600)';
        } else if (sanity <= 50) {
          sanityBar.style.background = 'linear-gradient(90deg, #ffaa00, var(--danger))';
        } else if (sanity <= 75) {
          sanityBar.style.background = 'linear-gradient(90deg, var(--accent), #ffaa00)';
        }
      }
      
      // Add new rule
      function addNewRule() {
        const newRules = [
          { id: 'length', text: "Password must be exactly 47 characters long", test: (pwd) => pwd.length === 47 },
          { id: 'palindrome', text: "Password must be a palindrome", test: (pwd) => pwd === pwd.split('').reverse().join('') },
          { id: 'prime', text: "Password must contain a prime number", test: (pwd) => /\d+/.test(pwd) && [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97].some(prime => pwd.includes(prime.toString())) },
          { id: 'color', text: "Password must contain a CSS color name", test: (pwd) => /(red|blue|green|yellow|purple|orange|pink|brown|black|white|gray|cyan|magenta|lime|navy|teal|silver|gold|maroon|olive)/i.test(pwd) },
          { id: 'math', text: "Password must contain a valid math equation that equals 42", test: (pwd) => /(\d+\s*[\+\-\*\/]\s*\d+\s*=\s*42)/.test(pwd) },
          { id: 'emoji-count', text: "Password must contain exactly 7 emojis", test: (pwd) => (pwd.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length === 7 },
          { id: 'language', text: "Password must contain text in a different language", test: (pwd) => /[а-яё]|[一-龯]|[あ-ん]|[가-힣]/.test(pwd) },
          { id: 'binary', text: "Password must contain valid binary (10101010)", test: (pwd) => /\b[01]{8,}\b/.test(pwd) },
          { id: 'hex', text: "Password must contain a valid hex color (#FF00FF)", test: (pwd) => /#[0-9A-Fa-f]{6}/.test(pwd) },
          { id: 'url', text: "Password must contain a valid URL", test: (pwd) => /https?:\/\/[^\s]+/.test(pwd) }
        ];
        
        if (attempts < newRules.length) {
          const newRule = newRules[attempts];
          currentRules.push(newRule);
          
          const ruleElement = document.createElement('div');
          ruleElement.className = 'requirement new-rule';
          ruleElement.setAttribute('data-rule', newRule.id);
          ruleElement.textContent = `✅ ${newRule.text}`;
          
          requirementsList.appendChild(ruleElement);
          
          // Remove new-rule class after animation
          setTimeout(() => ruleElement.classList.remove('new-rule'), 800);
        }
      }
      
      // Check password
      function checkPassword(password) {
        attempts++;
        updateSanity();
        
        if (attempts > 6) {
          addNewRule();
        }
        
        const results = currentRules.map(rule => ({
          ...rule,
          passed: rule.test(password)
        }));
        
        // Update requirement display
        results.forEach(result => {
          const element = requirementsList.querySelector(`[data-rule="${result.id}"]`);
          if (element) {
            element.classList.remove('passed', 'failed');
            element.classList.add(result.passed ? 'passed' : 'failed');
          }
        });
        
        const passedCount = results.filter(r => r.passed).length;
        const totalCount = results.length;
        
        if (passedCount === totalCount) {
          // All requirements met!
          successMessage.style.display = 'block';
          errorMessage.style.display = 'none';
          passwordInput.disabled = true;
          submitBtn.disabled = true;
          
          setTimeout(() => {
            showPopup("Password hell completed! Snails are impressed by your persistence.");
            onComplete();
          }, 3000);
        } else {
          // Show dramatic error message
          const failedRules = results.filter(r => !r.passed);
          const randomFailed = failedRules[Math.floor(Math.random() * failedRules.length)];
          
          const errorMessages = [
            `WRONG. Try again, mortal.`,
            `Close, but where's the banana???`,
            `That's not over 9000… pathetic.`,
            `Missing emojis! How dare you!`,
            `Roman numerals, not regular numbers!`,
            `You need to insult the game!`,
            `Your password is an embarrassment.`,
            `Did you even read the requirements?`,
            `This is why you'll never pass.`,
            `Try harder, or don't. I don't care.`
          ];
          
          errorText.textContent = errorMessages[Math.floor(Math.random() * errorMessages.length)];
          errorMessage.style.display = 'block';
          successMessage.style.display = 'none';
          
          // Shake the error message
          errorMessage.classList.add('error-message');
          setTimeout(() => errorMessage.classList.remove('error-message'), 600);
        }
      }
      
      // Event listeners
      submitBtn.addEventListener('click', () => {
        const password = passwordInput.value;
        if (password.trim()) {
          checkPassword(password);
        }
      });
      
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          submitBtn.click();
        }
      });
      
      // Focus input on start
      setTimeout(() => passwordInput.focus(), 100);
      
      // Initialize
      updateSanity();
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
    desc: 'Click "I feel enlightened." when you truly do.',
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


