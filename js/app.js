/* app.js – Main Application */
import { initRouter } from './router.js';
import * as storage from './storage.js';
import * as engine from './engine.js';
import * as cert from './cert.js';
import * as ui from './ui.js';

let CONFIG = {};
let SKILLS = [];
let TEXTS = [];
let currentGame = null;
let dataLoaded = false;

/* ============================== */
/*         DATA LOADING           */
/* ============================== */
async function loadData() {
  try {
    const [cfgRes, skillsRes, textsRes] = await Promise.all([
      fetch('data/config.json'),
      fetch('data/skills.json'),
      fetch('data/texts.json')
    ]);
    if (!cfgRes.ok || !textsRes.ok) throw new Error('فشل تحميل البيانات');
    CONFIG = await cfgRes.json();
    const skillsData = await skillsRes.json();
    SKILLS = skillsData.skills || [];
    const textsData = await textsRes.json();
    TEXTS = textsData.texts || [];
    if (TEXTS.length === 0) throw new Error('لا توجد نصوص');
    dataLoaded = true;
  } catch (e) {
    dataLoaded = false;
    document.getElementById('main-content').innerHTML = `
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:3rem;margin-bottom:16px">⚠️</div>
        <h2 style="color:#EF4444;margin-bottom:12px">خطأ في تحميل البيانات</h2>
        <p style="color:#6B7280;max-width:400px;margin:0 auto">${e.message || 'تأكد من وجود ملفات البيانات في المجلد الصحيح (data/).'}</p>
        <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;background:#0D6EFD;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:1rem">إعادة المحاولة</button>
      </div>`;
  }
}

/* ============================== */
/*         BRANDING               */
/* ============================== */
function applyBranding() {
  const el = (id) => document.getElementById(id);
  const slogan = CONFIG.slogans?.primary || 'أبطال القراءة: من نصٍّ إلى إنجاز';
  if (el('hero-slogan')) el('hero-slogan').textContent = slogan;
  if (el('footer-rights')) el('footer-rights').textContent = CONFIG.rights_text || '';

  // Show school name in header and hero
  const schoolName = CONFIG.school_name || '';
  if (el('header-school-name')) el('header-school-name').textContent = schoolName;
  if (el('hero-school-label')) el('hero-school-label').textContent = schoolName;

  if (CONFIG.theme_colors) {
    const r = document.documentElement;
    Object.entries(CONFIG.theme_colors).forEach(([k, v]) => r.style.setProperty('--' + k.replace(/_/g, '-'), v));
  }
}

function updateHeaderXP() {
  const p = storage.getProgress();
  const xpEl = document.getElementById('header-xp-val');
  const lvlEl = document.getElementById('header-level');
  if (xpEl) xpEl.textContent = p.xp;
  if (lvlEl) lvlEl.textContent = 'مستوى ' + p.level;
}

/* ============================== */
/*         PAGES                  */
/* ============================== */
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.getAttribute('data-page') === pageId);
  });
  // Show/hide nav during play
  const nav = document.getElementById('bottom-nav');
  const header = document.getElementById('main-header');
  if (pageId === 'play') {
    if (nav) nav.style.display = 'none';
  } else {
    if (nav) nav.style.display = '';
  }
  window.scrollTo(0, 0);
}

/* ============================== */
/*         HOME PAGE              */
/* ============================== */
function renderHome() {
  const stats = document.getElementById('hero-stats');
  if (!stats) return;
  const totalQ = TEXTS.reduce((sum, t) => sum + (t.questions?.length || 0), 0);
  stats.innerHTML = `
    <div class="hero-stat"><span class="stat-val">${TEXTS.length}</span><span class="stat-label">نص قرائي</span></div>
    <div class="hero-stat"><span class="stat-val">${totalQ}</span><span class="stat-label">سؤال</span></div>
    <div class="hero-stat"><span class="stat-val">15</span><span class="stat-label">مهارة</span></div>
  `;
  // Daily tip
  const tip = engine.getDailyTip(CONFIG.tips);
  const tipEl = document.getElementById('daily-tip-text');
  if (tipEl && tip) tipEl.textContent = tip;
}

