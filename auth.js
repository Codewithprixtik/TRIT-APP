// Firebase Auth Proxy — avoids CDN blocking issues
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const API_KEY = 'AIzaSyBIz6TlB-1yYKTEsifieGQ2gEIID3h7yxY';

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin' : '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' };

    const { action, email, oobCode } = JSON.parse(event.body || '{}');

    // Send email sign-in link
    if (action === 'sendLink') {
        try {
            const res = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
                {
                    method : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body   : JSON.stringify({
                        requestType     : 'EMAIL_SIGNIN',
                        email,
                        continueUrl     : 'https://thatrookieindiantrader.in/app.html',
                        canHandleCodeInApp: true,
                    })
                }
            );
            const data = await res.json();
            if (data.error) return { statusCode:400, headers, body: JSON.stringify({ error: data.error.message }) };
            return { statusCode:200, headers, body: JSON.stringify({ success: true }) };
        } catch(e) {
            return { statusCode:500, headers, body: JSON.stringify({ error: e.message }) };
        }
    }

    // Verify email sign-in link
    if (action === 'verifyLink') {
        try {
            const res = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=${API_KEY}`,
                {
                    method : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body   : JSON.stringify({ email, oobCode })
                }
            );
            const data = await res.json();
            if (data.error) return { statusCode:400, headers, body: JSON.stringify({ error: data.error.message }) };
            return { statusCode:200, headers, body: JSON.stringify({ 
                idToken    : data.idToken,
                refreshToken: data.refreshToken,
                localId    : data.localId,
                email      : data.email,
            })};
        } catch(e) {
            return { statusCode:500, headers, body: JSON.stringify({ error: e.message }) };
        }
    }

    return { statusCode:400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
};
