/* engine.js – Game Logic Engine */
import * as storage from './storage.js';

/* --- Utility --- */
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shuffleQuestion(q) {
  const indices = [0, 1, 2, 3];
  const shuffled = shuffleArray(indices);
  const newChoices = shuffled.map(i => q.choices[i]);
  const newCorrect = shuffled.indexOf(q.correct_index);
  return { ...q, choices: newChoices, correct_index: newCorrect, _shuffleMap: shuffled };
}

/* --- Riyadh local date --- */
export function getRiyadhDate() {
  const now = new Date();
  const riyadh = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }));
  const y = riyadh.getFullYear();
  const m = String(riyadh.getMonth() + 1).padStart(2, '0');
  const d = String(riyadh.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* Simple hash for tip/daily text selection */
function dateHash(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = ((h << 5) - h) + dateStr.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/* --- Text Selection --- */
export function getNextText(texts) {
  const completed = storage.getCompletedTexts();
  const completedIds = completed.map(c => c.id);
  const unseen = texts.filter(t => !completedIds.includes(t.id));
  if (unseen.length > 0) return unseen[Math.floor(Math.random() * unseen.length)];
  return texts[Math.floor(Math.random() * texts.length)];
}

export function getDailyText(texts) {
  const daily = storage.getDailyData();
  const today = getRiyadhDate();

  if (daily.lastDate === today && daily.todayTextId) {
    return texts.find(t => t.id === daily.todayTextId) || texts[0];
  }

  let newStreak = daily.streak;
  if (daily.lastDate) {
    const last = new Date(daily.lastDate + 'T00:00:00');
    const now = new Date(today + 'T00:00:00');
    const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));
    if (diffDays === 1 && daily.todayDone) {
      newStreak = daily.streak + 1;
    } else if (diffDays > 1) {
      newStreak = 0;
    }
  }

  const idx = dateHash(today) % texts.length;
  const text = texts[idx];

  storage.setDailyData({
    lastDate: today,
    streak: newStreak,
    todayDone: false,
    todayTextId: text.id
  });

  return text;
}

/* --- Tip of the Day --- */
export function getDailyTip(tips) {
  if (!tips || tips.length === 0) return '';
  const today = getRiyadhDate();
  const idx = dateHash(today) % tips.length;
  return tips[idx];
}

/* --- Skill Training Mode --- */
export function getQuestionsForSkill(texts, skillId, maxQuestions) {
  const questions = [];
  for (const t of texts) {
    for (const q of t.questions) {
      if (q.skill_id === skillId) {
        questions.push({ ...q, textId: t.id, textTitle: t.title, textBody: t.body });
      }
    }
  }
  // Runtime validation
  const validated = questions.filter(q => q.skill_id === skillId);
  if (validated.length !== questions.length) {
    console.error('[SKILL VALIDATION FAILED] Found questions with mismatched skill_id');
    return { valid: false, questions: [], error: 'فشل التحقق: وجدت أسئلة لا تتطابق مع المهارة المختارة.' };
  }
  const shuffled = shuffleArray(validated);
  const selected = shuffled.slice(0, maxQuestions || 15);
  return { valid: true, questions: selected.map(q => shuffleQuestion(q)), count: validated.length };
}

/* --- Answer Processing --- */
export function processAnswer(skillId, isCorrect, config) {
  const skills = storage.getSkillData();
  const progress = storage.getProgress();

  if (!skills[skillId]) skills[skillId] = { attempts: [], mastery: 0, totalCorrect: 0, totalAnswered: 0 };

  skills[skillId].attempts.push(isCorrect ? 1 : 0);
  if (skills[skillId].attempts.length > 10) {
    skills[skillId].attempts = skills[skillId].attempts.slice(-10);
  }
  skills[skillId].totalAnswered = (skills[skillId].totalAnswered || 0) + 1;
  if (isCorrect) skills[skillId].totalCorrect = (skills[skillId].totalCorrect || 0) + 1;

  const last = skills[skillId].attempts.slice(-3);
  if (last.length > 0) {
    skills[skillId].mastery = Math.round((last.reduce((a, b) => a + b, 0) / last.length) * 100);
  }

  if (isCorrect) {
    progress.xp += config.xp_per_correct || 10;
    progress.totalCorrect++;
  }
  progress.totalAnswered++;
  progress.level = Math.floor(progress.xp / (config.xp_per_level || 200)) + 1;

  storage.setSkillData(skills);
  storage.setProgress(progress);

  return { skills, progress };
}

