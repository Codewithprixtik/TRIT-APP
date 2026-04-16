// Netlify Function — Upstox Market Data Proxy
// Keys stored securely in Netlify Environment Variables

const API_KEY    = process.env.UPSTOX_API_KEY;
const API_SECRET = process.env.UPSTOX_API_SECRET;

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin' : '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!API_KEY || !API_SECRET) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'API keys not configured' }) };
    }

    const params = event.queryStringParameters || {};
    const action = params.action;

    // ── Auth URL ──
    if (action === 'authurl') {
        const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${API_KEY}&redirect_uri=${encodeURIComponent('https://thatrookieindiantrader.in/callback')}`;
        return { statusCode: 200, headers, body: JSON.stringify({ url }) };
    }

    // ── OAuth Token Exchange ──
    if (action === 'token') {
        const code = params.code;
        if (!code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No code' }) };
        try {
            const resp = await fetch('https://api.upstox.com/v2/login/authorization/token', {
                method : 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body   : new URLSearchParams({
                    code,
                    client_id    : API_KEY,
                    client_secret: API_SECRET,
                    redirect_uri : 'https://thatrookieindiantrader.in/callback',
                    grant_type   : 'authorization_code',
                }),
            });
            const data = await resp.json();
            return { statusCode: 200, headers, body: JSON.stringify(data) };
        } catch(e) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
        }
    }

    // ── Market Quotes ──
    if (action === 'quotes') {
        const token   = params.token;
        const symbols = params.symbols;
        if (!token || !symbols) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing params' }) };
        }
        try {
            const resp = await fetch(
                `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(symbols)}`,
                { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
            );
            const data = await resp.json();
            return { statusCode: 200, headers, body: JSON.stringify(data) };
        } catch(e) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
        }
    }

    // ── Historical Candles ──
    if (action === 'candles') {
        const token    = params.token;
        const symbol   = params.symbol   || 'NSE_EQ|INE002A01018';
        const interval = params.interval || '30minute';
        const toDate   = params.to   || new Date().toISOString().split('T')[0];
        const fromDate = params.from || new Date(Date.now()-30*86400000).toISOString().split('T')[0];
        if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No token' }) };
        try {
            const resp = await fetch(
                `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(symbol)}/${interval}/${toDate}/${fromDate}`,
                { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
            );
            const data = await resp.json();
            return { statusCode: 200, headers, body: JSON.stringify(data) };
        } catch(e) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
        }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
};
