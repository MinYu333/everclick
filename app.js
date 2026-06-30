import { db } from './firebase-config.js';
import {
    ref, onValue, set, get
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const WORKER_URL   = 'https://everclick-worker.ck08273.workers.dev';
const CLICK_TOKEN  = '_8EXouDjl8SYdjV9AHOP13p7tw8zQ8u2';

const MILESTONES    = [10, 50, 100, 500, 1_000, 2_000, 3_000, 4_000, 5_000, 6_000, 7_000, 8_000, 9_000, 10_000, 100_000, 1_000_000];
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 마일스톤별 티어 색상
const MILESTONE_COLORS = {
    10:        'var(--primary)',
    50:        '#60a5fa',
    100:       '#34d399',
    500:       '#fbbf24',
    1000:      '#f97316',
    2000:      '#fb923c',
    3000:      '#4ade80',
    4000:      '#22d3ee',
    5000:      '#f472b6',
    6000:      '#818cf8',
    7000:      '#2dd4bf',
    8000:      '#eab308',
    9000:      '#ef4444',
    10000:     '#f43f5e',
    100000:    '#e879f9',
    1000000:   '#c084fc',
};

function getMilestoneColor(m) {
    return MILESTONE_COLORS[m] || 'var(--primary)';
}

// ── 번역 ──
const LANG = {
    ko: {
        counterLabel:        '오늘의 누적 클릭 수',
        tagline:             '버튼을 눌러 함께 클릭의 역사를 만들어가세요',
        sectionTitle:        '명예의 전당',
        sectionDesc:         '특별한 순간의 주인공들',
        footerText:          'EveryClick © 2026 · 함께 만드는 클릭의 역사',
        mNumber:             n => `${n.toLocaleString('ko-KR')}번째`,
        mPending:            '주인공을 기다리는 중...',
        popupTitle:          '축하합니다!',
        popupMsgBefore:      '당신이 ',
        popupMsgAfter:       '번째 클릭의 주인공!',
        popupMsgAfterHidden: '번째 히든 마일스톤의 주인공!',
        popupSub:            '닉네임을 남겨 명예의 전당에 올라가세요',
        placeholder:         '닉네임 (최대 15자)',
        btnRegister:         '등록하기',
        btnPass:             '건너뛰기',
        countdownSuffix:     '후 초기화',
        countdownInit:       '--:--:-- 후 초기화',
        resetting:           '초기화 중...',
        langBtn:             'EN',
        howToTitle:          '사용 방법',
        howToDesc:           '간단하게 참여해보세요',
        step1Title:          '버튼 클릭',
        step1Desc:           '화면 중앙의 버튼을 눌러 전체 클릭 수에 1을 더하세요.',
        step2Title:          '실시간 공유',
        step2Desc:           '전 세계 모든 방문자의 클릭이 실시간으로 합산됩니다.',
        step3Title:          '주인공 등극',
        step3Desc:           '특별한 클릭을 달성하면 명예의 전당에 이름이 올라가요.',
        step4Title:          '히든 마일스톤',
        step4Desc:           '매일 바뀌는 비밀 숫자를 맞히면 무지개 이름으로 명예의 전당에 오릅니다!',
        faqTitle:            '자주 묻는 질문',
        faq1q:               '클릭 수는 언제 초기화되나요?',
        faq1a:               '한국 시간(KST) 기준 매일 자정 00:00에 초기화됩니다. 화면에 남은 시간이 카운트다운으로 표시됩니다.',
        faq2q:               '명예의 전당이 뭔가요?',
        faq2a:               '10, 50, 100, 500번째 등 특별한 클릭을 달성한 분의 닉네임이 기록되는 공간입니다. 매일 초기화됩니다.',
        faq3q:               '여러 번 클릭해도 되나요?',
        faq3a:               '제한 없이 클릭할 수 있어요. 함께 숫자를 쌓아가는 것이 목표입니다.',
        faq4q:               '닉네임을 입력하지 않으면 어떻게 되나요?',
        faq4a:               '건너뛰거나 창을 닫으면 자동으로 "익명"으로 기록됩니다.',
        privacyLink:         '개인정보처리방침',
        contactLink:         '문의하기',
        hiddenLabel:         '???번째',
        hiddenPending:       '히든 마일스톤을 노려보세요!',
        hiddenAchieved:      n => `${n.toLocaleString('ko-KR')}번째 히든 마일스톤`,
        countryTitle:        '국가별 클릭 순위',
        countryDesc:         '오늘 함께 클릭한 나라들',
        countryEmpty:        '아직 데이터가 없어요',
    },
    en: {
        counterLabel:        "Today's Total Clicks",
        tagline:             'Press the button and make click history together',
        sectionTitle:        'Hall of Fame',
        sectionDesc:         'Stars of special moments',
        footerText:          'EveryClick © 2026 · Making click history together',
        mNumber:             n => `No. ${n.toLocaleString('en-US')}`,
        mPending:            'Waiting for a champion...',
        popupTitle:          'Congratulations!',
        popupMsgBefore:      "You're No. ",
        popupMsgAfter:       '!',
        popupMsgAfterHidden: ' Hidden Milestone!',
        popupSub:            'Leave your nickname to enter the Hall of Fame',
        placeholder:         'Nickname (max 15 chars)',
        btnRegister:         'Register',
        btnPass:             'Skip',
        countdownSuffix:     'until reset',
        countdownInit:       '--:--:-- until reset',
        resetting:           'Resetting...',
        langBtn:             '한국어',
        howToTitle:          'How to Use',
        howToDesc:           'Join in just a few steps',
        step1Title:          'Click the Button',
        step1Desc:           'Press the button in the center to add 1 to the total click count.',
        step2Title:          'Shared in Real Time',
        step2Desc:           'Clicks from all visitors around the world are tallied instantly.',
        step3Title:          'Become the Star',
        step3Desc:           'Hit a special milestone and your name enters the Hall of Fame.',
        step4Title:          'Hidden Milestone',
        step4Desc:           'Find the secret daily number and your name shines in rainbow in the Hall of Fame!',
        faqTitle:            'FAQ',
        faq1q:               'When does the count reset?',
        faq1a:               'The count resets every day at midnight Korean Standard Time (KST). A countdown timer on screen shows the time remaining.',
        faq2q:               'What is the Hall of Fame?',
        faq2a:               'It records the nickname of whoever achieves a special milestone — 10th, 50th, 100th, 500th, and more. It resets daily.',
        faq3q:               'Can I click more than once?',
        faq3a:               'Absolutely! There are no limits. The goal is to build the number together.',
        faq4q:               'What if I skip entering a nickname?',
        faq4a:               'If you skip or close the popup, you will be recorded as "익명" (Anonymous) automatically.',
        privacyLink:         'Privacy Policy',
        contactLink:         'Contact',
        hiddenLabel:         '??? th',
        hiddenPending:       'Can you find the hidden milestone?',
        hiddenAchieved:      n => `No. ${n.toLocaleString('en-US')} Hidden Milestone`,
        countryTitle:        'Clicks by Country',
        countryDesc:         'Countries clicking together today',
        countryEmpty:        'No data yet',
    }
};

let currentLang = 'ko';
const t = () => LANG[currentLang];

// ── DOM ──
const totalCountEl    = document.getElementById('total-count');
const countdownEl     = document.getElementById('countdown');
const clickBtn        = document.getElementById('click-btn');
const popupOverlay    = document.getElementById('popup-overlay');
const popupNumEl      = document.getElementById('popup-milestone-num');
const popupMsgBefore  = document.getElementById('popup-msg-before');
const popupMsgAfter   = document.getElementById('popup-msg-after');
const nicknameInput   = document.getElementById('nickname-input');
const btnRegister     = document.getElementById('btn-register');
const btnPass         = document.getElementById('btn-pass');
const milestonesGrid  = document.getElementById('milestones-grid');
const hiddenTop       = document.getElementById('hidden-top');
const langBtnEl       = document.getElementById('lang-btn');
const countryListEl   = document.getElementById('country-list');

const sessionRef = ref(db, 'session');

let currentMilestone       = null;
let isProcessing           = false;
let pendingClicks          = 0;
let pressingTimeout        = null;
let latestServerCount      = 0;
let nextResetAt            = null;
let countdownInterval      = null;
let currentDate            = null;
let milestoneUnsubscribers = [];
const milestoneData        = {};
let countryUnsubscriber    = null;
let countryData            = null;

// ── KST 헬퍼 ──
function getKSTDateString() {
    return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function getNextKSTMidnight() {
    const kstNow = Date.now() + KST_OFFSET_MS;
    return Math.floor(kstNow / 86_400_000) * 86_400_000 + 86_400_000 - KST_OFFSET_MS;
}

// ── 국가 헬퍼 ──
const COUNTRY_NAMES = {
    KR: { ko: '대한민국', en: 'South Korea' },
    US: { ko: '미국',     en: 'United States' },
    JP: { ko: '일본',     en: 'Japan' },
    CN: { ko: '중국',     en: 'China' },
    TW: { ko: '대만',     en: 'Taiwan' },
    HK: { ko: '홍콩',     en: 'Hong Kong' },
    SG: { ko: '싱가포르', en: 'Singapore' },
    VN: { ko: '베트남',   en: 'Vietnam' },
    TH: { ko: '태국',     en: 'Thailand' },
    PH: { ko: '필리핀',   en: 'Philippines' },
    ID: { ko: '인도네시아', en: 'Indonesia' },
    MY: { ko: '말레이시아', en: 'Malaysia' },
    IN: { ko: '인도',     en: 'India' },
    CA: { ko: '캐나다',   en: 'Canada' },
    AU: { ko: '호주',     en: 'Australia' },
    NZ: { ko: '뉴질랜드', en: 'New Zealand' },
    GB: { ko: '영국',     en: 'United Kingdom' },
    DE: { ko: '독일',     en: 'Germany' },
    FR: { ko: '프랑스',   en: 'France' },
    IT: { ko: '이탈리아', en: 'Italy' },
    ES: { ko: '스페인',   en: 'Spain' },
    NL: { ko: '네덜란드', en: 'Netherlands' },
    BE: { ko: '벨기에',   en: 'Belgium' },
    CH: { ko: '스위스',   en: 'Switzerland' },
    AT: { ko: '오스트리아', en: 'Austria' },
    SE: { ko: '스웨덴',   en: 'Sweden' },
    NO: { ko: '노르웨이', en: 'Norway' },
    DK: { ko: '덴마크',   en: 'Denmark' },
    FI: { ko: '핀란드',   en: 'Finland' },
    PL: { ko: '폴란드',   en: 'Poland' },
    RU: { ko: '러시아',   en: 'Russia' },
    UA: { ko: '우크라이나', en: 'Ukraine' },
    BR: { ko: '브라질',   en: 'Brazil' },
    MX: { ko: '멕시코',   en: 'Mexico' },
    AR: { ko: '아르헨티나', en: 'Argentina' },
    TR: { ko: '터키',     en: 'Turkey' },
    SA: { ko: '사우디아라비아', en: 'Saudi Arabia' },
    AE: { ko: '아랍에미리트', en: 'UAE' },
    ZA: { ko: '남아프리카', en: 'South Africa' },
};

function getFlag(code) {
    if (!code || code.length !== 2 || code === 'XX') return '🏳️';
    return [...code.toUpperCase()].map(c =>
        String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))
    ).join('');
}

