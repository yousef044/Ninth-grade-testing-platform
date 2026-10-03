'use strict';
const SUBJECTS = [
            { id: 'science', name: 'علوم', count: 100, icon: 'fa-atom', color: 'from-emerald-500 to-teal-600' },
            { id: 'physics', name: 'فيزياء', count: 25, icon: 'fa-bolt', color: 'from-amber-500 to-orange-600' },
            { id: 'chemistry', name: 'كيمياء', count: 25, icon: 'fa-flask', color: 'from-blue-500 to-indigo-600' },
            { id: 'history', name: 'تاريخ', count: 25, icon: 'fa-landmark', color: 'from-rose-500 to-red-600' },
            { id: 'geography', name: 'جغرافيا', count: 25, icon: 'fa-globe', color: 'from-cyan-500 to-blue-600' },
            { id: 'algebra', name: 'قوانين رياضيات جبر', count: 25, icon: 'fa-square-root-variable', color: 'from-purple-500 to-indigo-600' },
            { id: 'geometry', name: 'قوانين رياضيات هندسة', count: 25, icon: 'fa-shapes', color: 'from-violet-500 to-purple-600' },
            { id: 'arabic', name: 'لغة عربية', count: 50, icon: 'fa-book-open', color: 'from-pink-500 to-rose-600' },
            { id: 'english', name: 'لغة إنجليزية', count: 50, icon: 'fa-language', color: 'from-sky-500 to-blue-600' },
            { id: 'french', name: 'لغة فرنسية', count: 50, icon: 'fa-comment-dots', color: 'from-fuchsia-500 to-pink-600' },
            { id: 'islamic', name: 'تربية إسلامية', count: 25, icon: 'fa-mosque', color: 'from-emerald-600 to-green-700' }
        ];
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
window.BANK = window.BANK || {};
let subject = null, questions = [], idx = 0, answers = {};

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const buildQ = q => {
  const o = shuffle(q.opts.map((t, k) => ({ t, ok: k === q.corr })));
  return { text: q.q, options: o.map(x => x.t), correct: o.findIndex(x => x.ok), exp: q.exp || '' };
};
function loadBank(id) {
  return new Promise((res, rej) => {
    if (BANK[id]) return res(BANK[id]);
    const s = document.createElement('script');
    s.src = `data/${id}.js`;
    s.onload = () => res(BANK[id]);
    s.onerror = () => rej(new Error('bank'));
    document.head.appendChild(s);
  });
}
const show = (...ids) => ['home-view', 'quiz-view', 'completion-view'].forEach(v => $(v).classList.toggle('hidden', !ids.includes(v)));

// ===== الدخول =====
function unlock() { $('login-view').classList.add('hidden'); }
function loginMsg(msg, cls) { const e = $('login-error'); e.textContent = msg; e.className = 'text-xs font-bold ' + cls; }
async function doLogin() {
  const raw = $('access-code-input').value.trim();
  if (!raw) return loginMsg('أدخل كود التفعيل.', 'text-rose-600');
  if (!window.verifyCode) return loginMsg('تعذّر تحميل خدمة التحقق. تأكد من اتصالك بالإنترنت ثم أعد تحميل الصفحة.', 'text-rose-600');
  const btn = $('login-btn'); btn.disabled = true;
  loginMsg('جارٍ التحقق من الكود...', 'text-blue-600');
  const r = await window.verifyCode(raw);
  btn.disabled = false;
  if (r.ok) { try { localStorage.setItem('bound_device_code', raw.toUpperCase()); } catch {} unlock(); }
  else loginMsg(r.msg, r.warn ? 'text-orange-600' : 'text-rose-600');
}

