const MILESTONES    = [10, 50, 100, 500, 1000, 10000, 100000, 1000000];
const KST_OFFSET_MS = 9 * 3600 * 1000;

function getNextKSTMidnight() {
    const kstNow = Date.now() + KST_OFFSET_MS;
    return Math.floor(kstNow / 86400000) * 86400000 + 86400000 - KST_OFFSET_MS;
}

function getKSTDateString() {
    return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// 날짜 + 서버 시크릿 솔트로 히든 숫자 결정 (클라이언트에 노출 안 됨)
function getDailyHidden(date, salt) {
    const [y, m, d] = date.split('-').map(Number);
    let h = (y * 366 + m) * 31 + d;
    h = Math.imul(h ^ salt, 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    let n = (h % 1000) + 1;
    while (MILESTONES.includes(n)) n = (n % 1000) + 1;
    return n;
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
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        if (request.method !== 'POST' || url.pathname !== '/click') {
            return new Response('Not Found', { status: 404, headers: corsHeaders });
        }

        const { FIREBASE_DB_URL, FIREBASE_SECRET, HIDDEN_SALT } = env;
        const salt = parseInt(HIDDEN_SALT) || 0x1a2b3c4d;
        const sessionUrl = `${FIREBASE_DB_URL}/session.json?auth=${FIREBASE_SECRET}`;

        let retries = 10;
        while (retries-- > 0) {
            // ETag 기반 낙관적 잠금으로 원자적 증가
            const getRes = await fetch(sessionUrl, {
                headers: { 'X-Firebase-ETag': 'true' }
            });
            const etag    = getRes.headers.get('ETag');
            const session = await getRes.json();

            const now  = Date.now();
            const date = getKSTDateString();

            let newSession;
            if (!session?.resetAt || now >= session.resetAt) {
                newSession = { count: 1, resetAt: getNextKSTMidnight(), date };
            } else {
                newSession = { ...session, count: (session.count || 0) + 1, date };
            }

            const newCount = newSession.count;
            const hidden   = getDailyHidden(date, salt);

            // 조건부 쓰기 — 충돌 시 412 반환 → 재시도
            const putRes = await fetch(sessionUrl, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json', 'if-match': etag },
                body:    JSON.stringify(newSession),
            });

            if (putRes.status === 412) continue;
            if (!putRes.ok) {
                return new Response('Firebase error', { status: 500, headers: corsHeaders });
            }

            // 마일스톤 판별
            let milestone = null;
            let isHidden  = false;

            if (MILESTONES.includes(newCount)) {
                milestone = newCount;
            } else if (newCount === hidden) {
                milestone = 'hidden';
                isHidden  = true;
            }

            // 마일스톤 달성 시 '익명' 선점 (클라이언트가 덮어쓰기 가능)
            if (milestone !== null) {
                const key  = isHidden ? 'hidden' : milestone;
                const mUrl = `${FIREBASE_DB_URL}/milestones/${date}/${key}.json?auth=${FIREBASE_SECRET}`;
                const existsRes = await fetch(mUrl);
                if ((await existsRes.json()) === null) {
                    await fetch(mUrl, {
                        method:  'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({
                            name: '익명',
                            date: new Date(now).toLocaleDateString('ko-KR'),
                        }),
                    });
                }
            }

            return new Response(JSON.stringify({
                count:          newCount,
                milestone,
                isHidden,
                hiddenActualNum: isHidden ? hidden : null,
                date,
                resetAt:        newSession.resetAt,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response('Too many conflicts', { status: 409, headers: corsHeaders });
    }
};
