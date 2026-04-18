const API_KEY = 'AIzaSyBIz6TlB-1yYKTEsifieGQ2gEIID3h7yxY';
const BASE    = 'https://identitytoolkit.googleapis.com/v1/accounts';
const H = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type', 'Content-Type':'application/json' };

const fb = async (endpoint, payload) => {
    const r = await fetch(`${BASE}:${endpoint}?key=${API_KEY}`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message || 'ERROR');
    return d;
};

const mapErr = (m) => {
    if (m.includes('EMAIL_EXISTS'))              return 'Email already registered. Please Login.';
    if (m.includes('INVALID_PASSWORD'))          return 'Wrong password. Try again.';
    if (m.includes('EMAIL_NOT_FOUND'))           return 'No account found. Please Sign Up first.';
    if (m.includes('INVALID_LOGIN_CREDENTIALS')) return 'Wrong email or password.';
    if (m.includes('WEAK_PASSWORD'))             return 'Password too weak (min 6 chars).';
    if (m.includes('TOO_MANY_ATTEMPTS'))         return 'Too many attempts. Try later.';
    if (m.includes('USER_DISABLED'))             return 'Account disabled.';
    return m;
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:H, body:'' };

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) {}

    const ok  = d => ({ statusCode:200, headers:H, body:JSON.stringify(d) });
    const err = m => ({ statusCode:200, headers:H, body:JSON.stringify({ error:m }) });

    try {
        const { action, email, password, idToken, refreshToken } = body;

        if (action === 'signup') {
            const d = await fb('signUp', { email, password, returnSecureToken:true });
            try { await fb('sendOobCode', { requestType:'VERIFY_EMAIL', idToken:d.idToken }); } catch(e){}
            return ok({ success:true, needsVerify:true });
        }

        if (action === 'login') {
            const d = await fb('signInWithPassword', { email, password, returnSecureToken:true });
            const info = await fb('lookup', { idToken:d.idToken });
            const user = info.users && info.users[0];
            if (!user || !user.emailVerified) {
                return ok({ success:false, needsVerify:true, idToken:d.idToken });
            }
            return ok({ success:true, uid:d.localId, email:d.email, idToken:d.idToken, refreshToken:d.refreshToken });
        }

        if (action === 'resendVerify') {
            await fb('sendOobCode', { requestType:'VERIFY_EMAIL', idToken });
            return ok({ success:true });
        }

        if (action === 'forgotPassword') {
            await fb('sendOobCode', { requestType:'PASSWORD_RESET', email });
            return ok({ success:true });
        }

        if (action === 'refresh') {
            const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({ grant_type:'refresh_token', refresh_token:refreshToken })
            });
            const d = await r.json();
            return ok({ idToken:d.id_token, refreshToken:d.refresh_token, uid:d.user_id });
        }

        return err('Unknown action');

    } catch(e) {
        return err(mapErr(e.message || 'Server error'));
    }
};
