let gameData = null;
let currentOfficialDay = 1;
let playingDay = null;

// Estado en LocalStorage
let savedState = JSON.parse(localStorage.getItem('horquillaState')) || {
  history: {}, 
  activeSession: null 
};

// Variables de partida
let currentIdx = 0, health = 100, lives = 3, isAnswered = false;
let totalDamage = 0;
let pendingHealthReset = false;

// Elementos DOM
const minSlider = document.getElementById('min-slider');
const maxSlider = document.getElementById('max-slider');
const sliderSelection = document.getElementById('slider-selection');
const targetNeedle = document.getElementById('target-needle');
const minValTxt = document.getElementById('min-val');
const maxValTxt = document.getElementById('max-val');
const costValTxt = document.getElementById('cost-val');
const actionBtn = document.getElementById('action-btn');
const feedbackTxt = document.getElementById('feedback-text');
const archiveView = document.getElementById('archive-view');
const gameView = document.getElementById('game-view');

// 1. Inicialización
fetch('datos.json')
  .then(response => response.json())
  .then(data => {
    gameData = data;
    const startDate = new Date(gameData.fecha_inicio + "T00:00:00").getTime();
    const today = new Date();
    today.setHours(0,0,0,0);
    const dayDiff = Math.floor((today.getTime() - startDate) / (1000 * 60 * 60 * 24));
    
    currentOfficialDay = Math.max(1, dayDiff + 1);
    renderArchive();
  });

document.getElementById('btn-archive').addEventListener('click', () => {
  archiveView.classList.add('show');
  gameView.classList.add('hidden');
  renderArchive();
});

// 2. Archivo
function renderArchive() {
  const grid = document.getElementById('days-grid');
  grid.innerHTML = '';

  for (let i = 1; i <= currentOfficialDay; i++) {
    const btn = document.createElement('button');
    btn.className = 'day-btn';
    
    const dataExists = gameData.retos.find(r => r.dia === i);
    
    if (!dataExists) {
      btn.innerHTML = `DÍA ${i}<br><span style="font-size: 1rem; color:#aaa">PRÓX.</span>`;
      btn.disabled = true;
    } else {
      const historyRecord = savedState.history[i];
      if (historyRecord) {
        btn.innerHTML = `DÍA ${i}<br><span style="font-size: 1rem;">${historyRecord.status === 'won' ? 'GANADO' : 'PERDIDO'}</span>`;
        btn.classList.add(historyRecord.status);
        btn.disabled = true; 
      } else if (savedState.activeSession && savedState.activeSession.dia === i) {
        btn.innerHTML = `DÍA ${i}<br><span style="font-size: 1rem;">SEGUIR</span>`;
        btn.classList.add('resume');
        btn.onclick = () => startGame(i, true);
      } else {
        btn.innerHTML = `DÍA ${i}<br><span style="font-size: 1rem;">JUGAR</span>`;
        btn.onclick = () => startGame(i, false);
      }
    }
    grid.appendChild(btn);
  }
}

// 3. Control de Partida
function startGame(diaId, isResume) {
  playingDay = gameData.retos.find(r => r.dia === diaId);
  
  if (isResume) {
    currentIdx = savedState.activeSession.qIdx;
    health = savedState.activeSession.health;
    lives = savedState.activeSession.lives;
    totalDamage = savedState.activeSession.totalDamage || 0;
    pendingHealthReset = savedState.activeSession.pendingHealthReset || false;
  } else {
    currentIdx = 0;
    health = 100;
    lives = 3;
    totalDamage = 0;
    pendingHealthReset = false;
    savedState.activeSession = { dia: diaId, qIdx: 0, health: 100, lives: 3, totalDamage: 0, pendingHealthReset: false };
    saveStateToLocal();
  }

  document.getElementById('day-badge').textContent = `DÍA ${diaId}`;
  
  if (pendingHealthReset) applyHealthReset(); 
  else updateHealthUI();

  document.getElementById('lives-display').textContent = '❤️'.repeat(lives) + '🖤'.repeat(3-lives);

  archiveView.classList.remove('show');
  gameView.classList.remove('hidden');
  
  loadQuestion(currentIdx);
}

function applyHealthReset() {
  health = 100;
  pendingHealthReset = false;
  updateHealthUI();
}

function updateHealthUI() {
  document.getElementById('health-fill').style.width = Math.max(0, health) + '%';
  document.getElementById('health-text').textContent = Math.max(0, health) + '%';
}

function loadQuestion(idx) {
  const q = playingDay.preguntas[idx];
  document.getElementById('question-number').textContent = `PREGUNTA ${idx + 1} / ${playingDay.preguntas.length}`;
  document.getElementById('question-text').textContent = q.texto;

  minSlider.min = q.min; minSlider.max = q.max; minSlider.value = q.min;
  maxSlider.min = q.min; maxSlider.max = q.max; maxSlider.value = q.max;

  targetNeedle.classList.remove('anim-drop');
  targetNeedle.style.display = 'none';
  feedbackTxt.innerHTML = '';
  feedbackTxt.className = 'feedback';
  
  isAnswered = false;
  actionBtn.textContent = 'CONFIRMAR HORQUILLA';
  actionBtn.style.background = 'var(--accent)';
  actionBtn.style.color = '#000';
  actionBtn.disabled = false;
  
  // SOLUCIÓN AL BUG: Usamos disabled en lugar de pointerEvents
  minSlider.disabled = false;
  maxSlider.disabled = false;
  
  minSlider.style.zIndex = 5;
  maxSlider.style.zIndex = 5;

  updateSliders();
}

