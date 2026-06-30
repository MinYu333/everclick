const MILESTONES    = [10, 50, 100, 500, 1000, 10000, 100000, 1000000];
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
    let n = (h % 1000) + 1;
    while (MILESTONES.includes(n)) n = (n % 1000) + 1;
    return n;
}

// oldCount+1 ~ newCount 범위에서 첫 번째 마일스톤 탐색
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

        // 배치 클릭 수 (최대 100)
        let clickCount = 1;
        try {
            const body = await request.json();
            clickCount = Math.max(1, Math.min(parseInt(body.count) || 1, 100));
        } catch {}

        const { FIREBASE_DB_URL, FIREBASE_SECRET, HIDDEN_SALT } = env;
        const salt = parseInt(HIDDEN_SALT) || 0x1a2b3c4d;
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
