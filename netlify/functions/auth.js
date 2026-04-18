const API_KEY = 'AIzaSyBIz6TlB-1yYKTEsifieGQ2gEIID3h7yxY';

exports.handler = async (event) => {
    const H = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) {}

    const ok  = d => ({ statusCode: 200, headers: H, body: JSON.stringify(d) });
    const err = m => ({ statusCode: 200, headers: H, body: JSON.stringify({ error: m }) });

    const fbCall = async (endpoint, payload) => {
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${API_KEY}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data;
    };

    const mapErr = m => {
        if (m.includes('EMAIL_EXISTS'))              return 'Email already registered. Please Login.';
        if (m.includes('INVALID_PASSWORD'))          return 'Wrong password. Try again.';
        if (m.includes('EMAIL_NOT_FOUND'))           return 'No account found. Please Sign Up first.';
        if (m.includes('INVALID_LOGIN_CREDENTIALS')) return 'Wrong email or password.';
        if (m.includes('WEAK_PASSWORD'))             return 'Password too weak (min 6 chars).';
        if (m.includes('TOO_MANY_ATTEMPTS'))         return 'Too many attempts. Try later.';
        return m;
    };

    try {
        const { action, email, password, idToken, refreshToken } = body;

        if (action === 'signup') {
            const d = await fbCall('signUp', { email, password, returnSecureToken: true });
            try { await fbCall('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: d.idToken }); } catch(e) {}
            return ok({ success: true, needsVerify: true });
        }

        if (action === 'login') {
            const d = await fbCall('signInWithPassword', { email, password, returnSecureToken: true });
            const info = await fbCall('lookup', { idToken: d.idToken });
            const user = info.users?.[0];
            if (!user?.emailVerified) {
                return ok({ success: false, needsVerify: true, idToken: d.idToken });
            }
            return ok({ success: true, uid: d.localId, email: d.email, idToken: d.idToken, refreshToken: d.refreshToken });
        }

        if (action === 'resendVerify') {
            await fbCall('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken });
            return ok({ success: true });
        }

        if (action === 'forgotPassword') {
            await fbCall('sendOobCode', { requestType: 'PASSWORD_RESET', email });
            return ok({ success: true });
        }

        return err('Unknown action');

    } catch(e) {
        return err(mapErr(e.message || 'Server error'));
    }
};
