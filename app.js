import { db } from './firebase-config.js';
import {
    ref, runTransaction, onValue, set, get
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const MILESTONES    = [10, 50, 100, 500, 1_000, 10_000, 100_000, 1_000_000, 10_000_000];
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// ── 번역 ──
const LANG = {
    ko: {
        counterLabel:    '오늘의 누적 클릭 수',
        tagline:         '버튼을 눌러 함께 클릭의 역사를 만들어가세요',
        sectionTitle:    '명예의 전당',
        sectionDesc:     '특별한 순간의 주인공들',
        footerText:      'EveryClick © 2026 · 함께 만드는 클릭의 역사',
        mNumber:         n => `${n.toLocaleString('ko-KR')}번째`,
        mPending:        '주인공을 기다리는 중...',
        popupTitle:      '축하합니다!',
        popupMsgBefore:  '당신이 ',
        popupMsgAfter:   '번째 클릭의 주인공!',
        popupSub:        '닉네임을 남겨 명예의 전당에 올라가세요',
        placeholder:     '닉네임 (최대 15자)',
        btnRegister:     '등록하기',
        btnPass:         '건너뛰기',
        countdownSuffix: '후 초기화',
        countdownInit:   '--:--:-- 후 초기화',
        resetting:       '초기화 중...',
        langBtn:         'EN',
    },
    en: {
        counterLabel:    "Today's Total Clicks",
        tagline:         'Press the button and make click history together',
        sectionTitle:    'Hall of Fame',
        sectionDesc:     'Stars of special moments',
        footerText:      'EveryClick © 2026 · Making click history together',
        mNumber:         n => `No. ${n.toLocaleString('en-US')}`,
        mPending:        'Waiting for a champion...',
        popupTitle:      'Congratulations!',
        popupMsgBefore:  "You're No. ",
        popupMsgAfter:   '!',
        popupSub:        'Leave your nickname to enter the Hall of Fame',
        placeholder:     'Nickname (max 15 chars)',
        btnRegister:     'Register',
        btnPass:         'Skip',
        countdownSuffix: 'until reset',
        countdownInit:   '--:--:-- until reset',
        resetting:       'Resetting...',
        langBtn:         '한국어',
    }
};

let currentLang = 'ko';
const t = () => LANG[currentLang];

// ── DOM ──
const totalCountEl   = document.getElementById('total-count');
const countdownEl    = document.getElementById('countdown');
const clickBtn       = document.getElementById('click-btn');
const popupOverlay   = document.getElementById('popup-overlay');
const popupNumEl     = document.getElementById('popup-milestone-num');
const popupMsgBefore = document.getElementById('popup-msg-before');
const popupMsgAfter  = document.getElementById('popup-msg-after');
const nicknameInput  = document.getElementById('nickname-input');
const btnRegister    = document.getElementById('btn-register');
const btnPass        = document.getElementById('btn-pass');
const milestonesGrid = document.getElementById('milestones-grid');
const langBtnEl      = document.getElementById('lang-btn');

const sessionRef = ref(db, 'session');

let currentMilestone       = null;
let isProcessing           = false;
let nextResetAt            = null;
let countdownInterval      = null;
let currentDate            = null;
let milestoneUnsubscribers = [];
const milestoneData        = {}; // 달성된 마일스톤 데이터 캐시

// ── KST 헬퍼 ──
function getNextKSTMidnight() {
    const kstNow           = Date.now() + KST_OFFSET_MS;
    const kstMidnightToday = Math.floor(kstNow / 86_400_000) * 86_400_000;
    return kstMidnightToday + 86_400_000 - KST_OFFSET_MS;
}

function getKSTDateString() {
    return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// ── 언어 전환 ──
function applyLanguage() {
    const l = t();
    document.getElementById('counter-label').textContent = l.counterLabel;
    document.getElementById('tagline').textContent       = l.tagline;
    document.getElementById('section-title').textContent = l.sectionTitle;
    document.getElementById('section-desc').textContent  = l.sectionDesc;
    document.getElementById('footer-text').textContent   = l.footerText;
    document.getElementById('popup-title').textContent   = l.popupTitle;
    document.getElementById('popup-sub').textContent     = l.popupSub;
    popupMsgBefore.textContent  = l.popupMsgBefore;
    popupMsgAfter.textContent   = l.popupMsgAfter;
    nicknameInput.placeholder   = l.placeholder;
    btnRegister.textContent     = l.btnRegister;
    btnPass.textContent         = l.btnPass;
    langBtnEl.textContent       = l.langBtn;
    rerenderMilestoneCards();
    tickCountdown();
}

langBtnEl.addEventListener('click', () => {
    currentLang = currentLang === 'ko' ? 'en' : 'ko';
    applyLanguage();
});

// ── 마일스톤 카드 ──
function initMilestoneCards() {
    MILESTONES.forEach(m => {
        const card = document.createElement('div');
        card.id        = `card-${m}`;
        card.className = 'milestone-card';
        milestonesGrid.appendChild(card);
    });
    rerenderMilestoneCards();
}

function rerenderMilestoneCards() {
    MILESTONES.forEach(m => {
        const data = milestoneData[m];
        if (data) {
            renderAchievedCard(m, data);
        } else {
            const card = document.getElementById(`card-${m}`);
            if (!card) return;
            card.className = 'milestone-card';
            card.innerHTML = `
                <span class="m-icon">🔒</span>
                <div class="m-number">${t().mNumber(m)}</div>
                <div class="m-pending">${t().mPending}</div>
            `;
        }
    });
}

function setupMilestoneListeners(date) {
    milestoneUnsubscribers.forEach(unsub => unsub());
    milestoneUnsubscribers = [];
    MILESTONES.forEach(m => delete milestoneData[m]);
    rerenderMilestoneCards();

    MILESTONES.forEach(m => {
        const unsub = onValue(ref(db, `milestones/${date}/${m}`), snapshot => {
            if (snapshot.exists()) {
                milestoneData[m] = snapshot.val();
                renderAchievedCard(m, snapshot.val());
            }
        });
        milestoneUnsubscribers.push(unsub);
    });
}

function renderAchievedCard(milestone, data) {
    const card = document.getElementById(`card-${milestone}`);
    if (!card) return;
    card.className = 'milestone-card achieved';
    card.innerHTML = `
        <span class="m-icon">🏆</span>
        <div class="m-number">${t().mNumber(milestone)}</div>
        <div class="m-name">${escapeHtml(data.name)}</div>
        <div class="m-date">${data.date}</div>
    `;
}

// ── 세션 실시간 반영 ──
onValue(sessionRef, snapshot => {
    const session = snapshot.val();
    const count   = session?.count   ?? 0;
    const resetAt = session?.resetAt ?? getNextKSTMidnight();
    const date    = session?.date    ?? getKSTDateString();

    const formatted = count.toLocaleString('ko-KR');
    if (totalCountEl.textContent !== formatted) {
        totalCountEl.textContent = formatted;
        totalCountEl.classList.remove('bump');
        void totalCountEl.offsetWidth;
        totalCountEl.classList.add('bump');
    }

    if (date !== currentDate) {
        currentDate = date;
        setupMilestoneListeners(date);
    }

    nextResetAt = resetAt;
    if (!countdownInterval) {
        tickCountdown();
        countdownInterval = setInterval(tickCountdown, 1000);
    }
});

// ── 카운트다운 ──
function tickCountdown() {
    if (!nextResetAt) return;
    const remaining = nextResetAt - Date.now();

    if (remaining <= 0) {
        countdownEl.textContent = t().resetting;
        return;
    }

    const h   = Math.floor(remaining / 3_600_000);
    const m   = Math.floor((remaining % 3_600_000) / 60_000);
    const s   = Math.floor((remaining % 60_000) / 1_000);
    const pad = n => String(n).padStart(2, '0');
    countdownEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)} ${t().countdownSuffix}`;
}

// ── 버튼 클릭 ──
clickBtn.addEventListener('click', async e => {
    if (isProcessing) return;
    isProcessing = true;

    clickBtn.classList.add('pressing');
    setTimeout(() => clickBtn.classList.remove('pressing'), 160);
    spawnRipple(e);

    try {
        const result = await runTransaction(sessionRef, session => {
            const now     = Date.now();
            const resetAt = session?.resetAt;

            if (!resetAt || now >= resetAt) {
                return { count: 1, resetAt: getNextKSTMidnight(), date: getKSTDateString() };
            }
            return { resetAt: session.resetAt, date: session.date, count: (session.count ?? 0) + 1 };
        });

        const snap     = result.snapshot.val();
        const newCount = snap?.count;
        const date     = snap?.date ?? getKSTDateString();

        if (MILESTONES.includes(newCount)) {
            currentMilestone = newCount;
            const mRef = ref(db, `milestones/${date}/${newCount}`);
            set(mRef, { name: '익명', date: new Date().toLocaleDateString('ko-KR') });
            openPopup(newCount);
        }
    } catch (err) {
        console.error('클릭 처리 실패:', err);
    } finally {
        isProcessing = false;
    }
});

function spawnRipple(e) {
    const rect   = clickBtn.getBoundingClientRect();
    const size   = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className    = 'ripple';
    ripple.style.width  = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left   = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top    = `${e.clientY - rect.top  - size / 2}px`;
    clickBtn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

// ── 팝업 ──
function openPopup(milestone) {
    popupNumEl.textContent = milestone.toLocaleString(currentLang === 'ko' ? 'ko-KR' : 'en-US');
    popupMsgBefore.textContent = t().popupMsgBefore;
    popupMsgAfter.textContent  = t().popupMsgAfter;
    nicknameInput.value        = '';
    nicknameInput.classList.remove('error');
    popupOverlay.hidden        = false;
    setTimeout(() => nicknameInput.focus(), 350);
}

function closePopup() {
    popupOverlay.hidden = true;
    currentMilestone    = null;
}

btnRegister.addEventListener('click', async () => {
    const name = nicknameInput.value.trim();
    if (!name) {
        nicknameInput.classList.add('error');
        nicknameInput.focus();
        nicknameInput.addEventListener('animationend', () => {
            nicknameInput.classList.remove('error');
        }, { once: true });
        return;
    }
    if (!currentMilestone) return;

    const date = currentDate ?? getKSTDateString();
    const mRef = ref(db, `milestones/${date}/${currentMilestone}`);
    await set(mRef, { name, date: new Date().toLocaleDateString('ko-KR') });
    closePopup();
});

btnPass.addEventListener('click', closePopup);

nicknameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnRegister.click();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !popupOverlay.hidden) closePopup();
});

function escapeHtml(text) {
    const el = document.createElement('div');
    el.appendChild(document.createTextNode(String(text)));
    return el.innerHTML;
}

initMilestoneCards();
