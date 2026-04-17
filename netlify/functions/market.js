// TRIT Market Proxy — Upstox + JSONBin Token Storage
// Token stored in JSONBin.io (free) — shared across all users

const API_KEY    = process.env.UPSTOX_API_KEY;
const API_SECRET = process.env.UPSTOX_API_SECRET;
const JSONBIN_KEY = process.env.JSONBIN_API_KEY || '';
const JSONBIN_BIN = process.env.JSONBIN_BIN_ID  || '';
const REDIRECT    = 'https://thatrookieindiantrader.in/callback';

exports.handler = async (event) => {
    const h = {
        'Access-Control-Allow-Origin' : '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:h, body:'' };

    const p  = event.queryStringParameters || {};
    const ac = p.action;

    // ── Auth URL ──
    if (ac === 'authurl') {
        const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT)}`;
        return { statusCode:200, headers:h, body:JSON.stringify({url}) };
    }

    // ── Token Exchange ──
    if (ac === 'token') {
        if (!p.code) return { statusCode:400, headers:h, body:JSON.stringify({error:'No code'}) };
        try {
            const r = await fetch('https://api.upstox.com/v2/login/authorization/token', {
                method:'POST',
                headers:{'Content-Type':'application/x-www-form-urlencoded'},
                body: new URLSearchParams({
                    code:p.code, client_id:API_KEY,
                    client_secret:API_SECRET,
                    redirect_uri:REDIRECT, grant_type:'authorization_code'
                })
            });
            const d = await r.json();
            return { statusCode:200, headers:h, body:JSON.stringify(d) };
        } catch(e) { return { statusCode:500, headers:h, body:JSON.stringify({error:e.message}) }; }
    }

    // ── Save Token to JSONBin (Admin) ──
    if (ac === 'save_token') {
        const token = p.token;
        if (!token) return { statusCode:400, headers:h, body:JSON.stringify({error:'No token'}) };
        try {
            const exp = new Date(); exp.setHours(23,59,59,999);
            const payload = { token, savedAt:new Date().toISOString(), expiresAt:exp.getTime() };

            if (JSONBIN_BIN && JSONBIN_KEY) {
                await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN}`, {
                    method:'PUT',
                    headers:{'Content-Type':'application/json','X-Master-Key':JSONBIN_KEY,'X-Bin-Private':'false'},
                    body:JSON.stringify(payload)
                });
            }
            return { statusCode:200, headers:h, body:JSON.stringify({success:true}) };
        } catch(e) { return { statusCode:500, headers:h, body:JSON.stringify({error:e.message}) }; }
    }

    // ── Get Server Token from JSONBin ──
    if (ac === 'get_token') {
        try {
            if (!JSONBIN_BIN || !JSONBIN_KEY) {
                return { statusCode:404, headers:h, body:JSON.stringify({error:'JSONBin not configured'}) };
            }
            const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN}/latest`, {
                headers:{'X-Master-Key':JSONBIN_KEY}
            });
            const d = await r.json();
            const rec = d.record;
            if (!rec || !rec.token) return { statusCode:404, headers:h, body:JSON.stringify({error:'No token'}) };
            if (Date.now() > rec.expiresAt) return { statusCode:401, headers:h, body:JSON.stringify({error:'Token expired'}) };
            return { statusCode:200, headers:h, body:JSON.stringify({token:rec.token, savedAt:rec.savedAt}) };
        } catch(e) { return { statusCode:500, headers:h, body:JSON.stringify({error:e.message}) }; }
    }

    // ── Market Quotes (uses server token automatically) ──
    if (ac === 'quotes') {
        let token = '';
        // Get server token from JSONBin
        try {
            const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN}/latest`,{headers:{'X-Master-Key':JSONBIN_KEY}});
            const d = await r.json();
            if (d.record?.token && Date.now() < d.record.expiresAt) token = d.record.token;
        } catch(e) {}

        if (!token || !p.symbols) return { statusCode:400, headers:h, body:JSON.stringify({error:'No token or symbols'}) };
        try {
            const r = await fetch(`https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(p.symbols)}`,
                {headers:{'Authorization':`Bearer ${token}`,'Accept':'application/json'}});
            const d = await r.json();
            return { statusCode:200, headers:h, body:JSON.stringify(d) };
        } catch(e) { return { statusCode:500, headers:h, body:JSON.stringify({error:e.message}) }; }
    }

    // ── Historical Candles ──
    if (ac === 'candles') {
        let token = '';
        try {
            const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN}/latest`,{headers:{'X-Master-Key':JSONBIN_KEY}});
            const d = await r.json();
            if (d.record?.token && Date.now() < d.record.expiresAt) token = d.record.token;
        } catch(e) {}

        const sym  = p.symbol   || 'NSE_EQ|INE002A01018';
        const iv   = p.interval || 'day';
        const to   = p.to   || new Date().toISOString().split('T')[0];
        const from = p.from || new Date(Date.now()-30*86400000).toISOString().split('T')[0];
        if (!token) return { statusCode:400, headers:h, body:JSON.stringify({error:'No token'}) };
        try {
            const r = await fetch(`https://api.upstox.com/v2/historical-candle/${encodeURIComponent(sym)}/${iv}/${to}/${from}`,
                {headers:{'Authorization':`Bearer ${token}`,'Accept':'application/json'}});
            const d = await r.json();
            return { statusCode:200, headers:h, body:JSON.stringify(d) };
        } catch(e) { return { statusCode:500, headers:h, body:JSON.stringify({error:e.message}) }; }
    }

    return { statusCode:400, headers:h, body:JSON.stringify({error:'Unknown action'}) };
};