export function completeText(textId, score, config) {
  const progress = storage.getProgress();
  progress.textsCompleted++;
  progress.xp += config.xp_per_text_complete || 50;
  progress.level = Math.floor(progress.xp / (config.xp_per_level || 200)) + 1;
  storage.setProgress(progress);
  storage.addCompletedText(textId, score);
  storage.saveStudentSnapshot();
  checkBadges();
  return progress;
}

/* --- Badges --- */
export function getBadgeDefinitions() {
  return [
    { id: 'vocab', name: 'بطل المفردات', icon: '📚', skills: [1, 2, 3, 4] },
    { id: 'direct', name: 'بطل الفهم المباشر', icon: '🎯', skills: [5] },
    { id: 'analysis', name: 'بطل التحليل والمقارنة', icon: '🔍', skills: [6, 7] },
    { id: 'narrative', name: 'بطل السرد', icon: '📖', skills: [8] },
    { id: 'reality', name: 'بطل الربط بالواقع', icon: '🌍', skills: [9] },
    { id: 'taste', name: 'بطل الذائقة', icon: '✨', skills: [10] },
    { id: 'opinion', name: 'بطل الرأي والنقد', icon: '💬', skills: [11, 12] },
    { id: 'creative', name: 'بطل الإبداع', icon: '🎨', skills: [13] },
    { id: 'persuade', name: 'بطل الإقناع', icon: '🎤', skills: [14] },
    { id: 'solutions', name: 'بطل الحلول', icon: '💡', skills: [15] }
  ];
}

export function checkBadges() {
  const skills = storage.getSkillData();
  const badges = storage.getBadges();
  const defs = getBadgeDefinitions();
  const earned = [];
  defs.forEach(bd => {
    const allMastered = bd.skills.every(s => skills[s] && skills[s].mastery >= 80);
    if (allMastered && !badges.includes(bd.id)) earned.push(bd.id);
  });
  if (earned.length > 0) storage.setBadges([...badges, ...earned]);
  return earned;
}

/* --- Certificate Eligibility --- */
export function checkCertificateEligibility(config) {
  const progress = storage.getProgress();
  const skills = storage.getSkillData();
  const cc = config.certificate || {};

  const minTexts = cc.min_texts || 10;
  const minAvg = cc.min_avg_percent || 80;
  const masteryThreshold = cc.mastery_threshold || 80;

  const allMastered = Object.keys(skills).every(k => skills[k].mastery >= masteryThreshold);
  const enoughTexts = progress.textsCompleted >= minTexts;
  const avgPercent = progress.totalAnswered > 0 ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100) : 0;
  const goodAvg = avgPercent >= minAvg;

  return {
    eligible: allMastered && enoughTexts && goodAvg,
    allMastered, enoughTexts, goodAvg,
    textsCompleted: progress.textsCompleted, minTexts,
    avgPercent, minAvg, masteryDetails: skills
  };
}

/* --- Verification ID --- */
export function generateVerificationId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'RH-';
  for (let i = 0; i < 8; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

/* --- Admin Password Hashing (SHA-256 based) --- */
export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(salt + password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* --- CSV Sanitization --- */
export function sanitizeCSVCell(val) {
  let s = String(val);
  // Escape formula injection
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  // Escape quotes
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