/* ============================== */
/*         DASHBOARD              */
/* ============================== */
function renderDashboard() {
  const profile = storage.getProfile();
  if (!profile) { window.location.hash = '#home'; return; }
  const progress = storage.getProgress();
  const skills = storage.getSkillData();
  const daily = storage.getDailyData();
  const avgPct = progress.totalAnswered > 0 ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100) : 0;

  // Welcome bar
  const dw = document.getElementById('dash-welcome');
  if (dw) dw.innerHTML = `
    <div class="dash-welcome-inner">
      <div class="dw-hello">
        <h2>مرحبًا ${profile.name} 👋</h2>
        <p>${CONFIG.slogans?.secondary || 'نقرأ لنفهم… نفهم لنتميز'}</p>
      </div>
      <div class="dw-stats">
        <div class="dw-stat"><span class="dw-stat-val">⭐ ${progress.xp}</span><span class="dw-stat-lbl">XP</span></div>
        <div class="dw-stat"><span class="dw-stat-val">🏅 ${progress.level}</span><span class="dw-stat-lbl">المستوى</span></div>
      </div>
    </div>`;

  // Daily tip
  const tip = engine.getDailyTip(CONFIG.tips);
  const tipDash = document.getElementById('dash-tip');
  if (tipDash && tip) tipDash.innerHTML = `<div class="tip-card"><span class="tip-icon">💡</span><div><strong>نصيحة اليوم</strong><p>${tip}</p></div></div>`;

  // Streak
  const streakEl = document.getElementById('streak-display');
  if (streakEl) streakEl.textContent = daily.streak > 0 ? '🔥 ' + daily.streak + ' يوم' : 'ابدأ سلسلتك!';

  // Progress stats
  const dpEl = document.getElementById('dash-progress');
  if (dpEl) {
    dpEl.innerHTML = `
      <div class="ds-card"><span class="ds-val" style="color:var(--primary)">${progress.textsCompleted}</span><span class="ds-lbl">نص مُكتمل</span></div>
      <div class="ds-card"><span class="ds-val" style="color:${ui.getScoreColor(avgPct)}">${avgPct}%</span><span class="ds-lbl">المعدل العام</span></div>
      <div class="ds-card"><span class="ds-val" style="color:var(--success)">${progress.totalCorrect}</span><span class="ds-lbl">إجابة صحيحة</span></div>
      <div class="ds-card"><span class="ds-val" style="color:var(--gold)">${daily.streak}</span><span class="ds-lbl">سلسلة أيام</span></div>
    `;
  }

  // Weakest 3 skills
  const weakEl = document.getElementById('dash-weak-skills');
  if (weakEl) {
    const sorted = [];
    for (let i = 1; i <= 15; i++) {
      sorted.push({ id: i, m: skills[i]?.mastery || 0 });
    }
    sorted.sort((a, b) => a.m - b.m);
    const weakest = sorted.slice(0, 3).filter(s => s.m < 80);

    if (weakest.length > 0) {
      let html = '<div class="weak-card"><h4>⚡ المهارات التي تحتاج تعزيز</h4>';
      weakest.forEach(s => {
        const sk = SKILLS.find(sk => sk.id === s.id);
        html += `
          <div class="weak-skill-item">
            <span class="ws-num">${s.id}</span>
            <div class="ws-info">
              <div class="ws-name">${sk?.name || ui.getSkillName(s.id)}</div>
              <div class="ws-bar"><div class="ws-fill" style="width:${s.m}%;background:${ui.getMasteryColor(s.m)}"></div></div>
            </div>
            <button class="btn btn-sm btn-primary ws-btn" onclick="window.location.hash='#skills'">تدرّب</button>
          </div>`;
      });
      html += '</div>';
      weakEl.innerHTML = html;
    } else {
      weakEl.innerHTML = '<div class="weak-card"><h4>🎉 أداء ممتاز! جميع مهاراتك فوق 80%</h4></div>';
    }
  }

  // Badges
  const badgesEl = document.getElementById('dash-badges');
  if (badgesEl) {
    const earned = storage.getBadges();
    const all = engine.getBadgeDefinitions();
    let html = '<div class="dash-badges-card"><h4>🏆 الشارات</h4><div class="badges-grid">';
    all.forEach(b => {
      const got = earned.includes(b.id);
      html += `<div class="badge-item ${got ? 'earned' : 'locked'}" title="${b.name}"><span class="badge-icon">${b.icon}</span><span class="badge-label">${b.name}</span></div>`;
    });
    html += '</div></div>';
    badgesEl.innerHTML = html;
  }
}