// ===== الرئيسية =====
function initHome() {
  const stats = store.get('stats', {});
  const grid = $('subjects-grid'); grid.innerHTML = '';
  SUBJECTS.forEach(sub => {
    const st = stats[sub.id];
    const card = document.createElement('div');
    card.className = 'bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition duration-300 cursor-pointer flex flex-col justify-between group';
    card.tabIndex = 0; card.setAttribute('role', 'button');
    card.onclick = () => startQuiz(sub.id);
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startQuiz(sub.id); } };
    card.innerHTML = `
      <div class="space-y-4">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr ${sub.color} text-white flex items-center justify-center text-2xl shadow-md"><i class="fa-solid ${sub.icon}"></i></div>
        <div><h3 class="text-lg font-bold text-slate-900">${sub.name}</h3>
        <p class="text-xs text-slate-500 mt-1">${sub.count} سؤال</p></div>
      </div>
      <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-indigo-600 font-bold text-xs">
        <span>${st ? `أفضل نتيجة: ${st.best}%` : 'ابدأ الاختبار'}</span>
        <i class="fa-solid fa-arrow-left"></i>
      </div>`;
    grid.appendChild(card);
  });
  $('header-nav-btn').classList.add('hidden');
  show('home-view');
}
function returnToHome() { initHome(); }

