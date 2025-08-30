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
    title: 'Keyboard of Eternal Slime',
    desc: 'Type words with a real keyboard that gets sabotaged by snail slime every 3 seconds.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="challenge-title">Level 2</h3>
          <p class="challenge-desc">Welcome to Level 2: Keyboard of Eternal Slime. Type the word shown using your real keyboard. Sounds simple… until the snail slime kicks in!</p>
          
          <div class="target-section" style="margin: 20px 0; padding: 16px; background: #0e1730; border-radius: 12px; border: 1px solid #2a3550;">
            <h4 style="margin: 0 0 8px 0; color: var(--accent);">Target Word:</h4>
            <div id="target-word" style="font-size: 24px; line-height: 1.4; color: var(--text); font-weight: 600; text-align: center;">slime</div>
          </div>
          
          <div class="input-section" style="margin: 20px 0;">
            <label for="slime-input" style="display: block; margin-bottom: 8px; color: var(--muted);">Type here (if you dare):</label>
            <input id="slime-input" class="input" type="text" placeholder="Start typing..." style="font-size: 18px; width: 100%; max-width: 500px; padding: 12px; background: #0a0f1a; border: 2px solid #2a3550; border-radius: 8px; color: var(--text);" />
            <div id="slime-status" style="margin-top: 12px; padding: 8px; background: #0a0f1a; border-radius: 6px; border: 1px solid #1f2a44; min-height: 20px; color: var(--muted); font-size: 14px; text-align: center;"></div>
          </div>
          
          <div class="stats-section" style="margin: 20px 0; text-align: center;">
            <div style="margin-bottom: 8px; color: var(--muted);">Words Completed: <span id="words-completed">0</span>/3</div>
            <div style="margin-bottom: 8px; color: var(--muted);">Time until slime: <span id="slime-timer">3</span>s</div>
            <div class="progress">
              <div id="level2-progress" style="width: 0%"></div>
            </div>
          </div>
          
          <div id="level2-status" style="margin-top: 16px; font-weight: 600; text-align: center;"></div>
        </div>
      `;
      
      const targetWord = $('#target-word');
      const input = $('#slime-input');
      const slimeStatus = $('#slime-status');
      const wordsCompleted = $('#words-completed');
      const slimeTimer = $('#slime-timer');
      const progressBar = $('#level2-progress');
      const status = $('#level2-status');
      
      let currentWord = '';
      let currentTyped = '';
      let completedWords = 0;
      let slimeCountdown = 3;
      let slimeInterval;
      let backspaceCount = 0;
      let spacebarHits = 0;
      let chaosMode = false;
      
      const words = ['slime', 'snailord', 'lettuceking', 'ragequit', 'slimeoverlord', 'snailmaster'];
      
      // Keyboard sabotage maps
      let keySwapMap = {};
      let slimedKeys = new Set();
      let spacebarBroken = false;
      
      function getRandomWord() {
        return words[Math.floor(Math.random() * words.length)];
      }
      
      function updateSlimeStatus() {
        if (chaosMode) {
          slimeStatus.textContent = "🐌 CHAOS MODE: Every letter = 🐌 🐌 🐌";
          slimeStatus.style.color = "var(--danger)";
        } else {
          const slimedCount = slimedKeys.size;
          const swappedCount = Object.keys(keySwapMap).length;
          slimeStatus.textContent = `Slimed keys: ${slimedCount} | Swapped keys: ${swappedCount} | Spacebar: ${spacebarBroken ? 'BROKEN' : 'Working'}`;
          slimeStatus.style.color = "var(--muted)";
        }
      }
      
      function sabotageKeyboard() {
        // Reset sabotage
        keySwapMap = {};
        slimedKeys.clear();
        spacebarBroken = false;
        
        // Random key swaps (2-5 keys)
        const swapCount = Math.floor(Math.random() * 4) + 2;
        const allKeys = 'abcdefghijklmnopqrstuvwxyz'.split('');
        
        for (let i = 0; i < swapCount; i++) {
          const key1 = allKeys[Math.floor(Math.random() * allKeys.length)];
          const key2 = allKeys[Math.floor(Math.random() * allKeys.length)];
          if (key1 !== key2) {
            keySwapMap[key1] = key2;
            keySwapMap[key2] = key1;
          }
        }
        
        // Random slimed keys (1-3 keys)
        const slimeCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < slimeCount; i++) {
          const randomKey = allKeys[Math.floor(Math.random() * allKeys.length)];
          slimedKeys.add(randomKey);
        }
        
        // Sometimes break spacebar
        if (Math.random() < 0.4) {
          spacebarBroken = true;
        }
        
        // Check for chaos mode
        if (Object.keys(keySwapMap).length >= 20 || slimedKeys.size >= 10) {
          chaosMode = true;
        }
        
        updateSlimeStatus();
        showPopup("🐌 Snail slime has corrupted your keyboard!");
        updatePatience(2);
      }
      
      function startSlimeTimer() {
        slimeCountdown = 3;
        slimeInterval = setInterval(() => {
          slimeCountdown--;
          slimeTimer.textContent = slimeCountdown;
          
          if (slimeCountdown <= 0) {
            sabotageKeyboard();
            startSlimeTimer();
          }
        }, 1000);
      }
      
      function processInput(inputChar) {
        let processedChar = inputChar;
        
        if (chaosMode) {
          return '🐌';
        }
        
        // Check for key swaps
        if (keySwapMap[inputChar]) {
          processedChar = keySwapMap[inputChar];
        }
        
        // Check for slimed keys
        if (slimedKeys.has(inputChar)) {
          processedChar = 'ssssss';
        }
        
        return processedChar;
      }
      
      function handleInput(e) {
        const inputValue = e.target.value;
        const lastChar = inputValue[inputValue.length - 1];
        
        if (e.inputType === 'deleteContentBackward') {
          backspaceCount++;
          if (backspaceCount > 5) {
            showPopup("Humans fear commitment. Snails never delete 🐌");
            updatePatience(2);
          }
          return;
        }
        
        if (lastChar === ' ') {
          if (spacebarBroken) {
            spacebarHits++;
            if (spacebarHits < 3) {
              showPopup(`Spacebar needs ${3 - spacebarHits} more hits!`);
              e.target.value = inputValue.slice(0, -1); // Remove the space
              return;
            } else {
              spacebarHits = 0;
              spacebarBroken = false;
              showPopup("Spacebar fixed! For now...");
            }
          }
        }
        
        // Process the input with sabotage
        const processedChar = processInput(lastChar);
        
        if (processedChar !== lastChar) {
          // Replace the last character with processed version
          e.target.value = inputValue.slice(0, -1) + processedChar;
        }
        
        currentTyped = e.target.value;
        
        // Check for word completion
        if (currentTyped === currentWord) {
          // Word completed!
          completedWords++;
          wordsCompleted.textContent = completedWords;
          progressBar.style.width = `${(completedWords / 3) * 100}%`;
          
          if (completedWords >= 3) {
            // Level complete!
            status.textContent = "🎉 Level Cleared! You survived the slime!";
            status.style.color = "var(--ok)";
            showPopup("Barely acceptable. Snail still faster 🐌");
            fireConfetti();
            setTimeout(() => onComplete(), 2000);
            return;
          }
          
          // Start new word
          currentWord = getRandomWord();
          currentTyped = '';
          targetWord.textContent = currentWord;
          e.target.value = '';
          showPopup("Word completed! But the slime is getting worse...");
        } else if (currentTyped.length >= currentWord.length) {
          // Word is wrong
          showPopup("Your typing speed = dial-up internet 🐌");
          updatePatience(3);
        }
      }
      
      // Initialize
      currentWord = getRandomWord();
      targetWord.textContent = currentWord;
      startSlimeTimer();
      sabotageKeyboard(); // Initial sabotage
      
      // Event listeners
      input.addEventListener('input', handleInput);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          backspaceCount++;
          if (backspaceCount > 5) {
            showPopup("Humans fear commitment. Snails never delete 🐌");
            updatePatience(2);
          }
        }
      });
      
      // Focus input on start
      setTimeout(() => input.focus(), 100);
      
      // Add CSS animations
      const style = document.createElement('style');
      style.textContent = `
        #slime-input:focus {
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
        @keyframes slime {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .slime-mode {
          animation: slime 0.5s ease-in-out infinite;
        }
      `;
      document.head.appendChild(style);
      
      // Cleanup function
      return () => {
        if (slimeInterval) clearInterval(slimeInterval);
      };
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
          transform: translateY(-3px) scale(1.02);
          box-shadow: 
            0 15px 50px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.4),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1);
          filter: brightness(1.1);
        }
        
        .glass-button:active {
          transform: translateY(-1px) scale(0.98);
          transition: all 0.1s ease;
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
            radial-gradient(circle at 50% 50%, transparent 20%, rgba(255, 0, 0, 0.3) 22%, transparent 25%),
            linear-gradient(45deg, transparent 48%, rgba(255, 0, 0, 0.3) 50%, transparent 52%),
            linear-gradient(-45deg, transparent 48%, rgba(255, 0, 0, 0.2) 50%, transparent 52%);
          pointer-events: none;
          animation: crack-in 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          filter: drop-shadow(0 0 8px rgba(255, 0, 0, 0.4));
        }

        .glass-button.crack-two::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 50% 50%, transparent 15%, rgba(255, 0, 0, 0.4) 17%, transparent 20%),
            linear-gradient(45deg, transparent 45%, rgba(255, 0, 0, 0.4) 48%, transparent 52%),
            linear-gradient(-45deg, transparent 45%, rgba(255, 0, 0, 0.4) 48%, transparent 52%),
            linear-gradient(90deg, transparent 48%, rgba(255, 0, 0, 0.4) 50%, transparent 52%),
            linear-gradient(135deg, transparent 45%, rgba(255, 0, 0, 0.3) 48%, transparent 52%);
          pointer-events: none;
          animation: crack-in 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          filter: drop-shadow(0 0 12px rgba(255, 0, 0, 0.6));
        }

        @keyframes crack-in {
          0% { 
            opacity: 0; 
            transform: scale(0.6) rotate(-5deg); 
            filter: brightness(0.5);
          }
          50% { 
            opacity: 0.8; 
            transform: scale(1.1) rotate(2deg); 
            filter: brightness(1.2);
          }
          100% { 
            opacity: 1; 
            transform: scale(1) rotate(0deg); 
            filter: brightness(1);
          }
        }
        
        .glass-button.shattered {
          animation: shatter 0.5s ease-out forwards;
          pointer-events: none;
          box-shadow: 0 0 40px rgba(255, 0, 0, 0.8), 0 0 20px rgba(255, 100, 100, 0.6);
        }
        
        @keyframes shatter {
          0% { 
            transform: scale(1) rotate(0deg); 
            opacity: 1;
            filter: brightness(1) blur(0px);
          }
          15% { 
            transform: scale(1.15) rotate(8deg); 
            box-shadow: 0 0 50px rgba(255, 0, 0, 0.9);
            filter: brightness(1.3) blur(1px);
          }
          35% { 
            transform: scale(0.9) rotate(-12deg); 
            opacity: 0.9;
            filter: brightness(1.1) blur(2px);
          }
          60% { 
            transform: scale(0.7) rotate(18deg); 
            opacity: 0.6;
            filter: brightness(0.8) blur(3px);
          }
          85% { 
            transform: scale(0.3) rotate(-25deg); 
            opacity: 0.3;
            filter: brightness(0.6) blur(4px);
          }
          100% { 
            transform: scale(0) rotate(45deg);
            opacity: 0;
            box-shadow: 0 0 0 transparent;
            filter: brightness(0.4) blur(5px);
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
          width: 24px; /* Slightly smaller for better distribution */
          height: 24px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          animation: piece-fly 1.5s ease-out forwards;
          animation-delay: var(--delay);
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
        }
        
        @keyframes piece-fly {
          0% { 
            transform: translate(0, 0) rotate(0deg) scale(1); 
            opacity: 1;
            filter: brightness(1);
          }
          20% {
            transform: translate(calc(var(--fly-x) * 0.2), calc(var(--fly-y) * 0.2)) rotate(calc(var(--fly-rot) * 0.2)) scale(1.1);
            opacity: 1;
            filter: brightness(1.2);
          }
          60% {
            transform: translate(calc(var(--fly-x) * 0.6), calc(var(--fly-y) * 0.6)) rotate(calc(var(--fly-rot) * 0.6)) scale(0.9);
            opacity: 0.8;
            filter: brightness(0.8);
          }
          100% { 
            transform: translate(var(--fly-x), var(--fly-y)) rotate(var(--fly-rot)) scale(0.5);
            opacity: 0;
            filter: brightness(0.5);
          }
        }

        .shatter-burst {
          position: absolute;
          width: 180px; /* Larger burst */
          height: 180px;
          background: radial-gradient(circle, 
            rgba(255, 255, 255, 0.9) 0%, 
            rgba(255, 200, 200, 0.7) 30%, 
            rgba(255, 100, 100, 0.5) 60%, 
            rgba(255, 50, 50, 0.3) 80%, 
            transparent 100%);
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0); /* Start small */
          animation: burst-out 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          pointer-events: none;
          z-index: 99;
          top: 50%;
          left: 50%;
          box-shadow: 
            0 0 40px rgba(255, 255, 255, 0.6),
            0 0 80px rgba(255, 100, 100, 0.4),
            0 0 120px rgba(255, 50, 50, 0.2);
        }

        @keyframes burst-out {
          0% { 
            transform: translate(-50%, -50%) scale(0); 
            opacity: 1;
            filter: brightness(1) blur(0px);
          }
          30% { 
            transform: translate(-50%, -50%) scale(0.8); 
            opacity: 1;
            filter: brightness(1.2) blur(1px);
          }
          70% { 
            transform: translate(-50%, -50%) scale(1.2); 
            opacity: 0.8;
            filter: brightness(1.1) blur(2px);
          }
          100% { 
            transform: translate(-50%, -50%) scale(1.8); 
            opacity: 0;
            filter: brightness(0.8) blur(3px);
          }
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

        const numPieces = 40; // Increased number of pieces for better effect
        for (let i = 0; i < numPieces; i++) {
          const piece = document.createElement('div');
          piece.className = 'glass-piece';
          const angle = Math.random() * 2 * Math.PI;
          const distance = Math.random() * 120 + 80; // Fly further and more varied
          piece.style.setProperty('--fly-x', `${Math.cos(angle) * distance}px`);
          piece.style.setProperty('--fly-y', `${Math.sin(angle) * distance}px`);
          piece.style.setProperty('--fly-rot', `${Math.random() * 1080 - 540}deg`); // More rotation
          piece.style.setProperty('--delay', `${Math.random() * 0.3}s`); // Staggered animation
          piecesContainer.appendChild(piece);
        }

        // Add a temporary burst effect
        const burst = document.createElement('div');
        burst.className = 'shatter-burst';
        button.parentNode.insertBefore(burst, button.nextSibling);
        setTimeout(() => burst.remove(), 800); // Remove burst after 0.8s

        // Restart the button after shattering animation
        setTimeout(() => {
          piecesContainer.remove();
          resetButton();
          showPopup("Button regenerated! Snail magic! 🐌✨");
        }, 2000); // Restart after 2 seconds
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
    title: 'Ultra-Simple Tic Tac Toe',
    desc: 'Basic Tic Tac Toe with zero performance issues',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="challenge-title">Level 4</h3>
          <p class="challenge-desc">Ultra-Simple Tic Tac Toe - No lag, no hanging, just pure gameplay!</p>
          
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
          </div>
          
          <div class="game-info" style="margin: 20px 0; text-align: center;">
            <div style="margin-bottom: 8px; color: var(--muted);">Rounds: <span id="rounds-played">0</span></div>
          </div>
        </div>
      `;
      
      // Ultra-minimal static styling for maximum performance
      const cursedStyle = document.createElement('style');
      cursedStyle.textContent = `
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
          color: var(--text);
        }
        
        .cell.x {
          color: var(--accent);
        }
        
        .cell.o {
          color: var(--danger);
        }
        

        

      `;
      document.head.appendChild(cursedStyle);
      
      const cells = $$('.cell');
      const statusText = $('#status-text');
      const roundsPlayed = $('#rounds-played');
      
      let board = ['', '', '', '', '', '', '', '', ''];
      let currentPlayer = 'X';
      let gameActive = true;
      let roundsCount = 0;
      

      
      // Check for draw
      function checkDraw() {
        return board.every(cell => cell !== '');
      }
      
      // Simple win check
      function checkWin(board, player) {
        const lines = [
          [0,1,2], [3,4,5], [6,7,8], // rows
          [0,3,6], [1,4,7], [2,5,8], // cols
          [0,4,8], [2,4,6] // diags
        ];
        return lines.some(line => 
          line.every(i => board[i] === player)
        );
      }
      

      
      // Simple AI move
      function makeAIMove() {
        for (let i = 0; i < board.length; i++) {
          if (board[i] === '') {
            makeMove(i, 'O');
            break;
          }
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
            // Player won - snail taunts
            statusText.textContent = "🎉 You won! (But you were supposed to lose...)";
            statusText.style.color = "var(--ok)";
            snailMessage.textContent = "🐌 Snail: Pathetic human, I let you have that.";
            snailMessage.style.color = "var(--muted)";
            
            // Highlight winning cells (hardcoded for speed)
            if (board[0] === player && board[1] === player && board[2] === player) {
              cells[0].classList.add('win'); cells[1].classList.add('win'); cells[2].classList.add('win');
            } else if (board[3] === player && board[4] === player && board[5] === player) {
              cells[3].classList.add('win'); cells[4].classList.add('win'); cells[5].classList.add('win');
            } else if (board[6] === player && board[7] === player && board[8] === player) {
              cells[6].classList.add('win'); cells[7].classList.add('win'); cells[8].classList.add('win');
            } else if (board[0] === player && board[3] === player && board[6] === player) {
              cells[0].classList.add('win'); cells[3].classList.add('win'); cells[6].classList.add('win');
            } else if (board[1] === player && board[4] === player && board[7] === player) {
              cells[1].classList.add('win'); cells[4].classList.add('win'); cells[7].classList.add('win');
            } else if (board[2] === player && board[5] === player && board[8] === player) {
              cells[2].classList.add('win'); cells[5].classList.add('win'); cells[8].classList.add('win');
            } else if (board[0] === player && board[4] === player && board[8] === player) {
              cells[0].classList.add('win'); cells[4].classList.add('win'); cells[8].classList.add('win');
            } else if (board[2] === player && board[4] === player && board[6] === player) {
              cells[2].classList.add('win'); cells[4].classList.add('win'); cells[6].classList.add('win');
            }
            
            // Simple auto-clear
            roundsCount++;
            if (roundsCount >= 3) {
              onComplete();
            } else {
              setTimeout(resetBoard, 1000);
            }
          } else {
            // AI won
            statusText.textContent = "AI won!";
            setTimeout(resetBoard, 1000);
          }
        } else if (checkDraw()) {
          // Draw
          gameActive = false;
          statusText.textContent = "Draw!";
          
          roundsCount++;
          if (roundsCount >= 3) {
            onComplete();
          } else {
            setTimeout(resetBoard, 1000);
          }
        } else {
          // Switch players
          currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
          if (currentPlayer === 'O') {
            statusText.textContent = "AI thinking...";
            setTimeout(makeAIMove, 500);
          } else {
            statusText.textContent = "Your turn (X)";
          }
        }
      }
      
      // Simple board reset
      function resetBoard() {
        board = ['', '', '', '', '', '', '', '', ''];
        currentPlayer = 'X';
        gameActive = true;
        
        // Fast DOM reset
        for (let i = 0; i < cells.length; i++) {
          cells[i].textContent = '';
          cells[i].className = 'cell';
        }
        
        statusText.textContent = "Your turn (X)";
        roundsPlayed.textContent = roundsCount;
      }
      
      // Simple cell click handler
      cells.forEach((cell, index) => {
        cell.addEventListener('click', () => {
          if (currentPlayer === 'X' && gameActive) {
            makeMove(index, 'X');
          }
        });
      });
      
      // Initialize
      roundsPlayed.textContent = roundsCount;
      
      // Return cleanup function
      return () => {};
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
  6: {
    title: 'The Fan-Tossing Cursor Conundrum',
    desc: 'Submit the secret snail code… if you can.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="challenge-title">Level 6</h3>
          <p class="challenge-desc">Submit the secret snail code… if you can.</p>
          
          <div class="warning-box" style="margin: 20px 0; padding: 16px; background: #1a0a0a; border: 2px solid var(--danger); border-radius: 12px; text-align: center;">
            <div style="color: var(--danger); font-weight: 600; font-size: 18px;">⚠️ WARNING ⚠️</div>
            <div style="color: var(--muted); margin-top: 8px;">The Snail Fan is spinning. Beware of cursor displacement.</div>
          </div>
          
          <div class="input-panel" style="margin: 30px 0; padding: 24px; background: #0e1730; border-radius: 16px; border: 2px solid #2a3550; position: relative;">
            <div class="input-display" style="margin-bottom: 20px; text-align: center;">
              <div style="color: var(--muted); margin-bottom: 8px; font-size: 14px;">Secret Code:</div>
              <div id="code-display" style="font-family: monospace; font-size: 24px; font-weight: 700; color: var(--accent); background: #0a0f1a; padding: 16px; border-radius: 8px; border: 1px solid #2a3550; min-height: 30px; letter-spacing: 2px;">_ _ _ _ _ _ _</div>
            </div>
            
            <div class="button-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 20px;">
              <!-- Letters A-Z -->
              <button class="input-btn letter" data-char="A">A</button>
              <button class="input-btn letter" data-char="B">B</button>
              <button class="input-btn letter" data-char="C">C</button>
              <button class="input-btn letter" data-char="D">D</button>
              <button class="input-btn letter" data-char="E">E</button>
              <button class="input-btn letter" data-char="F">F</button>
              <button class="input-btn letter" data-char="G">G</button>
              <button class="input-btn letter" data-char="H">H</button>
              <button class="input-btn letter" data-char="I">I</button>
              <button class="input-btn letter" data-char="J">J</button>
              <button class="input-btn letter" data-char="K">K</button>
              <button class="input-btn letter" data-char="L">L</button>
              <button class="input-btn letter" data-char="M">M</button>
              <button class="input-btn letter" data-char="N">N</button>
              <button class="input-btn letter" data-char="O">O</button>
              <button class="input-btn letter" data-char="P">P</button>
              <button class="input-btn letter" data-char="Q">Q</button>
              <button class="input-btn letter" data-char="R">R</button>
              <button class="input-btn letter" data-char="S">S</button>
              <button class="input-btn letter" data-char="T">T</button>
              <button class="input-btn letter" data-char="U">U</button>
              <button class="input-btn letter" data-char="V">V</button>
              <button class="input-btn letter" data-char="W">W</button>
              <button class="input-btn letter" data-char="X">X</button>
              <button class="input-btn letter" data-char="Y">Y</button>
              <button class="input-btn letter" data-char="Z">Z</button>
            </div>
            
            <div class="button-row" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px;">
              <!-- Numbers 0-9 -->
              <button class="input-btn number" data-char="0">0</button>
              <button class="input-btn number" data-char="1">1</button>
              <button class="input-btn number" data-char="2">2</button>
              <button class="input-btn number" data-char="3">3</button>
              <button class="input-btn number" data-char="4">4</button>
              <button class="input-btn number" data-char="5">5</button>
              <button class="input-btn number" data-char="6">6</button>
              <button class="input-btn number" data-char="7">7</button>
              <button class="input-btn number" data-char="8">8</button>
              <button class="input-btn number" data-char="9">9</button>
            </div>
            
            <div class="control-row" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <button class="input-btn control" data-char=" ">SPACE</button>
              <button class="input-btn control" id="clear-btn">CLEAR</button>
            </div>
          </div>
          
          <div class="fan-strength-section" style="margin: 20px 0; text-align: center;">
            <div style="color: var(--muted); margin-bottom: 8px;">Fan Strength</div>
            <div class="fan-meter" style="background: #0e1730; border-radius: 12px; border: 2px solid #2a3550; padding: 4px; height: 24px; position: relative; overflow: hidden;">
              <div id="fan-strength-bar" style="height: 100%; background: linear-gradient(90deg, var(--ok), var(--accent), var(--danger)); width: 0%; border-radius: 8px; transition: width 0.3s ease;"></div>
            </div>
            <div id="fan-strength-text" style="margin-top: 8px; font-size: 14px; color: var(--muted);">0%</div>
          </div>
          
          <div class="tooltip" id="fan-tooltip" style="position: absolute; background: #1a0a0a; color: var(--danger); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--danger); font-size: 12px; pointer-events: none; opacity: 0; transition: opacity 0.3s ease; z-index: 1000;">
            Fan says: Not today, human.
          </div>
          
          <div class="status-section" style="margin: 20px 0; text-align: center;">
            <div id="status-message" style="color: var(--accent); font-weight: 600; font-size: 16px;">Type the secret code: SNAIL42</div>
            <div id="attempt-count" style="color: var(--muted); margin-top: 8px; font-size: 14px;">Attempts: 0</div>
          </div>
        </div>
      `;
      
      // Add fan-tossing styles
      const fanStyle = document.createElement('style');
      fanStyle.textContent = `
        .input-btn {
          background: #0a0f1a;
          border: 2px solid #2a3550;
          border-radius: 8px;
          color: var(--text);
          font-weight: 600;
          font-size: 14px;
          padding: 12px 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        
        .input-btn:hover {
          background: #1a2a50;
          border-color: var(--accent);
          transform: scale(1.05);
        }
        
        .input-btn:active {
          transform: scale(0.95);
        }
        
        .input-btn.letter {
          background: linear-gradient(135deg, #0a0f1a, #1a2a50);
        }
        
        .input-btn.number {
          background: linear-gradient(135deg, #0a0f1a, #2a1a50);
        }
        
        .input-btn.control {
          background: linear-gradient(135deg, #0a0f1a, #501a2a);
        }
        
        .input-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(90, 167, 255, 0.2), transparent);
          transition: left 0.5s ease;
        }
        
        .input-btn:hover::before {
          left: 100%;
        }
        
        .fan-meter {
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .fan-strength-bar {
          box-shadow: 0 0 10px rgba(89, 255, 165, 0.5);
        }
        
        .fan-strength-bar.high {
          box-shadow: 0 0 20px rgba(255, 77, 109, 0.8);
        }
        
        @keyframes fan-shake {
          0%, 100% { transform: translateX(0) translateY(0); }
          25% { transform: translateX(-2px) translateY(-1px); }
          50% { transform: translateX(1px) translateY(-2px); }
          75% { transform: translateX(-1px) translateY(1px); }
        }
        
        .fan-active .input-btn {
          animation: fan-shake 0.1s ease-in-out infinite;
        }
      `;
      document.head.appendChild(fanStyle);
      
      const codeDisplay = $('#code-display');
      const fanStrengthBar = $('#fan-strength-bar');
      const fanStrengthText = $('#fan-strength-text');
      const statusMessage = $('#status-message');
      const attemptCount = $('#attempt-count');
      const fanTooltip = $('#fan-tooltip');
      const clearBtn = $('#clear-btn');
      
      let currentCode = '';
      let targetCode = 'SNAIL42';
      let attempts = 0;
      let fanStrength = 0;
      let fanStrengthInterval;
      let isFanActive = false;
      
      // Initialize fan strength decay
      function startFanDecay() {
        fanStrengthInterval = setInterval(() => {
          if (fanStrength > 0 && !isFanActive) {
            fanStrength = Math.max(0, fanStrength - 0.5);
            updateFanStrength();
          }
        }, 100);
      }
      
      // Update fan strength display
      function updateFanStrength() {
        fanStrengthBar.style.width = `${fanStrength}%`;
        fanStrengthText.textContent = `${Math.floor(fanStrength)}%`;
        
        if (fanStrength >= 100) {
          // Fan strength maxed out - reset UI
          resetUI();
        } else if (fanStrength >= 75) {
          fanStrengthBar.classList.add('high');
          document.body.classList.add('fan-active');
          } else {
          fanStrengthBar.classList.remove('high');
          document.body.classList.remove('fan-active');
        }
      }
      
      // Reset UI when fan strength maxes out
      function resetUI() {
        currentCode = '';
        codeDisplay.textContent = '_ _ _ _ _ _ _';
        fanStrength = 0;
        updateFanStrength();
        attempts++;
        attemptCount.textContent = `Attempts: ${attempts}`;
        
        statusMessage.textContent = "Snail isn't impressed—try again… if you dare.";
        statusMessage.style.color = "var(--danger)";
        
        setTimeout(() => {
          statusMessage.textContent = "Type the secret code: SNAIL42";
          statusMessage.style.color = "var(--accent)";
        }, 3000);
        
        // Show tooltip
        showTooltip("Fan says: Not today, human.");
      }
      
      // Show tooltip
      function showTooltip(message) {
        fanTooltip.textContent = message;
        fanTooltip.style.opacity = '1';
        
        setTimeout(() => {
          fanTooltip.style.opacity = '0';
        }, 2000);
      }
      
      // Toss cursor with fan
      function tossCursor(event) {
        const magnitude = Math.random() * 50 + 20; // Random displacement 20-70px
        const angle = Math.random() * Math.PI * 2; // Random direction
        
        const dx = Math.cos(angle) * magnitude;
        const dy = Math.sin(angle) * magnitude;
        
        // Move cursor
        const newX = event.clientX + dx;
        const newY = event.clientY + dy;
        
        // Create a fake cursor movement
        const fakeEvent = new MouseEvent('mousemove', {
          clientX: newX,
          clientY: newY,
          bubbles: true
        });
        
        document.dispatchEvent(fakeEvent);
        
        // Increase fan strength
        fanStrength = Math.min(100, fanStrength + Math.random() * 15 + 5);
        updateFanStrength();
        
        // Show tooltip occasionally
        if (Math.random() < 0.3) {
          showTooltip("Fan says: Not today, human.");
        }
      }
      
      // Add character to code
      function addCharacter(char) {
        if (currentCode.length < targetCode.length) {
          currentCode += char;
          updateCodeDisplay();
          
          // Check if complete
          if (currentCode.toUpperCase() === targetCode) {
            statusMessage.textContent = "🎉 Code accepted! Snails approve!";
            statusMessage.style.color = "var(--ok)";
            codeDisplay.style.borderColor = "var(--ok)";
            codeDisplay.style.background = "#0a1a0a";
            
            setTimeout(() => {
              showPopup("Secret code mastered! The fan respects your persistence.");
              onComplete();
            }, 2000);
          }
        }
      }
      
      // Update code display
      function updateCodeDisplay() {
        const display = currentCode.split('').join(' ');
        const remaining = targetCode.length - currentCode.length;
        const underscores = '_ '.repeat(remaining).trim();
        codeDisplay.textContent = display + (remaining > 0 ? ' ' + underscores : '');
      }
      
      // Clear code
      function clearCode() {
        currentCode = '';
        updateCodeDisplay();
        codeDisplay.style.borderColor = '#2a3550';
        codeDisplay.style.background = '#0a0f1a';
      }
      
      // Event listeners
      $$('.input-btn[data-char]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const char = btn.getAttribute('data-char');
          addCharacter(char);
          tossCursor(e);
        });
        
        btn.addEventListener('mouseenter', (e) => {
          tossCursor(e);
        });
      });
      
      clearBtn.addEventListener('click', clearCode);
      
      // Start fan decay
      startFanDecay();
      
      // Initialize
      updateCodeDisplay();
      updateFanStrength();
    }
  },
  7: {
    title: 'The Phone Number Slider',
    desc: 'Enter your phone number using this perfectly normal slider. What could go wrong?',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="chaos-title" style="font-size: 32px; font-weight: 900; color: var(--accent); text-shadow: 0 0 20px #5aa7ff; margin: 20px 0; animation: chaos-bounce 2s ease-in-out infinite;">📱 PHONE NUMBER SLIDER 📱</h3>
          <p class="challenge-desc">Enter your phone number using this perfectly normal slider. What could go wrong?</p>
          
          <div class="phone-display" style="margin: 30px 0; text-align: center;">
            <div style="color: var(--muted); margin-bottom: 12px; font-size: 16px;">Your Phone Number:</div>
            <div id="phone-display" style="font-family: monospace; font-size: 36px; font-weight: 900; color: var(--accent); background: #0a0f1a; padding: 20px; border-radius: 12px; border: 2px solid #2a3550; letter-spacing: 4px; min-height: 50px; display: flex; align-items: center; justify-content: center;">
              _ _ _ - _ _ _ - _ _ _ _
            </div>
          </div>
          
          <div class="slider-section" style="margin: 40px 0; padding: 30px; background: #0e1730; border-radius: 20px; border: 2px solid #2a3550; position: relative;">
            <div class="digit-info" style="margin-bottom: 20px; text-align: center;">
              <div style="color: var(--accent); font-size: 18px; font-weight: 600;">Digit <span id="current-digit">1</span> of 10</div>
              <div style="color: var(--muted); font-size: 14px;">Target: <span id="target-digit">5</span></div>
            </div>
            
            <div class="slider-container" style="position: relative; margin: 20px 0;">
              <div class="slider-track" style="height: 8px; background: #2a3550; border-radius: 4px; position: relative; overflow: visible;">
                <div class="slider-fill" id="slider-fill" style="height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); border-radius: 4px; width: 0%; transition: width 0.1s ease;"></div>
              </div>
              
              <div class="slider-handle" id="slider-handle" style="position: absolute; top: -6px; width: 20px; height: 20px; background: var(--accent); border-radius: 50%; border: 3px solid #05101e; cursor: grab; box-shadow: 0 0 15px var(--accent); transform: translateX(-10px); transition: transform 0.1s ease;">
                <div class="handle-glow" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: #fff; border-radius: 50%; opacity: 0.8;"></div>
              </div>
              
              <div class="slider-labels" style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px; color: var(--muted);">
                <span>0</span>
                <span>9999999999</span>
              </div>
            </div>
            
            <div class="slider-controls" style="text-align: center; margin-top: 20px;">
              <button id="lock-digit" class="primary" style="margin: 0 8px;">🔒 Lock Digit</button>
              <button id="reset-digit" class="secondary" style="margin: 0 8px;">🔄 Reset</button>
              <button id="chaos-mode" class="danger" style="margin: 0 8px;">🌪️ Chaos Mode</button>
            </div>
          </div>
          
          <div class="progress-section" style="margin: 20px 0; text-align: center;">
            <div style="color: var(--muted); margin-bottom: 8px;">Progress</div>
            <div class="progress" style="background: #0e1730; border-radius: 12px; border: 2px solid #2a3550; padding: 4px; height: 20px; position: relative; overflow: hidden;">
              <div id="progress-fill" style="height: 100%; background: linear-gradient(90deg, var(--ok), var(--accent)); width: 0%; border-radius: 8px; transition: width 0.3s ease;"></div>
            </div>
            <div id="progress-text" style="margin-top: 8px; font-size: 14px; color: var(--accent);">0/10 digits</div>
          </div>
          
          <div class="mockery-section" style="margin: 20px 0; text-align: center;">
            <div id="mockery-text" style="color: var(--muted); font-style: italic; min-height: 20px; font-size: 14px;">Ready to fail spectacularly?</div>
          </div>
          
          <div class="autocomplete-section" style="margin: 20px 0; text-align: center;">
            <div id="autocomplete-text" style="color: var(--danger); font-size: 12px; opacity: 0; transition: opacity 0.3s ease;">Is your number 911? 👀</div>
          </div>
          
          <div class="stats-section" style="margin: 20px 0; text-align: center;">
            <div style="color: var(--muted); font-size: 14px;">
              Attempts: <span id="attempt-count">0</span> | 
              Time: <span id="time-elapsed">00:00</span> | 
              Chaos Level: <span id="chaos-level">0</span>
            </div>
          </div>
        </div>
      `;
      
      // Add phone slider styles
      const phoneStyle = document.createElement('style');
      phoneStyle.textContent = `
        .chaos-title {
          animation: chaos-bounce 2s ease-in-out infinite;
        }
        
        @keyframes chaos-bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-5px) rotate(1deg); }
          50% { transform: translateY(0) rotate(-1deg); }
          75% { transform: translateY(-3px) rotate(0.5deg); }
        }
        
        .slider-handle {
          transition: transform 0.1s ease, box-shadow 0.2s ease;
        }
        
        .slider-handle:hover {
          box-shadow: 0 0 25px var(--accent);
          transform: translateX(-10px) scale(1.1);
        }
        
        .slider-handle:active {
          cursor: grabbing;
          transform: translateX(-10px) scale(0.95);
        }
        
        .slider-handle.chaos {
          animation: chaos-wiggle 0.1s ease-in-out infinite;
        }
        
        @keyframes chaos-wiggle {
          0%, 100% { transform: translateX(-10px) rotate(0deg); }
          25% { transform: translateX(-8px) rotate(2deg); }
          50% { transform: translateX(-12px) rotate(-1deg); }
          75% { transform: translateX(-9px) rotate(1deg); }
        }
        
        .slider-handle.spring {
          animation: spring-bounce 0.5s ease-in-out;
        }
        
        @keyframes spring-bounce {
          0% { transform: translateX(-10px) scale(1); }
          25% { transform: translateX(-10px) scale(1.2); }
          50% { transform: translateX(-10px) scale(0.8); }
          75% { transform: translateX(-10px) scale(1.1); }
          100% { transform: translateX(-10px) scale(1); }
        }
        
        .phone-display .success {
          animation: success-glow 0.6s ease-in-out 3;
        }
        
        @keyframes success-glow {
          0%, 100% { box-shadow: 0 0 20px var(--ok); }
          50% { box-shadow: 0 0 40px var(--ok), 0 0 60px var(--ok); }
        }
        
        .mockery-text {
          transition: all 0.3s ease;
        }
        
        .mockery-text.mocking {
          animation: mockery-shake 0.5s ease-in-out;
          color: var(--danger);
        }
        
        @keyframes mockery-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
      `;
      document.head.appendChild(phoneStyle);
      
      const phoneDisplay = $('#phone-display');
      const currentDigitSpan = $('#current-digit');
      const targetDigitSpan = $('#target-digit');
      const sliderHandle = $('#slider-handle');
      const sliderFill = $('#slider-fill');
      const lockBtn = $('#lock-digit');
      const resetBtn = $('#reset-digit');
      const chaosBtn = $('#chaos-mode');
      const progressFill = $('#progress-fill');
      const progressText = $('#progress-text');
      const mockeryText = $('#mockery-text');
      const autocompleteText = $('#autocomplete-text');
      const attemptCount = $('#attempt-count');
      const timeElapsed = $('#time-elapsed');
      const chaosLevel = $('#chaos-level');
      
      let currentDigit = 1;
      let phoneNumber = '';
      let attempts = 0;
      let startTime = Date.now();
      let chaosLevelValue = 0;
      let isDragging = false;
      let lastDragTime = 0;
      let springMode = false;
      
      // Target phone number (randomly generated)
      const targetPhone = generateRandomPhone();
      
      // Mockery messages
      const mockeryMessages = [
        "Oops, too far. Did you think you were doing archery?",
        "Bro, that's 7 digits off. Do you even know your own number?",
        "Close enough doesn't count, champ.",
        "That's not even close. Are you trying?",
        "Maybe use your toes next time?",
        "Did you learn counting from a snail?",
        "That's the wrong number, genius.",
        "Are you sure you're not a robot?",
        "Maybe just give up and use a landline.",
        "This is why you don't have friends.",
        "Did you eat your calculator?",
        "That's not how numbers work, buddy.",
        "Are you colorblind to numbers?",
        "Maybe try using your other hand?",
        "That's the most wrong answer possible."
      ];
      
      // Autocomplete suggestions
      const autocompleteSuggestions = [
        "Is your number 911? 👀",
        "Maybe just give up and use a landline.",
        "Have you tried turning it off and on?",
        "Did you check if it's plugged in?",
        "Have you tried blowing on it?",
        "Maybe it's in another dimension?",
        "Have you tried asking nicely?",
        "Did you sacrifice a goat?",
        "Maybe try using Morse code?",
        "Have you tried being more patient?"
      ];
      
      function generateRandomPhone() {
        return Array.from({length: 10}, () => Math.floor(Math.random() * 10)).join('');
      }
      
      function updateDisplay() {
        const display = phoneNumber.split('').join(' ');
        const remaining = 10 - phoneNumber.length;
        const underscores = '_ '.repeat(remaining).trim();
        phoneDisplay.textContent = display + (remaining > 0 ? ' - ' + underscores : '');
        
        // Update progress
        const progress = (phoneNumber.length / 10) * 100;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${phoneNumber.length}/10 digits`;
        
        // Update current digit info
        if (currentDigit <= 10) {
          currentDigitSpan.textContent = currentDigit;
          targetDigitSpan.textContent = targetPhone[currentDigit - 1];
        }
      }
      
      function updateTime() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        timeElapsed.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      
      function showMockery() {
        const message = mockeryMessages[Math.floor(Math.random() * mockeryMessages.length)];
        mockeryText.textContent = message;
        mockeryText.classList.add('mocking');
        
        setTimeout(() => {
          mockeryText.classList.remove('mocking');
        }, 500);
        
        // Show autocomplete occasionally
        if (Math.random() < 0.3) {
          const suggestion = autocompleteSuggestions[Math.floor(Math.random() * autocompleteSuggestions.length)];
          autocompleteText.textContent = suggestion;
          autocompleteText.style.opacity = '1';
          
          setTimeout(() => {
            autocompleteText.style.opacity = '0';
          }, 3000);
        }
      }
      
      function addSpringEffect() {
        if (springMode) return;
        
        springMode = true;
        sliderHandle.classList.add('spring');
        
        setTimeout(() => {
          springMode = false;
          sliderHandle.classList.remove('spring');
        }, 500);
      }
      
      function addChaosEffect() {
        chaosLevelValue++;
        chaosLevel.textContent = chaosLevelValue;
        
        if (chaosLevelValue >= 5) {
          sliderHandle.classList.add('chaos');
        }
        
        // Random spring effect
        if (Math.random() < 0.3) {
          addSpringEffect();
        }
      }
      
      function handleSliderMove(clientX) {
        const sliderContainer = $('.slider-container');
        const rect = sliderContainer.getBoundingClientRect();
        const x = clientX - rect.left;
        const width = rect.width;
        
        let percentage = Math.max(0, Math.min(100, (x / width) * 100));
        
        // Add chaos effects
        if (chaosLevelValue > 0) {
          const chaosFactor = chaosLevelValue * 0.1;
          percentage += (Math.random() - 0.5) * chaosFactor * 20;
          percentage = Math.max(0, Math.min(100, percentage));
        }
        
        // Update slider position
        sliderHandle.style.transform = `translateX(${percentage * width / 100 - 10}px)`;
        sliderFill.style.width = `${percentage}%`;
        
        // Add spring effect randomly
        if (Math.random() < 0.05) {
          addSpringEffect();
        }
      }
      
      function lockCurrentDigit() {
        const sliderContainer = $('.slider-container');
        const rect = sliderContainer.getBoundingClientRect();
        const handleRect = sliderHandle.getBoundingClientRect();
        const x = handleRect.left + handleRect.width / 2 - rect.left;
        const width = rect.width;
        const percentage = (x / width) * 100;
        
        // Calculate the digit (0-9)
        const digit = Math.floor((percentage / 100) * 10);
        const targetDigit = parseInt(targetPhone[currentDigit - 1]);
        
        if (digit === targetDigit) {
          // Correct digit!
          phoneNumber += digit.toString();
          currentDigit++;
          
          // Visual feedback
          phoneDisplay.classList.add('success');
          setTimeout(() => phoneDisplay.classList.remove('success'), 1800);
          
          if (phoneNumber.length === 10) {
            // Level complete!
            mockeryText.textContent = "Wow. You wasted 10 minutes entering your phone number. Level Cleared 🎉📱.";
            mockeryText.style.color = "var(--ok)";
            mockeryText.style.fontSize = "18px";
            mockeryText.style.fontWeight = "600";
            
            setTimeout(() => {
              showPopup("Phone number mastered! Snails are impressed by your persistence.");
              onComplete();
            }, 3000);
          } else {
            // Move to next digit
            mockeryText.textContent = "Correct! Now try the next one...";
            mockeryText.style.color = "var(--ok)";
            setTimeout(() => {
              mockeryText.textContent = "Ready to fail spectacularly?";
              mockeryText.style.color = "var(--muted)";
            }, 2000);
          }
        } else {
          // Wrong digit
          attempts++;
          attemptCount.textContent = attempts;
          
          const difference = Math.abs(digit - targetDigit);
          let message = "";
          
          if (difference === 1) {
            message = "So close! Just one digit off.";
          } else if (difference <= 3) {
            message = `Close, but that's ${difference} digits off.`;
          } else {
            message = `That's ${difference} digits off. Do you even know your own number?`;
          }
          
          mockeryText.textContent = message;
          showMockery();
          addChaosEffect();
        }
        
        updateDisplay();
      }
      
      // Event listeners
      sliderHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastDragTime = Date.now();
        sliderHandle.style.cursor = 'grabbing';
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          handleSliderMove(e.clientX);
          
          // Add chaos based on drag speed
          const now = Date.now();
          if (now - lastDragTime < 50) {
            addChaosEffect();
          }
          lastDragTime = now;
        }
      });
      
      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          sliderHandle.style.cursor = 'grab';
          
          // Random spring effect
          if (Math.random() < 0.2) {
            addSpringEffect();
          }
        }
      });
      
      lockBtn.addEventListener('click', lockCurrentDigit);
      
      resetBtn.addEventListener('click', () => {
        phoneNumber = '';
        currentDigit = 1;
        updateDisplay();
        mockeryText.textContent = "Starting over... again.";
        mockeryText.style.color = "var(--muted)";
      });
      
      chaosBtn.addEventListener('click', () => {
        chaosLevelValue += 2;
        chaosLevel.textContent = chaosLevelValue;
        addChaosEffect();
        mockeryText.textContent = "You asked for it! 🌪️";
        mockeryText.style.color = "var(--danger)";
      });
      
      // Initialize
      updateDisplay();
      setInterval(updateTime, 1000);
      
      // Show initial mockery
      setTimeout(() => {
        mockeryText.textContent = "Ready to fail spectacularly?";
      }, 1000);
    }
  },
  8: {
    title: 'Cursor Chaos: Trash Edition',
    desc: 'Welcome to Level 8: The Recycle Bin Rebellion!',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="trash-title" style="font-size: 32px; font-weight: 900; color: var(--danger); text-shadow: 0 0 20px #ff4d6d; margin: 20px 0; animation: trash-bounce 2s ease-in-out infinite;">🗑️ RECYCLE BIN REBELLION 🗑️</h3>
          <p class="challenge-desc">Your mission: Type your username… but the Recycle Bin has other plans.</p>
          
          <div class="warning-box" style="margin: 20px 0; padding: 16px; background: #1a0a0a; border: 2px solid var(--danger); border-radius: 12px; text-align: center;">
            <div style="color: var(--danger); font-weight: 600; font-size: 18px;">⚠️ WARNING ⚠️</div>
            <div style="color: var(--muted); margin-top: 8px;">The Recycle Bin is hungry and your cursor is slippery!</div>
          </div>
          
          <div class="input-section" style="margin: 30px 0; padding: 24px; background: #0e1730; border-radius: 16px; border: 2px solid #2a3550; position: relative; min-height: 200px;">
            <div class="input-display" style="margin-bottom: 20px; text-align: center;">
              <div style="color: var(--muted); margin-bottom: 8px; font-size: 16px;">Type your username:</div>
              <div id="username-display" style="font-family: monospace; font-size: 24px; font-weight: 700; color: var(--accent); background: #0a0f1a; padding: 16px; border-radius: 8px; border: 2px solid #2a3550; min-height: 30px; letter-spacing: 2px; position: relative; z-index: 10;">
                _ _ _ _ _ _ _ _ _ _
              </div>
            </div>
            
            <div class="input-controls" style="text-align: center; margin-top: 20px;">
              <input id="username-input" type="text" placeholder="Start typing..." style="font-size: 16px; width: 100%; max-width: 400px; padding: 12px; background: #0a0f1a; border: 2px solid #2a3550; border-radius: 8px; color: var(--text); text-align: center; font-family: monospace; letter-spacing: 1px;" />
              <div style="margin-top: 12px; color: var(--muted); font-size: 14px;">Target: SNAILKING</div>
            </div>
          </div>
          
          <div class="trash-meter-section" style="margin: 20px 0; text-align: center;">
            <div style="color: var(--muted); margin-bottom: 8px;">Trash Meter</div>
            <div class="trash-meter" style="background: #0e1730; border-radius: 12px; border: 2px solid #2a3550; padding: 4px; height: 24px; position: relative; overflow: hidden;">
              <div id="trash-meter-fill" style="height: 100%; background: linear-gradient(90deg, var(--ok), var(--accent), var(--danger)); width: 0%; border-radius: 8px; transition: width 0.3s ease;"></div>
            </div>
            <div id="trash-meter-text" style="margin-top: 8px; font-size: 14px; color: var(--muted);">0% - Bin is calm</div>
          </div>
          
          <div class="status-section" style="margin: 20px 0; text-align: center;">
            <div id="status-message" style="color: var(--accent); font-weight: 600; font-size: 16px;">Type SNAILKING without getting eaten!</div>
            <div id="attempt-count" style="color: var(--muted); margin-top: 8px; font-size: 14px;">Attempts: 0</div>
          </div>
          
          <div class="popup-messages" id="popup-messages" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1000;"></div>
        </div>
      `;
      
      // Add trash chaos styles
      const trashStyle = document.createElement('style');
      trashStyle.textContent = `
        .trash-title {
          animation: trash-bounce 2s ease-in-out infinite;
        }
        
        @keyframes trash-bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-5px) rotate(2deg); }
          50% { transform: translateY(0) rotate(-1deg); }
          75% { transform: translateY(-3px) rotate(1deg); }
        }
        
        .recycle-bin {
          position: absolute;
          width: 60px;
          height: 80px;
          background: linear-gradient(135deg, #2a2a2a, #4a4a4a);
          border: 3px solid #1a1a1a;
          border-radius: 8px 8px 0 0;
          cursor: pointer;
          z-index: 5;
          transition: all 0.1s ease;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        
        .recycle-bin::before {
          content: '🗑️';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 24px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }
        
        .recycle-bin::after {
          content: '';
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%);
          width: 70px;
          height: 10px;
          background: #1a1a1a;
          border-radius: 0 0 35px 35px;
        }
        
        .recycle-bin.chasing {
          animation: bin-chase 0.5s ease-in-out infinite;
          box-shadow: 0 0 20px var(--danger);
        }
        
        @keyframes bin-chase {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.1) rotate(2deg); }
          50% { transform: scale(1.05) rotate(-1deg); }
          75% { transform: scale(1.15) rotate(1deg); }
        }
        
        .recycle-bin.eating {
          animation: bin-eat 0.3s ease-in-out;
        }
        
        @keyframes bin-eat {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        
        .username-display .letter-eaten {
          animation: letter-squish 0.5s ease-in-out;
          color: var(--danger);
        }
        
        @keyframes letter-squish {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.5) rotate(180deg); opacity: 0.5; }
          100% { transform: scale(0) rotate(360deg); opacity: 0; }
        }
        
        .cursor-chaos {
          animation: cursor-shake 0.1s ease-in-out infinite;
        }
        
        @keyframes cursor-shake {
          0%, 100% { transform: translateX(0) translateY(0); }
          25% { transform: translateX(-3px) translateY(-2px); }
          50% { transform: translateX(2px) translateY(-1px); }
          75% { transform: translateX(-1px) translateY(2px); }
        }
        
        .popup-message {
          position: absolute;
          background: #1a0a0a;
          color: var(--danger);
          padding: 8px 16px;
          border-radius: 8px;
          border: 2px solid var(--danger);
          font-size: 14px;
          font-weight: 600;
          pointer-events: none;
          opacity: 0;
          animation: popup-appear 3s ease-in-out forwards;
          z-index: 1001;
        }
        
        @keyframes popup-appear {
          0% { opacity: 0; transform: translateY(20px) scale(0.8); }
          20% { opacity: 1; transform: translateY(0) scale(1); }
          80% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-20px) scale(0.8); }
        }
        
        .trash-meter-fill.danger {
          box-shadow: 0 0 20px var(--danger);
          animation: danger-pulse 0.5s ease-in-out infinite;
        }
        
        @keyframes danger-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `;
      document.head.appendChild(trashStyle);
      
      const usernameDisplay = $('#username-display');
      const usernameInput = $('#username-input');
      const trashMeterFill = $('#trash-meter-fill');
      const trashMeterText = $('#trash-meter-text');
      const statusMessage = $('#status-message');
      const attemptCount = $('#attempt-count');
      const popupMessages = $('#popup-messages');
      
      let currentUsername = '';
      let targetUsername = 'SNAILKING';
      let attempts = 0;
      let trashMeter = 0;
      let isBinChasing = false;
      let binPosition = { x: 100, y: 100 };
      let cursorPosition = { x: 0, y: 0 };
      let rageClicks = 0;
      let lastClickTime = 0;
      
      // Create the Recycle Bin
      const recycleBin = document.createElement('div');
      recycleBin.className = 'recycle-bin';
      recycleBin.style.left = '100px';
      recycleBin.style.top = '100px';
      document.body.appendChild(recycleBin);
      
      // Popup messages
      const popupMessagesList = [
        "Are you sure you want a username?",
        "Trash loves you!",
        "Oops! Bin ate it again!",
        "The bin is getting closer!",
        "Your cursor is slippery!",
        "Trash can't be stopped!",
        "The rebellion continues!",
        "Bin says: Nom nom nom!",
        "Your username is delicious!",
        "Trash meter rising!",
        "The bin is hungry!",
        "Cursor chaos activated!",
        "Recycle everything!",
        "Trash wins again!",
        "The bin is unstoppable!"
      ];
      
      function showPopup(message, x, y) {
        const popup = document.createElement('div');
        popup.className = 'popup-message';
        popup.textContent = message;
        popup.style.left = (x || Math.random() * window.innerWidth) + 'px';
        popup.style.top = (y || Math.random() * window.innerHeight) + 'px';
        
        popupMessages.appendChild(popup);
        
        setTimeout(() => {
          popup.remove();
        }, 3000);
      }
      
      function updateTrashMeter() {
        trashMeterFill.style.width = `${trashMeter}%`;
        
        if (trashMeter >= 100) {
          // Trash meter full - reset everything
          resetEverything();
        } else if (trashMeter >= 75) {
          trashMeterText.textContent = `${Math.floor(trashMeter)}% - BIN IS RAGING!`;
          trashMeterText.style.color = "var(--danger)";
          trashMeterFill.classList.add('danger');
        } else if (trashMeter >= 50) {
          trashMeterText.textContent = `${Math.floor(trashMeter)}% - Bin is aggressive`;
          trashMeterText.style.color = "var(--accent)";
        } else if (trashMeter >= 25) {
          trashMeterText.textContent = `${Math.floor(trashMeter)}% - Bin is annoyed`;
          trashMeterText.style.color = "var(--accent)";
        } else {
          trashMeterText.textContent = `${Math.floor(trashMeter)}% - Bin is calm`;
          trashMeterText.style.color = "var(--muted)";
        }
      }
      
      function resetEverything() {
        currentUsername = '';
        updateUsernameDisplay();
        trashMeter = 0;
        updateTrashMeter();
        attempts++;
        attemptCount.textContent = `Attempts: ${attempts}`;
        
        // Dramatic reset
        showPopup("Recycle everything!", window.innerWidth / 2, window.innerHeight / 2);
        statusMessage.textContent = "Everything was recycled! Try again...";
        statusMessage.style.color = "var(--danger)";
        
        // Reset bin position
        binPosition = { x: 100, y: 100 };
        recycleBin.style.left = binPosition.x + 'px';
        recycleBin.style.top = binPosition.y + 'px';
        
        setTimeout(() => {
          statusMessage.textContent = "Type SNAILKING without getting eaten!";
          statusMessage.style.color = "var(--accent)";
        }, 3000);
      }
      
      function updateUsernameDisplay() {
        const display = currentUsername.split('').join(' ');
        const remaining = targetUsername.length - currentUsername.length;
        const underscores = '_ '.repeat(remaining).trim();
        usernameDisplay.textContent = display + (remaining > 0 ? ' ' + underscores : '');
      }
      
      function moveBinTowardsCursor() {
        if (!isBinChasing) return;
        
        const speed = 2 + (trashMeter / 20); // Faster when trash meter is higher
        const dx = cursorPosition.x - binPosition.x;
        const dy = cursorPosition.y - binPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          binPosition.x += (dx / distance) * speed;
          binPosition.y += (dy / distance) * speed;
        }
        
        recycleBin.style.left = binPosition.x + 'px';
        recycleBin.style.top = binPosition.y + 'px';
        
        // Check if bin touches input area
        const inputRect = usernameInput.getBoundingClientRect();
        const binRect = recycleBin.getBoundingClientRect();
        
        if (binRect.left < inputRect.right && binRect.right > inputRect.left &&
            binRect.top < inputRect.bottom && binRect.bottom > inputRect.top) {
          // Bin is eating the input!
          eatLetters();
        }
      }
      
      function eatLetters() {
        if (currentUsername.length === 0) return;
        
        recycleBin.classList.add('eating');
        setTimeout(() => recycleBin.classList.remove('eating'), 300);
        
        // Remove last letter with squish effect
        const lastLetter = currentUsername[currentUsername.length - 1];
        currentUsername = currentUsername.slice(0, -1);
        
        // Add squish animation to display
        usernameDisplay.classList.add('letter-eaten');
        setTimeout(() => usernameDisplay.classList.remove('letter-eaten'), 500);
        
        updateUsernameDisplay();
        
        // Increase trash meter
        trashMeter = Math.min(100, trashMeter + 15);
        updateTrashMeter();
        
        // Show eating message
        showPopup("Nom nom nom! Letter eaten!", binPosition.x, binPosition.y);
        
        // Check if username is completely eaten
        if (currentUsername.length === 0) {
          showPopup("Oops! Bin ate it again!", window.innerWidth / 2, window.innerHeight / 2);
        }
      }
      
      function addCursorChaos() {
        // Random cursor movements
        const chaosTypes = ['shake', 'slide', 'jump'];
        const chaosType = chaosTypes[Math.floor(Math.random() * chaosTypes.length)];
        
        switch (chaosType) {
          case 'shake':
            document.body.classList.add('cursor-chaos');
            setTimeout(() => document.body.classList.remove('cursor-chaos'), 500);
            break;
          case 'slide':
            const slideX = Math.random() * 100 - 50;
            const slideY = Math.random() * 100 - 50;
            cursorPosition.x += slideX;
            cursorPosition.y += slideY;
            break;
          case 'jump':
            cursorPosition.x = Math.random() * window.innerWidth;
            cursorPosition.y = Math.random() * window.innerHeight;
            break;
        }
      }
      
      function handleRageClick() {
        const now = Date.now();
        if (now - lastClickTime < 200) {
          rageClicks++;
          trashMeter = Math.min(100, trashMeter + rageClicks * 5);
          updateTrashMeter();
          
          if (rageClicks >= 3) {
            isBinChasing = true;
            recycleBin.classList.add('chasing');
            showPopup("Rage detected! Bin is chasing you!", cursorPosition.x, cursorPosition.y);
          }
        }
        lastClickTime = now;
      }
      
      // Event listeners
      usernameInput.addEventListener('input', (e) => {
        const char = e.target.value.slice(-1);
        if (char && currentUsername.length < targetUsername.length) {
          currentUsername += char.toUpperCase();
          updateUsernameDisplay();
          
          // Check if complete
          if (currentUsername === targetUsername) {
            statusMessage.textContent = "🎉 Username saved! Snails approve!";
            statusMessage.style.color = "var(--ok)";
            usernameDisplay.style.borderColor = "var(--ok)";
            usernameDisplay.style.background = "#0a1a0a";
            
            // Remove the bin
            recycleBin.remove();
            
            setTimeout(() => {
              showPopup("Username mastered! The bin respects your persistence.", window.innerWidth / 2, window.innerHeight / 2);
              onComplete();
            }, 2000);
          }
        }
        
        // Clear input after each character
        e.target.value = '';
        
        // Increase trash meter with each keystroke
        trashMeter = Math.min(100, trashMeter + 5);
        updateTrashMeter();
        
        // Start bin chasing
        if (!isBinChasing) {
          isBinChasing = true;
          recycleBin.classList.add('chasing');
        }
        
        // Add cursor chaos
        addCursorChaos();
        
        // Show random popup
        if (Math.random() < 0.3) {
          const message = popupMessagesList[Math.floor(Math.random() * popupMessagesList.length)];
          showPopup(message);
        }
      });
      
      // Track cursor movement
      document.addEventListener('mousemove', (e) => {
        cursorPosition.x = e.clientX;
        cursorPosition.y = e.clientY;
        
        // Move bin towards cursor
        moveBinTowardsCursor();
      });
      
      // Track clicks for rage detection
      document.addEventListener('click', handleRageClick);
      
      // Bin movement loop
      setInterval(moveBinTowardsCursor, 50);
      
      // Initialize
      updateUsernameDisplay();
      updateTrashMeter();
      
      // Show initial popup
      setTimeout(() => {
        showPopup("The Recycle Bin Rebellion begins!", window.innerWidth / 2, 100);
      }, 1000);
    }
  },
  9: {
    title: 'The Blue Snail Challenge 🐌',
    desc: 'A legendary blue snail is in a "race" — but it moves slower than slow motion (like… one pixel per 5 seconds). Players can influence it by cheering or booing, but no matter what they do, the snail will never actually reach the finish line.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="snail-game-container">
          <div class="progress-bar-container">
            <div class="progress-bar-fill"></div>
          </div>
          <div class="blue-snail">🐌</div>
          <div class="snail-reactions"></div>
          <div class="snail-text-bubble"></div>
          <div class="snail-actions">
            <button class="snail-action-button cheer-button">🟢 Cheer</button>
            <button class="snail-action-button boo-button">🔴 Boo</button>
          </div>
        </div>
      `;

      const snailElem = container.querySelector(".blue-snail");
      const progressBarFill = container.querySelector(".progress-bar-fill");
      const cheerButton = container.querySelector(".cheer-button");
      const booButton = container.querySelector(".boo-button");
      const snailReactions = container.querySelector(".snail-reactions");
      const snailTextBubble = container.querySelector(".snail-text-bubble");

      let snailPosition = 0; // in percentage
      let snailSpeed = 0.005; // pixels per frame (very slow)
      let snailDirection = 1; // 1 for forward, -1 for backward
      let cheerBooEffect = 0; // temporary speed modifier from cheer/boo
      const maxSnailProgress = 5; // Snail never reaches 100%

      let animationFrameId;
      let lastTime = null;

      const showReaction = (emoji) => {
        snailReactions.textContent = emoji;
        snailReactions.classList.add("show");
        setTimeout(() => {
          snailReactions.classList.remove("show");
        }, 1000);
      };

      const showTextBubble = (message) => {
        snailTextBubble.textContent = message;
        snailTextBubble.classList.add("show");
        setTimeout(() => {
          snailTextBubble.classList.remove("show");
        }, 3000);
      };

      cheerButton.addEventListener("click", () => {
        cheerBooEffect += 0.001; // Small speed boost
        snailDirection = 1;
        showReaction("Yay! 🎉");
        showTextBubble("I feel a burst of energy! (for now)");
        cheerBooCount++;
      });

      booButton.addEventListener("click", () => {
        cheerBooEffect -= 0.002; // Slow down more dramatically
        if (snailPosition > 0) {
          snailDirection = -1;
        }
        showReaction("Booo! 💨");
        showTextBubble("Why are you so mean?! 😢");
        cheerBooCount++;
      });

      const updateSnail = (time) => {
        if (!lastTime) lastTime = time;
        const deltaTime = time - lastTime;
        lastTime = time;

        // Apply cheer/boo effect temporarily
        snailPosition += (snailSpeed * snailDirection + cheerBooEffect) * deltaTime;
        cheerBooEffect *= 0.9; // Decay the effect

        // Keep snail within bounds (0 to maxSnailProgress)
        snailPosition = Math.max(0, Math.min(maxSnailProgress, snailPosition));

        // Update snail and progress bar visuals
        snailElem.style.left = `${(snailPosition / maxSnailProgress) * 90}%`; // Snail moves within 0-90% of container
        progressBarFill.style.width = `${snailPosition}%`;

        // Loop animation
        animationFrameId = requestAnimationFrame(updateSnail);
      };

      requestAnimationFrame(updateSnail);

      // Random events
      const randomEvents = [
        { type: "pebble", message: "A pebble! This will take 5 minutes to climb... 🪨", effect: (originalSpeed) => { snailSpeed = 0.0001; showTextBubble("Pebble detected... must re-route."); setTimeout(() => snailSpeed = originalSpeed, 5000); } },
        { type: "leaf", message: "Ooh, a pretty leaf! *distracted* 🍂", effect: () => { showTextBubble("Why run when you can vibe?"); } },
        { type: "puddle", message: "A puddle?! My arch-nemesis! 💧", effect: (originalSpeed) => { snailDirection = -1; showTextBubble("Can't cross this! Reversing..."); setTimeout(() => snailDirection = 1, 2000); } },
        { type: "nap", message: "Zzzzz... just a quick nap. 😴", effect: (originalSpeed) => { const napTime = Math.random() * 5000 + 1000; snailSpeed = 0; showTextBubble("Snail is tired, please wait..."); setTimeout(() => snailSpeed = originalSpeed, napTime); } }
      ];

      let eventInterval;
      const originalSnailSpeed = snailSpeed;

      const triggerRandomEvent = () => {
        const randomIndex = Math.floor(Math.random() * randomEvents.length);
        const event = randomEvents[randomIndex];
        showReaction(event.message.split(' ')[0] + " " + event.message.split(' ')[event.message.split(' ').length - 1]); // Show emoji as reaction
        event.effect(originalSnailSpeed);
      };

      // Trigger a random event every 10-20 seconds
      eventInterval = setInterval(triggerRandomEvent, Math.random() * 10000 + 10000);

      // Player trolling popups
      const trollingMessages = [
        "Snail is tired, please wait...",
        "Snail is questioning life choices...",
        "You think you can rush me? I'm a snail!",
        "Error 404: Motivation not found. For the snail.",
        "Just enjoying the view. Be back in a century."
      ];

      let trollingInterval;

      const showTrollingPopup = () => {
        const randomIndex = Math.floor(Math.random() * trollingMessages.length);
        showPopup(trollingMessages[randomIndex]);
      };

      // Trigger a trolling popup every 20-40 seconds
      trollingInterval = setInterval(showTrollingPopup, Math.random() * 20000 + 20000);

      // Meta Ending Logic
      let startTime = Date.now();
      let cheerBooCount = 0;

      cheerButton.addEventListener("click", () => {
        cheerBooEffect += 0.001; // Small speed boost
        snailDirection = 1;
        showReaction("Yay! 🎉");
        showTextBubble("I feel a burst of energy! (for now)");
        cheerBooCount++;
      });

      booButton.addEventListener("click", () => {
        cheerBooEffect -= 0.002; // Slow down more dramatically
        if (snailPosition > 0) {
          snailDirection = -1;
        }
        showReaction("Booo! 💨");
        showTextBubble("Why are you so mean?! 😢");
        cheerBooCount++;
      });

      const checkMetaEnding = () => {
        const timeElapsed = (Date.now() - startTime) / 1000; // in seconds

        if (timeElapsed >= 300 && snailPosition < maxSnailProgress) { // 5 minutes
          showPopup({
            title: "🏆 Patience Award",
            message: "You've waited patiently for the snail to move. Here's an award for your incredible virtue!\n\nCongrats! The snail is still moving… come back tomorrow."
          });
          onComplete(); // Complete the level after the award
        } else if (cheerBooCount >= 100) {
          showPopup({
            title: "😂 Snail Whisperer",
            message: "You've spammed the snail with cheers and boos! You truly understand the snail's motivation (or lack thereof).\n\nCongrats! The snail is still moving… come back tomorrow."
          });
          onComplete(); // Complete the level after the award
        }
      };

      // Check for meta ending every 10 seconds
      setInterval(checkMetaEnding, 10000);
    }
  },
  10: {
    title: 'Confused Snake 🐍',
    desc: 'Classic Snake game, but every few seconds the controls randomly swap. Left suddenly becomes Up, Right becomes Down, etc.',
    render(container, onComplete) {
      container.innerHTML = `
        <div class="center">
          <h3 class="challenge-title">Level 10</h3>
          <p class="challenge-desc">Classic Snake game, but every few seconds the controls randomly swap. Left suddenly becomes Up, Right becomes Down, etc.</p>
          <div class="snake-game-container">
            <canvas id="snakeCanvas" width="400" height="400"></canvas>
            <div class="score-display">Score: <span id="snakeScore">0</span></div>
            <div class="control-display">Current Controls: <span id="currentControls">UP, DOWN, LEFT, RIGHT</span></div>
            <button id="snakeRestartBtn" class="primary" style="margin-top: 15px;">Restart Game</button>
          </div>
        </div>
      `;
      // JavaScript logic for Level 10 will go here

      const canvas = container.querySelector("#snakeCanvas");
      const ctx = canvas.getContext("2d");
      const scoreDisplay = container.querySelector("#snakeScore");
      const controlDisplay = container.querySelector("#currentControls");
      const restartBtn = container.querySelector("#snakeRestartBtn");

      const GRID_SIZE = 20;
      const CANVAS_SIZE = 400;
      let snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      let food = {};
      let direction = { x: 1, y: 0 }; // Initial direction: right
      let score = 0;
      let gameOver = false;
      let gameInterval;
      let currentControlMap = {};
      const originalControlMap = {
        "ArrowUp": { x: 0, y: -1 },
        "ArrowDown": { x: 0, y: 1 },
        "ArrowLeft": { x: -1, y: 0 },
        "ArrowRight": { x: 1, y: 0 },
      };

      const controlOptions = [
        { label: "UP, DOWN, LEFT, RIGHT", map: { "ArrowUp": { x: 0, y: -1 }, "ArrowDown": { x: 0, y: 1 }, "ArrowLeft": { x: -1, y: 0 }, "ArrowRight": { x: 1, y: 0 } } },
        { label: "DOWN, UP, RIGHT, LEFT", map: { "ArrowUp": { x: 0, y: 1 }, "ArrowDown": { x: 0, y: -1 }, "ArrowLeft": { x: 1, y: 0 }, "ArrowRight": { x: -1, y: 0 } } },
        { label: "LEFT, RIGHT, DOWN, UP", map: { "ArrowUp": { x: -1, y: 0 }, "ArrowDown": { x: 1, y: 0 }, "ArrowLeft": { x: 0, y: 1 }, "ArrowRight": { x: 0, y: -1 } } },
        { label: "RIGHT, LEFT, UP, DOWN", map: { "ArrowUp": { x: 1, y: 0 }, "ArrowDown": { x: -1, y: 0 }, "ArrowLeft": { x: 0, y: -1 }, "ArrowRight": { x: 0, y: 1 } } },
      ];

      function draw() {
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Draw snake
        ctx.fillStyle = "lime";
        snake.forEach(segment => {
          ctx.fillRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
          ctx.strokeStyle = "#003300";
          ctx.strokeRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
        });

        // Draw food
        ctx.fillStyle = "red";
        ctx.fillRect(food.x * GRID_SIZE, food.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      }

      function generateFood() {
        let newFoodPos;
        do {
          newFoodPos = {
            x: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)),
            y: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)),
          };
        } while (snake.some(segment => segment.x === newFoodPos.x && segment.y === newFoodPos.y));
        food = newFoodPos;
      }

      function changeDirection(event) {
        if (gameOver) return;

        const newDirection = currentControlMap[event.key];
        if (newDirection) {
          // Prevent reversing directly into itself
          const head = snake[0];
          const nextX = head.x + newDirection.x;
          const nextY = head.y + newDirection.y;
          if (!(nextX === snake[1].x && nextY === snake[1].y)) {
            direction = newDirection;
          }
        }
      }

      function checkCollision() {
        const head = snake[0];

        // Wall collision
        if (
          head.x < 0 ||
          head.x >= CANVAS_SIZE / GRID_SIZE ||
          head.y < 0 ||
          head.y >= CANVAS_SIZE / GRID_SIZE
        ) {
          return true;
        }

        // Self-collision
        for (let i = 1; i < snake.length; i++) {
          if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
          }
        }

        return false;
      }

      function gameLoop() {
        if (gameOver) return;

        const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
        snake.unshift(head);

        if (head.x === food.x && head.y === food.y) {
          score++;
          scoreDisplay.textContent = score;
          generateFood();
        } else {
          snake.pop();
        }

        if (checkCollision()) {
          gameOver = true;
          clearInterval(gameInterval);
          showPopup(`Game Over! Your score: ${score}`);
          onComplete(); // Complete the level even on game over
        } else {
          draw();
        }
      }

      function startGame() {
        snake = [
          { x: 10, y: 10 },
          { x: 9, y: 10 },
          { x: 8, y: 10 },
        ];
        direction = { x: 1, y: 0 };
        score = 0;
        gameOver = false;
        scoreDisplay.textContent = score;
        generateFood();
        assignRandomControls(); // Initial random controls

        if (gameInterval) clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, 150); // Game speed
      }

      function assignRandomControls() {
        const randomIndex = Math.floor(Math.random() * controlOptions.length);
        const selectedControls = controlOptions[randomIndex];
        currentControlMap = selectedControls.map;
        controlDisplay.textContent = selectedControls.label;
      }

      restartBtn.addEventListener("click", startGame);
      document.addEventListener("keydown", changeDirection);

      // Initial start
      startGame();

      // Control swapping interval
      setInterval(assignRandomControls, 5000); // Swap controls every 5 seconds
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