function getCountryName(code) {
    return COUNTRY_NAMES[code]?.[currentLang] || code;
}

function renderCountryList() {
    if (!countryListEl) return;
    if (!countryData || Object.keys(countryData).length === 0) {
        countryListEl.innerHTML = `<p class="country-empty">${t().countryEmpty}</p>`;
        return;
    }
    const entries = Object.entries(countryData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    const max = entries[0]?.[1] || 1;
    countryListEl.innerHTML = entries.map(([code, count], i) => {
        const pct = Math.round((count / max) * 100);
        return `
            <div class="country-row">
                <span class="c-rank">${i + 1}</span>
                <span class="c-flag">${getFlag(code)}</span>
                <div class="c-info">
                    <div class="c-name">${escapeHtml(getCountryName(code))}</div>
                    <div class="c-bar-wrap"><div class="c-bar" style="width:${pct}%"></div></div>
                </div>
                <span class="c-count">${count.toLocaleString('ko-KR')}</span>
            </div>`;
    }).join('');
}

function setupCountryListener(date) {
    if (countryUnsubscriber) countryUnsubscriber();
    countryData = null;
    countryUnsubscriber = onValue(ref(db, `countries/${date}`), snap => {
        countryData = snap.val();
        renderCountryList();
    });
}

// ── 언어 전환 ──
function applyLanguage() {
    const l = t();
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (l[key] !== undefined) el.textContent = l[key];
    });
    nicknameInput.placeholder = l.placeholder;
    rerenderMilestoneCards();
    renderCountryList();
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
    // 히든 카드 (마지막)
    const hiddenCard = document.createElement('div');
    hiddenCard.id        = 'card-hidden';
    hiddenCard.className = 'milestone-card hidden-milestone';
    hiddenTop.appendChild(hiddenCard);

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
            const color = getMilestoneColor(m);
            card.className   = 'milestone-card';
            card.style.borderColor = '';
            card.innerHTML   = `
                <span class="m-icon">🔒</span>
                <div class="m-number" style="color:${color}">${t().mNumber(m)}</div>
                <div class="m-pending">${t().mPending}</div>
            `;
        }
    });
    // 히든 카드
    const hiddenData = milestoneData['hidden'];
    if (hiddenData) {
        renderAchievedCard('hidden', hiddenData);
    } else {
        const card = document.getElementById('card-hidden');
        if (card) {
            card.className = 'milestone-card hidden-milestone';
            card.innerHTML = `
                <span class="m-icon">🌈</span>
                <div class="m-number rainbow-text">${t().hiddenLabel}</div>
                <div class="m-pending">${t().hiddenPending}</div>
            `;
        }
    }
}