// ===== الاختبار =====
async function startQuiz(id) {
  subject = SUBJECTS.find(s => s.id === id);
  try { questions = shuffle(await loadBank(id)).map(buildQ); }
  catch { alert('تعذّر تحميل أسئلة المادة. تحقق من الاتصال وأعد المحاولة.'); return; }
  begin();
}
function begin() {
  idx = 0; answers = {};
  $('current-subject-title').textContent = subject.name;
  $('current-subject-icon').className = `w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-white shadow bg-gradient-to-tr ${subject.color}`;
  $('current-subject-icon').innerHTML = `<i class="fa-solid ${subject.icon}"></i>`;
  $('total-q-label').textContent = $('total-q-num').textContent = questions.length;
  $('questions-navigator-bar').innerHTML = '';
  $('header-nav-btn').classList.remove('hidden');
  show('quiz-view');
  counters(); renderQuestion();
  window.scrollTo({ top: 0 });
}
function restartQuiz() { questions = shuffle(questions).map(q => buildQ({ q: q.text, opts: q.options, corr: q.correct, exp: q.exp })); begin(); }
function retryWrong() {
  const w = questions.filter((q, i) => answers[i] !== undefined && answers[i] !== q.correct);
  if (!w.length) return;
  questions = shuffle(w).map(q => buildQ({ q: q.text, opts: q.options, corr: q.correct, exp: q.exp }));
  begin();
}
function counters() {
  let c = 0, w = 0;
  for (const i in answers) answers[i] === questions[i].correct ? c++ : w++;
  $('live-correct-count').textContent = c; $('live-incorrect-count').textContent = w;
}
function renderQuestion() {
  const q = questions[idx], done = answers[idx] !== undefined;
  $('current-q-num').textContent = idx + 1;
  $('question-text').textContent = q.text;
  const box = $('options-container'); box.innerHTML = '';
  q.options.forEach((opt, i) => {
    const b = document.createElement('button');
    let cls = 'w-full text-right p-4 rounded-2xl border font-semibold text-sm md:text-base transition duration-200 flex items-center justify-between gap-3 ';
    let icon = '';
    if (done) {
      b.disabled = true;
      if (i === q.correct) { cls += 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'; icon = '<i class="fa-solid fa-circle-check text-emerald-600 text-lg"></i>'; }
      else if (i === answers[idx]) { cls += 'bg-rose-50 border-rose-500 text-rose-800 shadow-sm ' + (reduceMotion ? '' : 'animate-shake'); icon = '<i class="fa-solid fa-circle-xmark text-rose-600 text-lg"></i>'; }
      else cls += 'bg-white border-slate-200 text-slate-500 opacity-60';
    } else {
      cls += 'bg-white border-slate-200 text-slate-700 hover:border-indigo-500 hover:bg-indigo-50/30 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600';
      b.onclick = () => selectAnswer(i);
    }
    b.className = cls;
    const span = document.createElement('span'); span.dir = 'auto'; span.textContent = opt;
    b.appendChild(span); b.insertAdjacentHTML('beforeend', icon);
    box.appendChild(b);
  });
  const ex = $('explanation');
  ex.classList.toggle('hidden', !(done && q.exp));
  ex.textContent = done && q.exp ? q.exp : '';
  $('prev-btn').disabled = idx === 0;
  $('next-btn').innerHTML = idx === questions.length - 1 ? 'إنهاء الاختبار <i class="fa-solid fa-flag-checkered"></i>' : 'التالي <i class="fa-solid fa-arrow-left"></i>';
  updateNavigator();
}
function selectAnswer(i) {
  if (answers[idx] !== undefined) return;
  answers[idx] = i;
  if (i === questions[idx].correct && !reduceMotion && settings.effects && window.confetti) confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
  counters(); renderQuestion();
}
function updateNavigator() {
  const bar = $('questions-navigator-bar');
  if (bar.children.length !== questions.length) {
    bar.innerHTML = '';
    questions.forEach((_, i) => { const b = document.createElement('button'); b.textContent = i + 1; b.onclick = () => goTo(i); bar.appendChild(b); });
  }
  const base = 'min-w-[2.5rem] h-10 px-3 rounded-xl font-bold text-sm transition flex items-center justify-center shrink-0 border ';
  questions.forEach((q, i) => {
    const a = answers[i];
    bar.children[i].className = base + (i === idx ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105'
      : a === undefined ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
      : a === q.correct ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300');
  });
  bar.children[idx]?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
}
function goTo(i) { idx = i; renderQuestion(); }
function nextQuestion() { idx < questions.length - 1 ? goTo(idx + 1) : showCompletion(); }
function prevQuestion() { if (idx > 0) goTo(idx - 1); }

// ===== النتيجة =====
function showCompletion() {
  const total = questions.length;
  const answered = Object.keys(answers).length;
  const correct = questions.filter((q, i) => answers[i] === q.correct).length;
  const wrong = answered - correct, pct = Math.round(correct / total * 100);
  $('final-total').textContent = total; $('final-correct').textContent = correct; $('final-wrong').textContent = wrong;
  $('final-percent').textContent = pct + '%';
  const skipped = total - answered;
  $('final-msg').textContent = (pct >= 90 ? 'نتيجة ممتازة، استمر على هذا المستوى.' : pct >= 70 ? 'نتيجة جيدة، راجع الأسئلة الخاطئة لتثبّت المعلومة.' : pct >= 50 ? 'أنت في منتصف الطريق، أعد الأسئلة الخاطئة حتى تتقنها.' : 'تحتاج مراجعة إضافية للمادة، ثم أعد المحاولة.')
    + (skipped ? ` لم تجب عن ${skipped} سؤال.` : '');
  $('retry-wrong-btn').classList.toggle('hidden', wrong === 0);
  const stats = store.get('stats', {});
  if (answered === total && subject) {
    const prev = stats[subject.id];
    stats[subject.id] = { best: Math.max(pct, prev ? prev.best : 0), last: pct, date: new Date().toISOString().slice(0, 10) };
    store.set('stats', stats);
  }
  renderWrongReview(); show('completion-view');
  window.scrollTo({ top: 0 });
}
function renderWrongReview() {
  const wrong = questions.map((q, i) => i).filter(i => answers[i] !== undefined && answers[i] !== questions[i].correct);
  const box = $('wrong-review');
  if (!Object.keys(answers).length) { box.innerHTML = '<div class="bg-slate-50 border border-slate-200 text-slate-600 rounded-2xl p-4 text-sm font-bold text-center">لم تُجب عن أي سؤال.</div>'; return; }
  if (!wrong.length) { box.innerHTML = '<div class="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-4 text-sm font-bold text-center"><i class="fa-solid fa-star ml-1"></i> ممتاز! لا توجد أي إجابة خاطئة.</div>'; return; }
  box.innerHTML = `<h4 class="text-lg font-black text-slate-900 flex items-center gap-2"><i class="fa-solid fa-circle-xmark text-rose-600"></i> الأسئلة التي أخطأت فيها (${wrong.length})</h4>` +
    wrong.map(i => { const q = questions[i]; return `
    <div class="bg-rose-50/40 border border-rose-100 rounded-2xl p-4 space-y-3">
      <div class="flex items-start gap-3"><span class="shrink-0 bg-rose-100 text-rose-700 text-xs font-black rounded-lg px-2.5 py-1">${i + 1}</span>
        <p class="font-bold text-slate-900 text-sm md:text-base leading-relaxed">${esc(q.text)}</p></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm font-semibold">
        <div class="bg-white border border-rose-300 text-rose-700 rounded-xl p-3"><span class="block text-xs opacity-70">إجابتك</span><span dir="auto">${esc(q.options[answers[i]])}</span></div>
        <div class="bg-white border border-emerald-300 text-emerald-700 rounded-xl p-3"><span class="block text-xs opacity-70">الإجابة الصحيحة</span><span dir="auto">${esc(q.options[q.correct])}</span></div>
      </div>${q.exp ? `<p class="text-xs text-slate-600 leading-relaxed">${esc(q.exp)}</p>` : ''}
    </div>`; }).join('');
}

// ===== التشغيل =====
document.addEventListener('keydown', e => {
  if (!$('login-view').classList.contains('hidden') || $('quiz-view').classList.contains('hidden')) return;
  if (e.key === 'ArrowLeft') nextQuestion();
  else if (e.key === 'ArrowRight') prevQuestion();
  else if (/^[1-4]$/.test(e.key) && questions[idx] && +e.key <= questions[idx].options.length) selectAnswer(+e.key - 1);
});
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('bound_device_code')) unlock();
  $('login-btn').addEventListener('click', doLogin);
  $('access-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  initHome();
});

