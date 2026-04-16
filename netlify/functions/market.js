// Netlify Function — Market Data Proxy
// Upstox API v2 Integration
// IMPORTANT: Move API keys to Netlify Environment Variables after setup!

const API_KEY    = process.env.UPSTOX_API_KEY    || '4540a89a-adcd-45c5-8f68-a3cbca2e87c7';
const API_SECRET = process.env.UPSTOX_API_SECRET || 'lbtvpak4cu';

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin' : '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const params = event.queryStringParameters || {};
    const action = params.action;

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

    // ── Market Quotes (requires access token) ──
    if (action === 'quotes') {
        const token   = params.token;
        const symbols = params.symbols; // e.g. "NSE_EQ|INE002A01018,NSE_EQ|INE009A01021"
        if (!token || !symbols) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing token or symbols' }) };
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
        const symbol   = params.symbol  || 'NSE_EQ|INE002A01018';
        const interval = params.interval || '30minute';
        const toDate   = params.to   || new Date().toISOString().split('T')[0];
        const fromDate = params.from || new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
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

    // ── Auth URL ──
    if (action === 'authurl') {
        const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${API_KEY}&redirect_uri=${encodeURIComponent('https://thatrookieindiantrader.in/callback')}`;
        return { statusCode: 200, headers, body: JSON.stringify({ url }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
};