function renderAchievedCard(milestone, data) {
    const card = document.getElementById(`card-${milestone}`);
    if (!card) return;

    if (milestone === 'hidden') {
        const label = data.hiddenNum ? t().hiddenAchieved(data.hiddenNum) : t().hiddenLabel;
        card.className = 'milestone-card hidden-milestone achieved';
        card.innerHTML = `
            <span class="m-icon">🌈</span>
            <div class="m-number rainbow-text">${label}</div>
            <div class="m-name rainbow-name">${escapeHtml(data.name)}</div>
            <div class="m-date">${data.date}</div>
        `;
        return;
    }

    const color = getMilestoneColor(milestone);
    card.className         = 'milestone-card achieved';
    card.style.borderColor = color;
    card.innerHTML = `
        <span class="m-icon">🏆</span>
        <div class="m-number" style="color:${color}">${t().mNumber(milestone)}</div>
        <div class="m-name" style="color:${color}">${escapeHtml(data.name)}</div>
        <div class="m-date">${data.date}</div>
    `;
}

function setupMilestoneListeners(date) {
    milestoneUnsubscribers.forEach(unsub => unsub());
    milestoneUnsubscribers = [];
    MILESTONES.forEach(m => delete milestoneData[m]);
    delete milestoneData['hidden'];
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

    // 히든 마일스톤 리스너
    const unsubHidden = onValue(ref(db, `milestones/${date}/hidden`), snapshot => {
        if (snapshot.exists()) {
            milestoneData['hidden'] = snapshot.val();
            renderAchievedCard('hidden', snapshot.val());
        }
    });
    milestoneUnsubscribers.push(unsubHidden);
}