// ===== الخيارات والوضع الليلي =====
let settings = Object.assign({ effects: true, font: 1 }, store.get('settings', {}));
const FONTS = [90, 100, 115, 130];
if (!FONTS[settings.font]) settings.font = 1;
const saveSettings = () => store.set('settings', settings);
function setSwitch(id, on) {
  const b = $(id);
  b.setAttribute('aria-checked', on);
  b.classList.toggle('bg-indigo-600', on); b.classList.toggle('bg-slate-300', !on);
  b.firstElementChild.style.transform = on ? 'translateX(-1.25rem)' : 'none';
}
function applyTheme(dark, persist) {
  document.documentElement.classList.toggle('dark', dark);
  $('theme-btn').innerHTML = `<i class="fa-solid ${dark ? 'fa-sun' : 'fa-moon'}"></i>`;
  $('theme-btn').setAttribute('aria-label', dark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي');
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0f172a' : '#4f46e5';
  setSwitch('sw-dark', dark);
  if (persist) try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
}
function applyFont() {
  document.documentElement.style.fontSize = FONTS[settings.font] + '%';
  $('font-label').textContent = FONTS[settings.font] + '%';
  $('font-minus').disabled = settings.font === 0;
  $('font-plus').disabled = settings.font === FONTS.length - 1;
}
function toggleMenu(open) {
  const m = $('options-menu');
  open = open ?? m.classList.contains('hidden');
  m.classList.toggle('hidden', !open);
  $('menu-btn').setAttribute('aria-expanded', open);
}
document.addEventListener('DOMContentLoaded', () => {
  const flip = () => applyTheme(!document.documentElement.classList.contains('dark'), true);
  applyTheme(document.documentElement.classList.contains('dark'), false);
  setSwitch('sw-effects', settings.effects); applyFont();
  $('theme-btn').onclick = $('sw-dark').onclick = flip;
  $('sw-effects').onclick = () => { settings.effects = !settings.effects; setSwitch('sw-effects', settings.effects); saveSettings(); };
  $('font-minus').onclick = () => { settings.font--; applyFont(); saveSettings(); };
  $('font-plus').onclick = () => { settings.font++; applyFont(); saveSettings(); };
  $('reset-progress').onclick = () => {
    if (confirm('سيتم مسح أفضل نتائجك في كل المواد. هل تريد المتابعة؟')) { store.set('stats', {}); initHome(); toggleMenu(false); }
  };
  $('menu-btn').onclick = e => { e.stopPropagation(); toggleMenu(); };
  document.addEventListener('click', e => { if (!$('options-menu').contains(e.target)) toggleMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleMenu(false); });
});
