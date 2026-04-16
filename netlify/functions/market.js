// TRIT Market Data Proxy — Upstox API v2
// Server-side token system — users don't need to login!

const API_KEY    = process.env.UPSTOX_API_KEY;
const API_SECRET = process.env.UPSTOX_API_SECRET;
const ADMIN_PASS = process.env.TRIT_ADMIN_PASSWORD || 'trit2024admin';

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin' : '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode:200, headers, body:'' };
    }

    const params = event.queryStringParameters || {};
    const action = params.action;

    // ── Auth URL ──
    if (action === 'authurl') {
        if (!API_KEY) return { statusCode:500, headers, body: JSON.stringify({error:'API keys not configured'}) };
        const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${API_KEY}&redirect_uri=${encodeURIComponent('https://thatrookieindiantrader.in/callback')}`;
        return { statusCode:200, headers, body: JSON.stringify({url}) };
    }

    // ── Token Exchange ──
    if (action === 'token') {
        const code = params.code;
        if (!code) return { statusCode:400, headers, body: JSON.stringify({error:'No code'}) };
        try {
            const resp = await fetch('https://api.upstox.com/v2/login/authorization/token', {
                method : 'POST',
                headers: {'Content-Type':'application/x-www-form-urlencoded'},
                body   : new URLSearchParams({
                    code,
                    client_id    : API_KEY,
                    client_secret: API_SECRET,
                    redirect_uri : 'https://thatrookieindiantrader.in/callback',
                    grant_type   : 'authorization_code',
                }),
            });
            const data = await resp.json();
            return { statusCode:200, headers, body: JSON.stringify(data) };
        } catch(e) {
            return { statusCode:500, headers, body: JSON.stringify({error:e.message}) };
        }
    }

    // ── Save Server Token (Admin only) ──
    if (action === 'save_token') {
        const pass  = params.pass;
        const token = params.token;
        if (pass !== ADMIN_PASS) return { statusCode:403, headers, body: JSON.stringify({error:'Unauthorized'}) };
        if (!token) return { statusCode:400, headers, body: JSON.stringify({error:'No token'}) };
        try {
            const { getStore } = require('@netlify/blobs');
            const store = getStore('trit-tokens');
            await store.set('upstox_token', JSON.stringify({
                token,
                savedAt: new Date().toISOString(),
                expiresAt: new Date().setHours(23,59,59,999),
            }));
            return { statusCode:200, headers, body: JSON.stringify({success:true, message:'Token saved!'}) };
        } catch(e) {
            // Fallback if blobs not available
            return { statusCode:200, headers, body: JSON.stringify({success:true, token, message:'Token ready (blobs unavailable)'}) };
        }
    }

    // ── Get Server Token (for app to use) ──
    if (action === 'get_token') {
        try {
            const { getStore } = require('@netlify/blobs');
            const store = getStore('trit-tokens');
            const raw   = await store.get('upstox_token');
            if (!raw) return { statusCode:404, headers, body: JSON.stringify({error:'No token saved'}) };
            const data = JSON.parse(raw);
            // Check expiry
            if (Date.now() > data.expiresAt) {
                return { statusCode:401, headers, body: JSON.stringify({error:'Token expired'}) };
            }
            return { statusCode:200, headers, body: JSON.stringify({token: data.token, savedAt: data.savedAt}) };
        } catch(e) {
            return { statusCode:500, headers, body: JSON.stringify({error:e.message}) };
        }
    }

    // ── Market Quotes ──
    if (action === 'quotes') {
        let token = params.token;
        const symbols = params.symbols;

        // Try server token if no user token
        if (!token) {
            try {
                const { getStore } = require('@netlify/blobs');
                const store = getStore('trit-tokens');
                const raw   = await store.get('upstox_token');
                if (raw) {
                    const d = JSON.parse(raw);
                    if (Date.now() < d.expiresAt) token = d.token;
                }
            } catch(e) {}
        }

        if (!token || !symbols) return { statusCode:400, headers, body: JSON.stringify({error:'Missing params'}) };

        try {
            const resp = await fetch(
                `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(symbols)}`,
                { headers: {'Authorization':`Bearer ${token}`, 'Accept':'application/json'} }
            );
            const data = await resp.json();
            return { statusCode:200, headers, body: JSON.stringify(data) };
        } catch(e) {
            return { statusCode:500, headers, body: JSON.stringify({error:e.message}) };
        }
    }

    // ── Historical Candles ──
    if (action === 'candles') {
        let token = params.token;
        const symbol   = params.symbol   || 'NSE_EQ|INE002A01018';
        const interval = params.interval || 'day';
        const toDate   = params.to   || new Date().toISOString().split('T')[0];
        const fromDate = params.from || new Date(Date.now()-30*86400000).toISOString().split('T')[0];

        // Try server token
        if (!token) {
            try {
                const { getStore } = require('@netlify/blobs');
                const store = getStore('trit-tokens');
                const raw   = await store.get('upstox_token');
                if (raw) {
                    const d = JSON.parse(raw);
                    if (Date.now() < d.expiresAt) token = d.token;
                }
            } catch(e) {}
        }

        if (!token) return { statusCode:400, headers, body: JSON.stringify({error:'No token'}) };

        try {
            const resp = await fetch(
                `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(symbol)}/${interval}/${toDate}/${fromDate}`,
                { headers: {'Authorization':`Bearer ${token}`, 'Accept':'application/json'} }
            );
            const data = await resp.json();
            return { statusCode:200, headers, body: JSON.stringify(data) };
        } catch(e) {
            return { statusCode:500, headers, body: JSON.stringify({error:e.message}) };
        }
    }

    return { statusCode:400, headers, body: JSON.stringify({error:'Unknown action'}) };
};
        