// ── 세션 실시간 반영 (읽기 전용) ──
onValue(sessionRef, snapshot => {
    const session = snapshot.val();
    const count   = session?.count   ?? 0;
    const resetAt = session?.resetAt ?? getNextKSTMidnight();
    const date    = session?.date    ?? getKSTDateString();

    latestServerCount = count;
    // 서버 카운트 + 아직 전송 안 된 클릭을 합산해 항상 반영 (다른 사람 클릭도 즉시 보임)
    const current   = parseInt(totalCountEl.textContent.replace(/,/g, '')) || 0;
    const displayed = Math.max(count + pendingClicks, current);
    const formatted = displayed.toLocaleString('ko-KR');
    if (totalCountEl.textContent !== formatted) {
        totalCountEl.textContent = formatted;
        totalCountEl.classList.remove('bump');
        void totalCountEl.offsetWidth;
        totalCountEl.classList.add('bump');
    }

    if (date !== currentDate) {
        currentDate = date;
        setupMilestoneListeners(date);
        setupCountryListener(date);
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
    if (remaining <= 0) { countdownEl.textContent = t().resetting; return; }
    const h   = Math.floor(remaining / 3_600_000);
    const m   = Math.floor((remaining % 3_600_000) / 60_000);
    const s   = Math.floor((remaining % 60_000) / 1_000);
    const pad = n => String(n).padStart(2, '0');
    countdownEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)} ${t().countdownSuffix}`;
}

// ── 버튼 클릭 → Worker 호출 ──
clickBtn.addEventListener('click', e => {
    clearTimeout(pressingTimeout);
    clickBtn.classList.remove('pressing');
    void clickBtn.offsetWidth; // 애니메이션 강제 재시작
    clickBtn.classList.add('pressing');
    pressingTimeout = setTimeout(() => clickBtn.classList.remove('pressing'), 160);
    spawnRipple(e);

    // 클릭 즉시 숫자 +1
    const current = parseInt(totalCountEl.textContent.replace(/,/g, '')) || 0;
    totalCountEl.textContent = (current + 1).toLocaleString('ko-KR');

    if (isProcessing) {
        pendingClicks++;
        return;
    }
    flushClick();
});

async function flushClick(count = 1) {
    isProcessing = true;
    try {
        const res = await fetch(`${WORKER_URL}/click`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'X-Click-Token': CLICK_TOKEN,
            },
            body: JSON.stringify({ count }),
        });
        if (!res.ok) throw new Error(`Worker ${res.status}`);

        const data = await res.json();
        latestServerCount = data.count; // Worker 응답에서 즉시 동기화
        const { milestone, isHidden, hiddenActualNum } = data;

        if (milestone !== null && milestone !== undefined) {
            currentMilestone = milestone;
            openPopup(isHidden ? hiddenActualNum : milestone, isHidden);
        }
    } catch (err) {
        console.error('클릭 처리 실패:', err);
    } finally {
        isProcessing = false;
        if (pendingClicks > 0) {
            const batch = pendingClicks;
            pendingClicks = 0;
            flushClick(batch);
        } else {
            // 모든 처리 완료 후 Firebase 실제값으로 동기화
            const formatted = latestServerCount.toLocaleString('ko-KR');
            if (totalCountEl.textContent !== formatted) {
                totalCountEl.textContent = formatted;
            }
        }
    }
}

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
function openPopup(milestone, isHidden) {
    const locale = currentLang === 'ko' ? 'ko-KR' : 'en-US';
    popupNumEl.textContent     = milestone.toLocaleString(locale);
    popupMsgBefore.textContent = t().popupMsgBefore;
    popupMsgAfter.textContent  = isHidden ? t().popupMsgAfterHidden : t().popupMsgAfter;
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

    const date  = currentDate ?? getKSTDateString();
    const key   = currentMilestone === 'hidden' ? 'hidden' : currentMilestone;
    const mRef  = ref(db, `milestones/${date}/${key}`);
    const entry = { name, date: new Date().toLocaleDateString('ko-KR') };
    if (currentMilestone === 'hidden') {
        const snap = await get(mRef);
        const hiddenNum = snap.val()?.hiddenNum;
        if (hiddenNum) entry.hiddenNum = hiddenNum;
    }
    await set(mRef, entry);
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