// Control Z-index Dinámico (El que tocas se pone delante)
minSlider.addEventListener('input', (e) => {
  minSlider.style.zIndex = 10; maxSlider.style.zIndex = 5;
  updateSliders();
});
maxSlider.addEventListener('input', (e) => {
  maxSlider.style.zIndex = 10; minSlider.style.zIndex = 5;
  updateSliders();
});

function updateSliders() {
  let minVal = parseInt(minSlider.value);
  let maxVal = parseInt(maxSlider.value);

  if (minVal > maxVal) {
    if (document.activeElement === minSlider) minSlider.value = maxVal;
    else maxSlider.value = minVal;
    minVal = parseInt(minSlider.value);
    maxVal = parseInt(maxSlider.value);
  }

  const q = playingDay.preguntas[currentIdx];
  const range = q.max - q.min;
  const minPercent = ((minVal - q.min) / range) * 100;
  const maxPercent = ((maxVal - q.min) / range) * 100;
  const costPercent = Math.round(maxPercent - minPercent);

  sliderSelection.style.left = minPercent + '%';
  sliderSelection.style.width = costPercent + '%';
  minValTxt.textContent = `${minVal} ${q.unidad}`;
  maxValTxt.textContent = `${maxVal} ${q.unidad}`;
  
  costValTxt.textContent = `COSTE: ${costPercent}%`;
  
  if (costPercent >= health) {
    costValTxt.style.color = 'var(--danger)';
    costValTxt.style.borderColor = 'var(--danger)';
  } else {
    costValTxt.style.color = '#fff';
    costValTxt.style.borderColor = 'var(--accent)';
  }
}

function handleAction() {
  if (!isAnswered) {
    const q = playingDay.preguntas[currentIdx];
    const userMin = parseInt(minSlider.value);
    const userMax = parseInt(maxSlider.value);
    const range = q.max - q.min;
    const costPercent = Math.round(((userMax - userMin) / range) * 100);
    const targetPercent = ((q.respuesta - q.min) / range) * 100;

    // SOLUCIÓN AL BUG: Bloquear el input de forma nativa
    minSlider.disabled = true;
    maxSlider.disabled = true;

    targetNeedle.style.left = targetPercent + '%';
    targetNeedle.classList.add('anim-drop');

    totalDamage += costPercent;
    health -= costPercent;
    
    const isCorrect = q.respuesta >= userMin && q.respuesta <= userMax;

    if (!isCorrect || health <= 0) {
      lives--;
      pendingHealthReset = true;
      
      if (!isCorrect) feedbackTxt.innerHTML = `¡FALLO!<br>ERA ${q.respuesta}.`;
      else feedbackTxt.innerHTML = `¡SIN SALUD!<br>ERA ${q.respuesta}.`;
      
      feedbackTxt.classList.add('show', 'error');
    } else {
      feedbackTxt.innerHTML = `¡CORRECTO!<br>ERA ${q.respuesta}.`;
      feedbackTxt.classList.add('show', 'success');
    }

    updateHealthUI();
    document.getElementById('lives-display').textContent = '❤️'.repeat(lives) + '🖤'.repeat(3-lives);

    isAnswered = true;
    
    savedState.activeSession.health = health;
    savedState.activeSession.lives = lives;
    savedState.activeSession.totalDamage = totalDamage;
    savedState.activeSession.pendingHealthReset = pendingHealthReset;

    if (lives <= 0) {
      actionBtn.textContent = 'FIN DEL JUEGO (GAME OVER)';
      actionBtn.style.background = 'var(--danger)';
      actionBtn.style.color = '#fff';
      endGame('lost');
    } else if (currentIdx < playingDay.preguntas.length - 1) {
      actionBtn.textContent = 'SIGUIENTE PREGUNTA';
      savedState.activeSession.qIdx = currentIdx + 1;
      saveStateToLocal();
    } else {
      actionBtn.textContent = '¡NIVEL SUPERADO!';
      actionBtn.style.background = 'var(--success)';
      endGame('won');
    }
  } else {
    currentIdx++;
    if (pendingHealthReset) applyHealthReset();
    loadQuestion(currentIdx);
  }
}

function endGame(status) {
  if (status === 'won') {
    feedbackTxt.innerHTML = `¡VICTORIA!<br>DAÑO RECIBIDO: ${totalDamage}%`;
    feedbackTxt.classList.replace('error', 'success');
  }

  savedState.history[playingDay.dia] = { status: status, totalDamage: totalDamage };
  savedState.activeSession = null;
  saveStateToLocal();
  
  setTimeout(() => {
    gameView.classList.add('hidden');
    archiveView.classList.add('show');
    renderArchive();
  }, 4000); 
}

function saveStateToLocal() { localStorage.setItem('horquillaState', JSON.stringify(savedState)); }

actionBtn.addEventListener('click', handleAction);