function renderTextsGrid() {
  const grid = document.getElementById('texts-grid');
  if (!grid) return;
  const completed = storage.getCompletedTexts();
  const diffF = document.getElementById('filter-difficulty')?.value || '';
  const genreF = document.getElementById('filter-genre')?.value || '';

  let filtered = TEXTS;
  if (diffF) filtered = filtered.filter(t => t.difficulty === diffF);
  if (genreF) filtered = filtered.filter(t => t.genre === genreF);

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="text-align:center;color:var(--muted);padding:20px">لا توجد نصوص مطابقة.</p>';
    return;
  }

  grid.innerHTML = filtered.map(t => {
    const c = completed.find(x => x.id === t.id);
    return `
      <div class="text-card ${c ? 'completed' : ''}" data-id="${t.id}">
        <div class="tc-info">
          <h4>${t.title}</h4>
          <div class="tc-meta">
            <span class="diff-badge ${ui.getDiffClass(t.difficulty)}">${t.difficulty}</span>
            <span class="genre-tag">${t.genre}</span>
          </div>
        </div>
        <div class="tc-score">
          ${c ? '<span class="score-val">' + c.score + '%</span><span class="score-lbl">أفضل نتيجة</span>' : '<span class="score-lbl new-badge">جديد</span>'}
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.text-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.hash = '#play/practice/' + card.dataset.id;
    });
  });
}

/* ============================== */
/*       SKILL TRAINING PAGE      */
/* ============================== */
function renderSkillSelect() {
  const container = document.getElementById('skill-select-container');
  if (!container) return;
  const skills = storage.getSkillData();

  let html = '<h2 class="section-title">اختر المهارة للتدريب عليها</h2><div class="skills-grid">';
  for (let i = 1; i <= 15; i++) {
    const sk = SKILLS.find(s => s.id === i) || {};
    const m = skills[i]?.mastery || 0;
    // Count available questions
    let qCount = 0;
    TEXTS.forEach(t => t.questions.forEach(q => { if (q.skill_id === i) qCount++; }));

    html += `
      <div class="skill-card" data-skill="${i}">
        <div class="sk-header">
          <span class="sk-icon">${sk.icon || '📝'}</span>
          <span class="sk-id">S${i}</span>
        </div>
        <h4 class="sk-name">${sk.name || ui.getSkillName(i)}</h4>
        <p class="sk-desc">${sk.description || ''}</p>
        <div class="sk-footer">
          <div class="sk-mastery">
            <div class="sk-bar"><div class="sk-fill" style="width:${m}%;background:${ui.getMasteryColor(m)}"></div></div>
            <span style="color:${ui.getMasteryColor(m)}">${m}%</span>
          </div>
          <span class="sk-qcount">${qCount} سؤال</span>
        </div>
      </div>`;
  }
  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.skill-card').forEach(card => {
    card.addEventListener('click', () => {
      const skillId = parseInt(card.dataset.skill);
      startSkillTraining(skillId);
    });
  });
}

function startSkillTraining(skillId) {
  const result = engine.getQuestionsForSkill(TEXTS, skillId, 15);

  if (!result.valid) {
    ui.showToast(result.error, 'danger');
    return;
  }

  if (result.questions.length < 3) {
    ui.showToast('عدد الأسئلة المتاحة لهذه المهارة غير كافٍ (' + result.count + ' أسئلة). جرّب التدريب الحر.', 'danger');
    return;
  }

  // Runtime assertion: every question must match skill
  for (const q of result.questions) {
    if (q.skill_id !== skillId) {
      console.error('[ASSERT FAIL] Question', q.id, 'has skill_id', q.skill_id, 'expected', skillId);
      ui.showToast('خطأ في التحقق من الأسئلة. يُرجى المحاولة لاحقًا.', 'danger');
      return;
    }
  }

  const sk = SKILLS.find(s => s.id === skillId) || {};
  currentGame = {
    mode: 'skill',
    skillId,
    skillName: sk.name || ui.getSkillName(skillId),
    text: { id: 'SKILL_' + skillId, title: sk.name || ui.getSkillName(skillId), body: '' },
    questions: result.questions,
    currentQ: 0,
    answers: [],
    score: 0,
    startTime: Date.now(),
    timer: null,
    timerSeconds: 0
  };

  showPage('play');
  renderPlayScreen();
  document.getElementById('play-timer').style.display = 'none';
}

/* ============================== */
/*         GAME PLAY              */
/* ============================== */
function startGame(mode, textId) {
  let text;
  if (mode === 'daily') {
    text = engine.getDailyText(TEXTS);
  } else if (textId) {
    text = TEXTS.find(t => t.id === textId);
  }
  if (!text) text = engine.getNextText(TEXTS);
  if (!text) return;

  currentGame = {
    mode,
    text,
    questions: text.questions.map(q => engine.shuffleQuestion(q)),
    currentQ: 0,
    answers: [],
    score: 0,
    startTime: Date.now(),
    timer: null,
    timerSeconds: 0
  };

  showPage('play');
  renderPlayScreen();

  if (mode === 'nafs') {
    const totalSec = (CONFIG.nafs_total_minutes || 30) * 60;
    currentGame.timerSeconds = totalSec;
    document.getElementById('play-timer').style.display = 'flex';
    updateTimerDisplay();
    currentGame.timer = setInterval(() => {
      currentGame.timerSeconds--;
      updateTimerDisplay();
      if (currentGame.timerSeconds <= 0) {
        clearInterval(currentGame.timer);
        finishGame();
      }
    }, 1000);
  } else {
    document.getElementById('play-timer').style.display = 'none';
  }
}

function updateTimerDisplay() {
  const el = document.getElementById('play-timer');
  if (!el) return;
  const m = Math.floor(currentGame.timerSeconds / 60);
  const s = currentGame.timerSeconds % 60;
  el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  el.classList.toggle('timer-danger', currentGame.timerSeconds < 60);
}

function renderPlayScreen() {
  const g = currentGame;
  const q = g.questions[g.currentQ];
  const total = g.questions.length;

  // Text panel – hide for skill mode if no text body
  const textPanel = document.getElementById('play-text-panel');
  const toggleBtn = document.getElementById('toggle-text-btn');
  if (g.mode === 'skill') {
    const body = q.textBody || '';
    if (body) {
      textPanel.style.display = '';
      document.getElementById('play-text-title').textContent = q.textTitle || '';
      document.getElementById('play-text-body').textContent = body;
    } else {
      textPanel.style.display = 'none';
    }
  } else {
    textPanel.style.display = '';
    document.getElementById('play-text-title').textContent = g.text.title;
    document.getElementById('play-text-body').textContent = g.text.body;
  }

  // Progress
  document.getElementById('play-progress-fill').style.width = ((g.currentQ) / total * 100) + '%';
  document.getElementById('play-progress-text').textContent = (g.currentQ + 1) + '/' + total;

  // Skill tag
  const skillTag = document.getElementById('play-skill-tag');
  if (g.mode === 'practice' || g.mode === 'skill') {
    skillTag.textContent = ui.getSkillName(q.skill_id);
    skillTag.style.display = 'inline-block';
  } else {
    skillTag.style.display = 'none';
  }

  // Question
  document.getElementById('play-stem').textContent = q.stem;
  document.getElementById('play-explanation').style.display = 'none';
  document.getElementById('btn-next-q').style.display = 'none';

  // Options
  const optC = document.getElementById('play-options');
  optC.innerHTML = q.choices.map((opt, i) => `
    <button class="option-btn" data-index="${i}">
      <span class="opt-letter">${ui.letterFromIndex(i)}</span>
      <span class="opt-text">${opt}</span>
    </button>`).join('');

  optC.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => handleAnswer(parseInt(btn.dataset.index)));
  });

  // Text toggle reset
  if (textPanel.style.display !== 'none') {
    textPanel.classList.remove('text-collapsed');
    if (toggleBtn) toggleBtn.textContent = 'إخفاء النص';
  }
}

function handleAnswer(idx) {
  const g = currentGame;
  const q = g.questions[g.currentQ];
  const isCorrect = idx === q.correct_index;

  g.answers.push({ skillId: q.skill_id, selected: idx, correct: q.correct_index, isCorrect });
  if (isCorrect) g.score++;

  engine.processAnswer(q.skill_id, isCorrect, CONFIG);
  updateHeaderXP();

  // Sound
  ui.resumeAudio();
  if (isCorrect) ui.playCorrectSound();
  else ui.playWrongSound();

  // Visual feedback
  const buttons = document.querySelectorAll('.option-btn');
  buttons.forEach(btn => {
    const bi = parseInt(btn.dataset.index);
    btn.classList.add('disabled');
    btn.disabled = true;
    if (bi === q.correct_index) btn.classList.add('correct');
    if (bi === idx && !isCorrect) btn.classList.add('wrong');
  });

  // Explanation (practice & skill modes)
  if (g.mode === 'practice' || g.mode === 'skill') {
    const expEl = document.getElementById('play-explanation');
    expEl.innerHTML = `<strong>${isCorrect ? '✅ إجابة صحيحة!' : '❌ إجابة خاطئة'}</strong><br>${q.explanation || ''}`;
    expEl.className = 'explanation-box ' + (isCorrect ? 'exp-correct' : 'exp-wrong');
    expEl.style.display = 'block';
  }

  if (isCorrect && (g.mode === 'practice' || g.mode === 'skill')) {
    ui.showToast('+' + (CONFIG.xp_per_correct || 10) + ' XP', 'success');
  }

  const nextBtn = document.getElementById('btn-next-q');
  nextBtn.style.display = 'block';
  nextBtn.textContent = g.currentQ < g.questions.length - 1 ? 'السؤال التالي ←' : 'عرض النتيجة';
}

function nextQuestion() {
  const g = currentGame;
  g.currentQ++;
  if (g.currentQ >= g.questions.length) finishGame();
  else renderPlayScreen();
}

function finishGame() {
  if (currentGame.timer) clearInterval(currentGame.timer);

  const g = currentGame;
  const pct = Math.round((g.score / g.questions.length) * 100);

  // Sound
  ui.resumeAudio();
  if (pct >= 60) ui.playSuccessSound();

  // Only mark text complete if not skill mode
  if (g.mode !== 'skill') {
    engine.completeText(g.text.id, pct, CONFIG);
  } else {
    storage.saveStudentSnapshot();
  }

  if (g.mode === 'daily') {
    const daily = storage.getDailyData();
    daily.todayDone = true;
    storage.setDailyData(daily);
  }

  const newBadges = engine.checkBadges();
  if (newBadges.length > 0) {
    ui.showConfetti();
    const allBadges = engine.getBadgeDefinitions();
    newBadges.forEach(bId => {
      const bd = allBadges.find(b => b.id === bId);
      if (bd) ui.showToast('🏆 شارة جديدة: ' + bd.name, 'gold');
    });
  }

  if (pct >= 80) ui.showConfetti();
  updateHeaderXP();
  showReport(g, pct);
}

/* ============================== */
/*         REPORT                 */
/* ============================== */
function showReport(game, pct) {
  showPage('report');
  const c = document.getElementById('report-container');
  const scoreColor = ui.getScoreColor(pct);

  // Build skill analysis
  const skillMap = {};
  game.answers.forEach(a => {
    if (!skillMap[a.skillId]) skillMap[a.skillId] = { correct: 0, total: 0 };
    skillMap[a.skillId].total++;
    if (a.isCorrect) skillMap[a.skillId].correct++;
  });

  let skillRows = '';
  Object.entries(skillMap).forEach(([sid, data]) => {
    const pctS = Math.round((data.correct / data.total) * 100);
    skillRows += `
      <div class="report-skill-row">
        <span class="rsk-num" style="background:${ui.getMasteryColor(pctS)}">${sid}</span>
        <span class="rsk-name">${ui.getSkillName(parseInt(sid))}</span>
        <span class="rsk-val" style="color:${ui.getMasteryColor(pctS)}">${data.correct}/${data.total}</span>
      </div>`;
  });

  // Weakest skills suggestion
  const weakSkills = Object.entries(skillMap)
    .filter(([, d]) => d.correct / d.total < 0.5)
    .map(([sid]) => parseInt(sid));

  let weakHTML = '';
  if (weakSkills.length > 0) {
    weakHTML = '<div class="weak-suggest"><h4>💪 تدرّب أكثر على:</h4><div class="weak-btns">';
    weakSkills.forEach(sid => {
      weakHTML += `<button class="btn btn-sm btn-outline" onclick="window.location.hash='#skills'">${ui.getSkillName(sid)}</button>`;
    });
    weakHTML += '</div></div>';
  }

  // Explanations for nafs mode
  let expHTML = '';
  if (game.mode === 'nafs') {
    expHTML = '<div class="report-explanations"><h3>الشرح التفصيلي</h3>';
    game.questions.forEach((q, i) => {
      const a = game.answers[i];
      expHTML += `
        <div class="exp-item">
          <p class="exp-q">س${i + 1}: ${q.stem}</p>
          <p class="exp-result ${a?.isCorrect ? 'correct' : 'wrong'}">${a?.isCorrect ? '✅ صحيح' : '❌ خطأ — الصحيح: ' + q.choices[q.correct_index]}</p>
          ${q.explanation ? '<p class="exp-text">' + q.explanation + '</p>' : ''}
        </div>`;
    });
    expHTML += '</div>';
  }

  const title = game.mode === 'skill' ? game.skillName : game.text.title;

  c.innerHTML = `
    <div class="report-card">
      <div class="report-header">
        <h2>تقرير النتيجة</h2>
        <p class="report-subtitle">${title}</p>
        <div class="report-score" style="background:${scoreColor}">${pct}%</div>
        <p class="report-detail">${game.score} من ${game.questions.length} — ${ui.getGrade(pct)}</p>
      </div>
      <div class="report-skills">${skillRows}</div>
      ${weakHTML}
      ${expHTML}
      <div class="report-actions">
        <button class="btn btn-primary btn-lg" onclick="window.location.hash='#dashboard'">العودة للرئيسية</button>
        ${game.mode === 'skill' ? '<button class="btn btn-outline btn-lg" onclick="window.location.hash=\'#skills\'">تدريب مهارة أخرى</button>' : ''}
      </div>
    </div>`;
}

/* ============================== */
/*         PROFILE                */
/* ============================== */
function renderProfile() {
  const profile = storage.getProfile();
  if (!profile) { window.location.hash = '#home'; return; }
  const progress = storage.getProgress();
  const skills = storage.getSkillData();
  const settings = storage.getSettings();

  const avgPct = progress.totalAnswered > 0 ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100) : 0;

  // Skill rows
  let skillRows = '';
  for (let i = 1; i <= 15; i++) {
    const m = skills[i]?.mastery || 0;
    skillRows += `
      <div class="skill-row">
        <span class="sr-num">${i}</span>
        <div class="sr-main">
          <span class="sr-name">${ui.getSkillName(i)}</span>
          <div class="sr-bar"><div class="sr-fill" style="width:${m}%;background:${ui.getMasteryColor(m)}"></div></div>
        </div>
        <span class="sr-val" style="color:${ui.getMasteryColor(m)}">${m}%</span>
      </div>`;
  }

  // Badges
  const earned = storage.getBadges();
  const all = engine.getBadgeDefinitions();
  let badgesHTML = '';
  all.forEach(b => {
    const got = earned.includes(b.id);
    badgesHTML += `<div class="badge-item ${got ? 'earned' : 'locked'}"><span class="badge-icon">${b.icon}</span><span class="badge-label">${b.name}</span></div>`;
  });

  const c = document.getElementById('profile-container');
  c.innerHTML = `
    <div class="profile-header-card">
      <div class="ph-avatar">${profile.name.charAt(0)}</div>
      <h2>${profile.name}</h2>
      <p>${profile.className}</p>
      <div class="ph-stats">
        <div class="ph-stat"><span class="ph-val" style="color:var(--gold)">⭐ ${progress.xp}</span><span class="ph-lbl">XP</span></div>
        <div class="ph-stat"><span class="ph-val" style="color:var(--primary)">📖 ${progress.textsCompleted}</span><span class="ph-lbl">نص</span></div>
        <div class="ph-stat"><span class="ph-val" style="color:${ui.getScoreColor(avgPct)}">📊 ${avgPct}%</span><span class="ph-lbl">المعدل</span></div>
        <div class="ph-stat"><span class="ph-val" style="color:var(--navy)">🏅 ${progress.level}</span><span class="ph-lbl">المستوى</span></div>
      </div>
    </div>

    <div class="profile-section">
      <h3>إعدادات الصوت</h3>
      <div class="settings-row">
        <label class="toggle-label">
          <input type="checkbox" id="chk-sound" ${settings.soundEnabled ? 'checked' : ''}>
          <span>تفعيل الأصوات</span>
        </label>
        <div class="volume-row">
          <span>مستوى الصوت</span>
          <input type="range" id="rng-volume" min="0" max="1" step="0.1" value="${settings.soundVolume}">
        </div>
      </div>
    </div>

    <div class="profile-section">
      <h3>إتقان المهارات</h3>
      <div class="skill-rows">${skillRows}</div>
    </div>

    <div class="profile-section">
      <h3>الشارات</h3>
      <div class="badges-grid">${badgesHTML}</div>
    </div>

    <div class="profile-section" style="text-align:center">
      <button class="btn btn-gold btn-block" style="margin-bottom:10px" onclick="window.location.hash='#certificate'">🎓 شهادة الإنجاز</button>
      <button class="btn btn-outline btn-block" style="color:var(--navy);border-color:var(--navy);margin-bottom:10px" onclick="window.location.hash='#teacher'">🔐 لوحة المعلم</button>
      <button class="btn btn-outline btn-block" style="color:var(--muted);border-color:#E5E7EB;margin-bottom:10px" onclick="window.location.hash='#verify'">🔍 التحقق من شهادة</button>
      <button class="btn btn-outline btn-block" style="color:var(--muted);border-color:#E5E7EB;margin-bottom:10px" onclick="window.location.hash='#about'">ℹ️ عن المبادرة</button>
    </div>

    <div class="profile-section" style="text-align:center">
      <button class="btn btn-danger" id="btn-clear-data">مسح جميع بياناتي</button>
    </div>
  `;

  // Settings handlers
  document.getElementById('chk-sound')?.addEventListener('change', (e) => {
    const s = storage.getSettings();
    s.soundEnabled = e.target.checked;
    storage.setSettings(s);
    if (e.target.checked) { ui.resumeAudio(); ui.playCorrectSound(); }
  });
  document.getElementById('rng-volume')?.addEventListener('input', (e) => {
    const s = storage.getSettings();
    s.soundVolume = parseFloat(e.target.value);
    storage.setSettings(s);
  });
  document.getElementById('btn-clear-data')?.addEventListener('click', () => {
    if (confirm('هل أنت متأكد من مسح جميع بياناتك؟ لا يمكن التراجع!')) {
      storage.clearStudentData();
      window.location.hash = '#home';
      window.location.reload();
    }
  });
}

/* ============================== */
/*         CERTIFICATE            */
/* ============================== */
function renderCertificate() {
  const c = document.getElementById('cert-container');
  const eligibility = engine.checkCertificateEligibility(CONFIG);

  if (eligibility.eligible) {
    let certData = storage.getCertData();
    if (!certData) {
      certData = cert.generateCertificate(CONFIG);
      ui.showConfetti();
    }

    c.innerHTML = `
      <div class="cert-card">
        <h2>🎓 شهادة الإنجاز</h2>
        <div id="cert-canvas-wrap"></div>
        <div class="cert-actions">
          <button class="btn btn-primary btn-lg" id="btn-download-cert">تحميل PNG</button>
          <button class="btn btn-outline btn-lg" onclick="window.print()">طباعة</button>
        </div>
      </div>`;

    // Draw canvas certificate
    cert.drawCertificateCanvas(certData, CONFIG).then(canvas => {
      canvas.style.width = '100%';
      canvas.style.maxWidth = '700px';
      canvas.style.borderRadius = '12px';
      canvas.style.boxShadow = '0 4px 24px rgba(0,0,0,0.1)';
      document.getElementById('cert-canvas-wrap')?.appendChild(canvas);
    });

    document.getElementById('btn-download-cert')?.addEventListener('click', () => {
      cert.downloadCertAsPNG(certData, CONFIG);
    });
  } else {
    const checks = [
      { label: 'إتقان جميع المهارات (80% لكل مهارة)', done: eligibility.allMastered },
      { label: `إكمال ${eligibility.minTexts} نصًا (حاليًا: ${eligibility.textsCompleted})`, done: eligibility.enoughTexts },
      { label: `معدل عام ≥${eligibility.minAvg}% (حاليًا: ${eligibility.avgPercent}%)`, done: eligibility.goodAvg }
    ];

    c.innerHTML = `
      <div class="cert-card cert-pending">
        <h3>🎓 شهادة الإنجاز</h3>
        <p style="color:var(--muted);margin-bottom:20px">أكمل المتطلبات التالية للحصول على شهادتك:</p>
        <ul class="cert-checklist">
          ${checks.map(ch => `<li><span>${ch.done ? '✅' : '⬜'}</span>${ch.label}</li>`).join('')}
        </ul>
        <button class="btn btn-primary" style="margin-top:20px" onclick="window.location.hash='#dashboard'">واصل التدريب</button>
      </div>`;
  }
}

/* ============================== */
/*         VERIFY                 */
/* ============================== */
function renderVerify() {
  const btn = document.getElementById('btn-verify');
  if (!btn) return;
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => {
    const vid = document.getElementById('verify-id').value.trim();
    const certData = storage.getCertData();
    const r = document.getElementById('verify-result');
    if (certData && certData.verificationId === vid) {
      r.className = 'verify-result verify-ok';
      r.innerHTML = `<strong>✅ شهادة صحيحة</strong><br>الاسم: ${certData.name}<br>التاريخ: ${ui.formatDate(certData.date)}<br>المعدل: ${certData.avgPercent}%`;
    } else {
      r.className = 'verify-result verify-fail';
      r.innerHTML = '<strong>❌ رقم التحقق غير صحيح</strong>';
    }
  });
}

/* ============================== */
/*         TEACHER PANEL          */
/* ============================== */
async function renderTeacher() {
  const c = document.getElementById('teacher-container');
  const hasAdmin = storage.getAdminHash();
  const isLogged = sessionStorage.getItem('teacher_logged') === 'true';

  if (!hasAdmin) {
    // First-time setup
    c.innerHTML = `
      <div class="card card-centered">
        <h2>🔐 إعداد لوحة المعلم</h2>
        <p style="color:var(--muted)">ضع كلمة مرور جديدة للوحة المعلم</p>
        <p style="color:#F59E0B;font-size:0.85rem">⚠️ هذه حماية محلية وليست أمانًا كاملًا</p>
        <div class="form-group">
          <label>كلمة المرور الجديدة</label>
          <input type="password" id="admin-new-pass" class="input-field" placeholder="أدخل كلمة المرور">
        </div>
        <div class="form-group">
          <label>تأكيد كلمة المرور</label>
          <input type="password" id="admin-confirm-pass" class="input-field" placeholder="أعد إدخال كلمة المرور">
        </div>
        <button class="btn btn-primary btn-block" id="btn-admin-setup">حفظ</button>
      </div>`;

    document.getElementById('btn-admin-setup')?.addEventListener('click', async () => {
      const p1 = document.getElementById('admin-new-pass').value;
      const p2 = document.getElementById('admin-confirm-pass').value;
      if (p1.length < 4) { ui.showToast('كلمة المرور يجب أن تكون 4 أحرف على الأقل', ''); return; }
      if (p1 !== p2) { ui.showToast('كلمتا المرور غير متطابقتين', ''); return; }
      const salt = engine.generateSalt();
      const hash = await engine.hashPassword(p1, salt);
      storage.setAdminCredentials(hash, salt);
      sessionStorage.setItem('teacher_logged', 'true');
      ui.showToast('تم إعداد كلمة المرور بنجاح', 'success');
      renderTeacher();
    });
    return;
  }

  if (!isLogged) {
    c.innerHTML = `
      <div class="card card-centered">
        <h2>🔐 لوحة المعلم</h2>
        <p style="color:var(--muted)">أدخل كلمة المرور</p>
        <div class="form-group">
          <input type="password" id="teacher-pass" class="input-field" placeholder="كلمة المرور">
        </div>
        <button class="btn btn-primary btn-block" id="btn-teacher-login">دخول</button>
      </div>`;

    document.getElementById('btn-teacher-login')?.addEventListener('click', async () => {
      const pass = document.getElementById('teacher-pass').value;
      const salt = storage.getAdminSalt();
      const hash = await engine.hashPassword(pass, salt);
      if (hash === storage.getAdminHash()) {
        sessionStorage.setItem('teacher_logged', 'true');
        renderTeacher();
      } else {
        ui.showToast('كلمة مرور خاطئة!', '');
      }
    });
    return;
  }

  // Logged in - show dashboard
  const students = storage.getStudents();
  const profile = storage.getProfile();
  const progress = storage.getProgress();
  const skills = storage.getSkillData();
  const avgPct = progress.totalAnswered > 0 ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100) : 0;

  let studentsTable = '';
  if (students.length > 0) {
    studentsTable = `<table class="teacher-table">
      <thead><tr><th>الاسم</th><th>الصف</th><th>النصوص</th><th>المعدل</th><th>XP</th><th>آخر نشاط</th></tr></thead>
      <tbody>`;
    students.forEach(s => {
      const avg = s.totalAnswered > 0 ? Math.round((s.totalCorrect / s.totalAnswered) * 100) : 0;
      studentsTable += `<tr><td>${s.name}</td><td>${s.className}</td><td>${s.textsCompleted}</td><td>${avg}%</td><td>${s.xp}</td><td>${ui.formatDate(s.lastActive)}</td></tr>`;
    });
    studentsTable += '</tbody></table>';
  }

  // Current student skills
  let skillsTable = '';
  for (let i = 1; i <= 15; i++) {
    const m = skills[i]?.mastery || 0;
    skillsTable += `<tr><td>${i}. ${ui.getSkillName(i)}</td><td style="color:${ui.getMasteryColor(m)};font-weight:700">${m}%</td></tr>`;
  }

  c.innerHTML = `
    <div class="teacher-panel">
      <h2>🎓 لوحة المعلم</h2>

      <div class="teacher-section">
        <h3>الطالب الحالي</h3>
        <p><strong>الاسم:</strong> ${profile?.name || 'لا يوجد'} | <strong>الصف:</strong> ${profile?.className || '-'}</p>
        <p><strong>XP:</strong> ${progress.xp} | <strong>المستوى:</strong> ${progress.level} | <strong>النصوص:</strong> ${progress.textsCompleted} | <strong>المعدل:</strong> ${avgPct}%</p>
      </div>

      <div class="teacher-section">
        <h3>المهارات</h3>
        <table class="teacher-table"><thead><tr><th>المهارة</th><th>الإتقان</th></tr></thead><tbody>${skillsTable}</tbody></table>
      </div>

      ${students.length > 0 ? '<div class="teacher-section"><h3>سجل الطلاب</h3>' + studentsTable + '</div>' : ''}

      <div class="teacher-actions">
        <button class="btn btn-primary" id="btn-export-csv">تصدير CSV</button>
        <button class="btn btn-danger" id="btn-reset-student">إعادة تعيين الطالب</button>
        <button class="btn btn-outline" onclick="window.location.hash='#dashboard'">العودة</button>
      </div>
    </div>`;

  document.getElementById('btn-export-csv')?.addEventListener('click', exportCSV);
  document.getElementById('btn-reset-student')?.addEventListener('click', () => {
    if (confirm('هل أنت متأكد من مسح بيانات الطالب الحالي؟')) {
      storage.clearStudentData();
      ui.showToast('تم مسح البيانات', 'success');
      renderTeacher();
    }
  });
}

function exportCSV() {
  const students = storage.getStudents();
  const san = engine.sanitizeCSVCell;

  let csv = 'الاسم,الصف,التاريخ,';
  for (let i = 1; i <= 15; i++) csv += 'مهارة ' + i + ',';
  csv += 'المعدل,XP,النصوص\n';

  const addRow = (s) => {
    const avg = s.totalAnswered > 0 ? Math.round((s.totalCorrect / s.totalAnswered) * 100) : 0;
    csv += san(s.name) + ',' + san(s.className) + ',' + san(ui.formatDate(s.lastActive || new Date().toISOString())) + ',';
    for (let i = 1; i <= 15; i++) csv += san((s.skills?.[i] || 0) + '%') + ',';
    csv += san(avg + '%') + ',' + san(s.xp) + ',' + san(s.textsCompleted) + '\n';
  };

  if (students.length > 0) {
    students.forEach(addRow);
  } else {
    // Export current student
    const profile = storage.getProfile();
    const progress = storage.getProgress();
    const skills = storage.getSkillData();
    if (profile) {
      addRow({
        name: profile.name, className: profile.className,
        totalCorrect: progress.totalCorrect, totalAnswered: progress.totalAnswered,
        xp: progress.xp, textsCompleted: progress.textsCompleted,
        skills: Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, v.mastery])),
        lastActive: new Date().toISOString()
      });
    }
  }

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'تقرير_أبطال_القراءة.csv';
  link.click();
}

/* ============================== */
/*         ABOUT                  */
/* ============================== */
function renderAbout() {
  const c = document.getElementById('about-container');
  const slogan2 = CONFIG.slogans?.secondary || 'نقرأ لنفهم… نفهم لنتميز';
  const totalQ = TEXTS.reduce((s, t) => s + (t.questions?.length || 0), 0);

  let skillsList = '';
  SKILLS.forEach(s => {
    skillsList += `<li><strong>${s.name}</strong>: ${s.description}</li>`;
  });

  c.innerHTML = `
    <div class="about-card">
      <h2>عن مبادرة أبطال القراءة</h2>
      <p class="about-slogan">${slogan2}</p>
      <p>مبادرة تعليمية تفاعلية تستهدف طلاب الصف السادس الابتدائي لرفع مستوى مهارات القراءة والفهم القرائي استعدادًا لاختبارات نافس الوطنية.</p>
      <p>تتضمن المبادرة <strong>${TEXTS.length}</strong> نصًا قرائيًا أصليًا مع <strong>${totalQ}</strong> سؤالًا يغطي <strong>15</strong> مهارة قرائية.</p>
    </div>
    <div class="about-card">
      <h2>المهارات الـ 15</h2>
      <ol class="skills-about-list">${skillsList}</ol>
    </div>
    <div class="about-card" style="text-align:center">
      ${CONFIG.school_name ? '<p style="font-weight:700;font-size:1.1rem">' + CONFIG.school_name + '</p>' : ''}
      ${CONFIG.teacher_name ? '<p style="color:var(--muted)">' + CONFIG.teacher_name + '</p>' : ''}
    </div>
  `;
}

/* ============================== */
/*         ROUTER                 */
/* ============================== */
function handleRoute(route) {
  if (!dataLoaded && route.page !== 'home') {
    window.location.hash = '#home';
    return;
  }

  const profile = storage.getProfile();

  switch (route.page) {
    case 'home':
      showPage('home');
      renderHome();
      break;
    case 'onboarding':
      showPage('onboarding');
      break;
    case 'dashboard':
      if (!profile) { window.location.hash = '#home'; return; }
      showPage('dashboard');
      renderDashboard();
      break;
    case 'play':
      if (!profile) { window.location.hash = '#home'; return; }
      startGame(route.param || 'practice', route.sub);
      break;
    case 'skills':
      if (!profile) { window.location.hash = '#home'; return; }
      showPage('skills');
      renderSkillSelect();
      break;
    case 'texts':
      if (!profile) { window.location.hash = '#home'; return; }
      showPage('texts');
      renderTextsGrid();
      break;
    case 'report':
      showPage('report');
      break;
    case 'profile':
      if (!profile) { window.location.hash = '#home'; return; }
      showPage('profile');
      renderProfile();
      break;
    case 'certificate':
      if (!profile) { window.location.hash = '#home'; return; }
      showPage('certificate');
      renderCertificate();
      break;
    case 'verify':
      showPage('verify');
      renderVerify();
      break;
    case 'teacher':
      showPage('teacher');
      renderTeacher();
      break;
    case 'about':
      showPage('about');
      renderAbout();
      break;
    default:
      showPage('home');
      renderHome();
  }
}

/* ============================== */
/*         INIT                   */
/* ============================== */
async function init() {
  await loadData();
  if (!dataLoaded) return;

  applyBranding();
  updateHeaderXP();

  // Onboarding
  document.getElementById('btn-start-journey')?.addEventListener('click', () => {
    const name = document.getElementById('inp-name').value.trim();
    const cls = document.getElementById('inp-class').value.trim();
    if (!name) { ui.showToast('أدخل اسمك أولًا', ''); return; }
    storage.setProfile({ name, className: cls || 'غير محدد' });
    window.location.hash = '#dashboard';
  });

  // Play controls
  document.getElementById('btn-next-q')?.addEventListener('click', nextQuestion);
  document.getElementById('toggle-text-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('play-text-panel');
    const btn = document.getElementById('toggle-text-btn');
    panel.classList.toggle('text-collapsed');
    btn.textContent = panel.classList.contains('text-collapsed') ? 'إظهار النص' : 'إخفاء النص';
  });
  document.getElementById('btn-back-play')?.addEventListener('click', () => {
    window.location.hash = '#dashboard';
  });

  // Filters
  document.getElementById('filter-difficulty')?.addEventListener('change', renderTextsGrid);
  document.getElementById('filter-genre')?.addEventListener('change', renderTextsGrid);

  // Resume audio on first click
  document.addEventListener('click', () => ui.resumeAudio(), { once: true });

  // Auto redirect if profile exists
  const profile = storage.getProfile();
  if (profile && (!window.location.hash || window.location.hash === '#home')) {
    window.location.hash = '#dashboard';
  }

  initRouter(handleRoute);
}

init();
