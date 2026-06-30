const MILESTONES    = [10, 50, 100, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 50000, 100000];
const KST_OFFSET_MS = 9 * 3600 * 1000;

function getNextKSTMidnight() {
    const kstNow = Date.now() + KST_OFFSET_MS;
    return Math.floor(kstNow / 86400000) * 86400000 + 86400000 - KST_OFFSET_MS;
}

function getKSTDateString() {
    return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function getDailyHidden(date, salt) {
    const [y, m, d] = date.split('-').map(Number);
    let h = (y * 366 + m) * 31 + d;
    h = Math.imul(h ^ salt, 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    let n = (h % 10000) + 1;
    while (MILESTONES.includes(n)) n = (n % 10000) + 1;
    return n;
}

function findMilestone(oldCount, newCount, hidden) {
    for (let i = oldCount + 1; i <= newCount; i++) {
        if (MILESTONES.includes(i)) return { milestone: i, isHidden: false };
        if (i === hidden)           return { milestone: 'hidden', isHidden: true };
    }
    return { milestone: null, isHidden: false };
}

const ALLOWED_ORIGINS = [
    'https://everclick.pages.dev',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
];

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';
        const corsOrigin = ALLOWED_ORIGINS.includes(origin)
            ? origin
            : 'https://everclick.pages.dev';

        const corsHeaders = {
            'Access-Control-Allow-Origin':  corsOrigin,
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Click-Token',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url  = new URL(request.url);
        const { FIREBASE_DB_URL, FIREBASE_SECRET, HIDDEN_SALT, ADMIN_KEY } = env;
        const salt = parseInt(HIDDEN_SALT) || 0x1a2b3c4d;

        // ── 관리자 전용: 오늘의 히든 숫자 확인 ──
        if (request.method === 'GET' && url.pathname === '/admin') {
            if (!ADMIN_KEY || url.searchParams.get('key') !== ADMIN_KEY) {
                return new Response('Unauthorized', { status: 401 });
            }
            const date   = getKSTDateString();
            const hidden = getDailyHidden(date, salt);
            return new Response(JSON.stringify({ date, hidden }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (request.method !== 'POST' || url.pathname !== '/click') {
            return new Response('Not Found', { status: 404, headers: corsHeaders });
        }

        // 요청 토큰 검증 (직접 호출 차단)
        const { REQUEST_TOKEN } = env;
        if (REQUEST_TOKEN && request.headers.get('X-Click-Token') !== REQUEST_TOKEN) {
            return new Response('Forbidden', { status: 403, headers: corsHeaders });
        }

        // 배치 클릭 수 (최대 10)
        let clickCount = 1;
        try {
            const body = await request.json();
            clickCount = Math.max(1, Math.min(parseInt(body.count) || 1, 10));
        } catch {}

        const sessionUrl = `${FIREBASE_DB_URL}/session.json?auth=${FIREBASE_SECRET}`;

        let retries = 10;
        while (retries-- > 0) {
            const getRes = await fetch(sessionUrl, {
                headers: { 'X-Firebase-ETag': 'true' }
            });
            const etag    = getRes.headers.get('ETag');
            const session = await getRes.json();

            const now  = Date.now();
            const date = getKSTDateString();
            const hidden = getDailyHidden(date, salt);

            let newSession;
            let oldCount;
            if (!session?.resetAt || now >= session.resetAt) {
                oldCount   = 0;
                newSession = { count: clickCount, resetAt: getNextKSTMidnight(), date };
            } else {
                oldCount   = session.count || 0;
                newSession = { ...session, count: oldCount + clickCount, date };
            }

            const putRes = await fetch(sessionUrl, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json', 'if-match': etag },
                body:    JSON.stringify(newSession),
            });

            if (putRes.status === 412) continue;
            if (!putRes.ok) {
                return new Response('Firebase error', { status: 500, headers: corsHeaders });
            }

            const { milestone, isHidden } = findMilestone(oldCount, newSession.count, hidden);

            if (milestone !== null) {
                const key  = isHidden ? 'hidden' : milestone;
                const mUrl = `${FIREBASE_DB_URL}/milestones/${date}/${key}.json?auth=${FIREBASE_SECRET}`;
                const existsRes = await fetch(mUrl);
                if ((await existsRes.json()) === null) {
                    const entry = {
                        name: '익명',
                        date: new Date(now).toLocaleDateString('ko-KR'),
                    };
                    if (isHidden) entry.hiddenNum = hidden;
                    await fetch(mUrl, {
                        method:  'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify(entry),
                    });
                }
            }

            // 국가별 클릭 집계 (통계용, best-effort)
            try {
                const country = ((request.cf?.country) || 'XX').toUpperCase().slice(0, 2);
                const cUrl = `${FIREBASE_DB_URL}/countries/${date}/${country}.json?auth=${FIREBASE_SECRET}`;
                const cRes  = await fetch(cUrl);
                const cCount = (await cRes.json()) || 0;
                await fetch(cUrl, {
                    method:  'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(cCount + clickCount),
                });
            } catch {}

            return new Response(JSON.stringify({
                count:           newSession.count,
                milestone,
                isHidden,
                hiddenActualNum: isHidden ? hidden : null,
                date,
                resetAt:         newSession.resetAt,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response('Too many conflicts', { status: 409, headers: corsHeaders });
    }
};
