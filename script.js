let gameData = null;
let currentOfficialDay = 1;
let playingDay = null;
let currentStreak = 0;
let currentReviewDay = null; 

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

// Vistas
const archiveView = document.getElementById('archive-view');
const gameView = document.getElementById('game-view');
const reviewView = document.getElementById('review-view');
const statsView = document.getElementById('stats-view');

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
    calculateStreak();
    renderArchive();
    initCountdown();
  });

function initCountdown() {
  function updateTimer() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diff = tomorrow - now;
    const hours = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0');
    const minutes = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, '0');
    const seconds = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');
    
    const timerEl = document.getElementById('countdown-timer');
    if (timerEl) timerEl.textContent = `${hours}:${minutes}:${seconds}`;
  }
  updateTimer();
  setInterval(updateTimer, 1000);
}

function calculateStreak() {
  currentStreak = 0;
  for (let i = currentOfficialDay; i >= 1; i--) {
    const record = savedState.history[i];
    if (record) {
      currentStreak++;
    } else if (i === currentOfficialDay && !record) {
      continue; 
    } else {
      break;
    }
  }
  document.getElementById('menu-streak').textContent = currentStreak;
  document.getElementById('game-streak-text').textContent = currentStreak;
}

// Navegación de Vistas y Botones
document.getElementById('btn-archive').addEventListener('click', () => {
  archiveView.classList.add('show');
  gameView.classList.add('hidden');
  reviewView.classList.add('hidden');
  statsView.classList.add('hidden');
  calculateStreak();
  renderArchive();
});

document.getElementById('btn-back-archive').addEventListener('click', () => {
  reviewView.classList.remove('show');
  reviewView.classList.add('hidden');
  archiveView.classList.add('show');
});

