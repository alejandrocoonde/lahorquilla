let gameData = null;
let currentOfficialDay = 1;
let playingDay = null;

// Estado en LocalStorage
let savedState = JSON.parse(localStorage.getItem('horquillaState')) || {
  history: {}, 
  activeSession: null 
};

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
      btn.innerHTML = `Día ${i}<br><span>Próximamente</span>`;
      btn.disabled = true;
    } else {
      const historyRecord = savedState.history[i];
      if (historyRecord) {
        btn.innerHTML = `Día ${i}<br><span>${historyRecord.status === 'won' ? 'Superado' : 'Fallado'}</span>`;
        btn.classList.add(historyRecord.status);
        btn.disabled = true; 
      } else if (savedState.activeSession && savedState.activeSession.dia === i) {
        btn.innerHTML = `Día ${i}<br><span>Continuar</span>`;
        btn.classList.add('resume');
        btn.onclick = () => startGame(i, true);
      } else {
        btn.innerHTML = `Día ${i}<br><span>Jugar</span>`;
        btn.onclick = () => startGame(i, false);
      }
    }
    grid.appendChild(btn);
  }
}

// 3. Control de Partida
let currentIdx = 0, health = 100, lives = 3, isAnswered = false;

function startGame(diaId, isResume) {
  playingDay = gameData.retos.find(r => r.dia === diaId);
  
  if (isResume) {
    currentIdx = savedState.activeSession.qIdx;
    health = savedState.activeSession.health;
    lives = savedState.activeSession.lives;
  } else {
    currentIdx = 0;
    health = 100;
    lives = 3;
    savedState.activeSession = { dia: diaId, qIdx: 0, health: 100, lives: 3 };
    saveStateToLocal();
  }

  document.getElementById('day-badge').textContent = `#Día ${diaId}`;
  document.getElementById('health-fill').style.width = health + '%';
  document.getElementById('health-text').textContent = health + '%';
  document.getElementById('lives-display').textContent = '❤️'.repeat(lives) + '🖤'.repeat(3-lives);

  archiveView.classList.remove('show');
  gameView.classList.remove('hidden');
  
  loadQuestion(currentIdx);
}

function loadQuestion(idx) {
  const q = playingDay.preguntas[idx];
  document.getElementById('question-number').textContent = `Pregunta ${idx + 1} de ${playingDay.preguntas.length}`;
  document.getElementById('question-text').textContent = q.texto;

  minSlider.min = q.min; minSlider.max = q.max; minSlider.value = q.min;
  maxSlider.min = q.min; maxSlider.max = q.max; maxSlider.value = q.max;

  targetNeedle.classList.remove('anim-drop');
  targetNeedle.style.display = 'none';
  sliderSelection.classList.remove('pulse-success', 'pulse-error');
  feedbackTxt.textContent = '';
  feedbackTxt.className = 'feedback';
  
  isAnswered = false;
  actionBtn.textContent = 'Confirmar Horquilla';
  actionBtn.style.background = 'var(--text)';
  actionBtn.disabled = false;
  
  minSlider.style.pointerEvents = 'auto';
  maxSlider.style.pointerEvents = 'auto';

  updateSliders();
}

function updateSliders() {
  let minVal = parseInt(minSlider.value);
  let maxVal = parseInt(maxSlider.value);

  if (minVal > maxVal) {
    if (event && event.target === minSlider) minSlider.value = maxVal;
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
  
  costValTxt.textContent = `Coste: ${costPercent}%`;
  costValTxt.style.color = costPercent > health ? 'var(--danger)' : 'var(--text-muted)';
}

function handleAction() {
  if (!isAnswered) {
    const q = playingDay.preguntas[currentIdx];
    const userMin = parseInt(minSlider.value);
    const userMax = parseInt(maxSlider.value);
    const range = q.max - q.min;
    const costPercent = Math.round(((userMax - userMin) / range) * 100);
    const targetPercent = ((q.respuesta - q.min) / range) * 100;

    if (costPercent > health) {
      feedbackTxt.textContent = "No tienes suficiente salud.";
      feedbackTxt.classList.add('show', 'error');
      setTimeout(() => feedbackTxt.classList.remove('show'), 2000);
      return;
    }

    minSlider.style.pointerEvents = 'none';
    maxSlider.style.pointerEvents = 'none';

    targetNeedle.style.left = targetPercent + '%';
    targetNeedle.classList.add('anim-drop');

    health = Math.max(0, health - costPercent);
    document.getElementById('health-fill').style.width = health + '%';
    document.getElementById('health-text').textContent = health + '%';

    const isCorrect = q.respuesta >= userMin && q.respuesta <= userMax;

    if (isCorrect) {
      sliderSelection.classList.add('pulse-success');
      feedbackTxt.textContent = `¡Correcto! Era ${q.respuesta}.`;
      feedbackTxt.classList.add('show', 'success');
    } else {
      sliderSelection.classList.add('pulse-error');
      lives--;
      document.getElementById('lives-display').textContent = '❤️'.repeat(lives) + '🖤'.repeat(3-lives);
      feedbackTxt.textContent = `¡Fallaste! Era ${q.respuesta}.`;
      feedbackTxt.classList.add('show', 'error');
    }

    isAnswered = true;
    savedState.activeSession.health = health;
    savedState.activeSession.lives = lives;

    if (lives <= 0 || health <= 0) {
      actionBtn.textContent = 'Fin del Juego - Has Perdido';
      actionBtn.disabled = true;
      endGame('lost');
    } else if (currentIdx < playingDay.preguntas.length - 1) {
      actionBtn.textContent = 'Siguiente Pregunta';
      savedState.activeSession.qIdx = currentIdx + 1;
      saveStateToLocal();
    } else {
      actionBtn.textContent = '¡Nivel Superado!';
      actionBtn.style.background = 'var(--success)';
      actionBtn.disabled = true;
      endGame('won');
    }
  } else {
    currentIdx++;
    loadQuestion(currentIdx);
  }
}

function endGame(status) {
  savedState.history[playingDay.dia] = { status: status, healthLeft: health, livesLeft: lives };
  savedState.activeSession = null;
  saveStateToLocal();
  
  setTimeout(() => {
    gameView.classList.add('hidden');
    archiveView.classList.add('show');
    renderArchive();
  }, 2500);
}

function saveStateToLocal() { localStorage.setItem('horquillaState', JSON.stringify(savedState)); }

minSlider.addEventListener('input', updateSliders);
maxSlider.addEventListener('input', updateSliders);
actionBtn.addEventListener('click', handleAction);