// Desplegar/Ocultar Archivo
document.getElementById('btn-show-archive').addEventListener('click', () => {
  const fullSection = document.getElementById('full-archive-section');
  fullSection.classList.add('show-archive');
  fullSection.scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('btn-close-archive').addEventListener('click', () => {
  document.getElementById('full-archive-section').classList.remove('show-archive');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Modal de Estadísticas
document.getElementById('btn-stats').addEventListener('click', () => {
  calcularEstadisticasGlobales();
  archiveView.classList.remove('show');
  statsView.classList.remove('hidden');
  statsView.classList.add('show');
});

document.getElementById('btn-close-stats').addEventListener('click', () => {
  statsView.classList.remove('show');
  statsView.classList.add('hidden');
  archiveView.classList.add('show');
});

function calcularEstadisticasGlobales() {
  const historyKeys = Object.keys(savedState.history);
  const played = historyKeys.length;
  let won = 0;
  
  historyKeys.forEach(k => {
    if (savedState.history[k].status === 'won') won++;
  });

  const winrate = played > 0 ? Math.round((won / played) * 100) : 0;

  document.getElementById('stat-played').textContent = played;
  document.getElementById('stat-won').textContent = won;
  document.getElementById('stat-winrate').textContent = winrate + '%';
  document.getElementById('stat-streak').textContent = currentStreak;
}

// COMPARTIR RESULTADO
document.getElementById('btn-share').addEventListener('click', () => {
  const record = savedState.history[currentReviewDay];
  const dayData = gameData.retos.find(r => r.dia === currentReviewDay);
  
  let text = `LA HORQUILLA - Día ${currentReviewDay} ${record.status === 'won' ? '🏆' : '💀'}\n`;
  text += `🔥 Racha: ${currentStreak}\n\n`;
  
  let errors = 0;
  for (let i = 0; i < dayData.preguntas.length; i++) {
    text += `${i+1}. `;
    if (record.answers && record.answers[i]) {
      if (record.answers[i].correct) {
        text += '🟩';
      } else {
        text += '🟥';
        errors++;
      }
    } else {
      text += '⬛'; 
    }
    text += '\n';
  }
  
  if (record.status === 'won') {
    text += `\nDaño: ${record.totalDamage}%`;
  }
  
  const livesLeft = record.status === 'won' ? Math.max(0, 3 - errors) : 0;
  text += `\nVidas: ${'❤️'.repeat(livesLeft) + '🖤'.repeat(3 - livesLeft)}\n`;
  text += `\nJuega en: https://alejandrocoonde.github.io/lahorquilla/`;

  navigator.clipboard.writeText(text).then(() => {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }).catch(() => {
    alert("Error al copiar al portapapeles.");
  });
});

// Renderizar Cuadrículas (Reto actual + Archivo)
function renderArchive() {
  const currentWeekGrid = document.getElementById('current-week-grid');
  const fullDaysGrid = document.getElementById('full-days-grid');
  currentWeekGrid.innerHTML = '';
  fullDaysGrid.innerHTML = '';

  // 1. Grid del Reto Actual: Día de hoy y los 7 siguientes (8 botones en total)
  for (let i = currentOfficialDay; i < currentOfficialDay + 8; i++) {
    currentWeekGrid.appendChild(createDayButton(i));
  }

  // 2. Grid del Archivo: Día 1 hasta el Día de hoy
  for (let i = 1; i <= currentOfficialDay; i++) {
    fullDaysGrid.appendChild(createDayButton(i));
  }
}

// Función auxiliar para fabricar cada botón según su estado
function createDayButton(i) {
  const btn = document.createElement('button');
  btn.className = 'day-btn';
  
  const dataExists = gameData.retos.find(r => r.dia === i);
  
  if (i > currentOfficialDay) {
    if (dataExists) {
      btn.innerHTML = `DÍA ${i}<br><span style="font-size: 1rem; color:#aaa">PRÓX.</span>`;
    } else {
      btn.innerHTML = `DÍA ${i}<br><span style="font-size: 1rem; color:#aaa">EN OBRAS</span>`;
    }
    btn.disabled = true;
  } else if (!dataExists) {
    btn.innerHTML = `DÍA ${i}<br><span style="font-size: 1rem; color:#aaa">EN OBRAS</span>`;
    btn.disabled = true;
  } else {
    const historyRecord = savedState.history[i];
    if (historyRecord) {
      btn.innerHTML = `DÍA ${i}<br><span style="font-size: 1rem;">VER RESUMEN</span>`;
      btn.classList.add(historyRecord.status);
      btn.onclick = () => showReview(i);
    } else if (savedState.activeSession && savedState.activeSession.dia === i) {
      btn.innerHTML = `DÍA ${i}<br><span style="font-size: 1rem;">SEGUIR</span>`;
      btn.classList.add('resume');
      btn.onclick = () => startGame(i, true);
    } else {
      btn.innerHTML = `DÍA ${i}<br><span style="font-size: 1rem;">JUGAR</span>`;
      btn.onclick = () => startGame(i, false);
    }
  }
  return btn;
}

// 3. Revisión de Partida
function showReview(diaId) {
  currentReviewDay = diaId; 
  const record = savedState.history[diaId];
  const dayData = gameData.retos.find(r => r.dia === diaId); 
  
  document.getElementById('review-title').textContent = `REVISIÓN DÍA ${diaId} - ${record.status === 'won' ? 'VICTORIA' : 'DERROTA'}`;
  const content = document.getElementById('review-content');
  content.innerHTML = '';
  
  if (record.answers && record.answers.length > 0) {
    dayData.preguntas.forEach((q, i) => {
      const ans = record.answers[i]; 
      const div = document.createElement('div');
      
      if (ans) {
        div.className = `review-item ${ans.correct ? 'correct' : 'incorrect'}`;
        div.innerHTML = `
          <div class="review-q">${i+1}. ${ans.q}</div>
          <div class="review-a ${ans.correct ? '' : 'failed'}">Respuesta real: ${ans.resp} ${ans.unidad}</div>
          <div class="review-u">Tu horquilla: ${ans.min} - ${ans.max}</div>
        `;
      } else {
        div.className = `review-item unanswered`;
        div.innerHTML = `
          <div class="review-q" style="color: var(--text-muted);">${i+1}. ${q.texto}</div>
          <div class="review-a" style="color: var(--text-muted);">Respuesta real: ${q.respuesta} ${q.unidad}</div>
          <div class="review-u" style="color: var(--text-muted);">[NO ALCANZADA]</div>
        `;
      }
      content.appendChild(div);
    });
  } else {
    content.innerHTML = '<p>Datos no disponibles.</p>';
  }

  archiveView.classList.remove('show');
  reviewView.classList.remove('hidden');
  reviewView.classList.add('show');
}

// 4. Control de Partida
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
    savedState.activeSession = { dia: diaId, qIdx: 0, health: 100, lives: 3, totalDamage: 0, pendingHealthReset: false, answers: [] };
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
  
  minSlider.disabled = false;
  maxSlider.disabled = false;
  minSlider.style.zIndex = 5;
  maxSlider.style.zIndex = 5;

  updateSliders();
}

minSlider.addEventListener('input', () => { minSlider.style.zIndex = 10; maxSlider.style.zIndex = 5; updateSliders(); });
maxSlider.addEventListener('input', () => { maxSlider.style.zIndex = 10; minSlider.style.zIndex = 5; updateSliders(); });

function updateSliders() {
  let minVal = parseInt(minSlider.value, 10);
  let maxVal = parseInt(maxSlider.value, 10);

  if (minVal > maxVal) {
    if (document.activeElement === minSlider) minSlider.value = maxVal;
    else maxSlider.value = minVal;
    minVal = parseInt(minSlider.value, 10);
    maxVal = parseInt(maxSlider.value, 10);
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
    const userMin = parseInt(minSlider.value, 10);
    const userMax = parseInt(maxSlider.value, 10);
    const range = q.max - q.min;
    const costPercent = Math.round(((userMax - userMin) / range) * 100);
    const targetPercent = ((q.respuesta - q.min) / range) * 100;

    minSlider.disabled = true;
    maxSlider.disabled = true;

    targetNeedle.style.left = targetPercent + '%';
    targetNeedle.classList.add('anim-drop');

    totalDamage += costPercent;
    health -= costPercent;
    
    // Aquí validamos matemáticamente de forma segura (>= y <= incluyen los extremos 100%)
    const isCorrect = q.respuesta >= userMin && q.respuesta <= userMax;

    savedState.activeSession.answers.push({
      q: q.texto,
      min: userMin,
      max: userMax,
      resp: q.respuesta,
      unidad: q.unidad,
      correct: (isCorrect && health > 0)
    });

    const cardBox = document.getElementById('question-card-box');

    if (!isCorrect || health <= 0) {
      lives--;
      pendingHealthReset = true;
      
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      cardBox.classList.add('screen-shake');
      setTimeout(() => cardBox.classList.remove('screen-shake'), 400);

      if (!isCorrect) feedbackTxt.innerHTML = `¡FALLO!<br>ERA ${q.respuesta}.`;
      else feedbackTxt.innerHTML = `¡SIN SALUD!<br>ERA ${q.respuesta}.`;
      
      feedbackTxt.classList.add('show', 'error');
    } else {
      cardBox.classList.add('flash-success');
      setTimeout(() => cardBox.classList.remove('flash-success'), 500);

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
      actionBtn.disabled = true;
      endGame('lost');
    } else if (currentIdx < playingDay.preguntas.length - 1) {
      actionBtn.textContent = 'SIGUIENTE PREGUNTA';
      savedState.activeSession.qIdx = currentIdx + 1;
      saveStateToLocal();
    } else {
      actionBtn.textContent = '¡NIVEL SUPERADO!';
      actionBtn.style.background = 'var(--success)';
      actionBtn.disabled = true;
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
  } else {
    feedbackTxt.innerHTML += `<br><span style="font-size: 1.2rem; color: #fff;">Saliendo al menú...</span>`;
  }

  savedState.history[playingDay.dia] = { 
    status: status, 
    totalDamage: totalDamage,
    answers: savedState.activeSession.answers 
  };
  
  savedState.activeSession = null;
  saveStateToLocal();
  calculateStreak();
  
  setTimeout(() => {
    gameView.classList.add('hidden');
    archiveView.classList.add('show');
    renderArchive();
  }, 4000); 
}

function saveStateToLocal() { localStorage.setItem('horquillaState', JSON.stringify(savedState)); }

actionBtn.addEventListener('click', handleAction);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('Service Worker registrado correctamente.'))
      .catch((err) => console.log('Fallo al registrar el Service Worker:', err));
  });
}
