// TRIT AI Analyst — Claude API proxy
exports.handler = async (event) => {
    const H = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) {}

    const { system, messages } = body;
    if (!messages || !messages.length) {
        return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'No messages' }) };
    }

    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': process.env.ANTHROPIC_API_KEY || ''
            },
            body: JSON.stringify({
                model     : 'claude-haiku-4-5-20251001',
                max_tokens: 800,
                system    : system || 'You are TRIT AI Analyst, an expert Indian stock market trading assistant.',
                messages  : messages
            })
        });

        const data = await res.json();
        if (data.error) return { statusCode: 200, headers: H, body: JSON.stringify({ error: data.error.message }) };

        const text = data.content && data.content[0] && data.content[0].text;
        return { statusCode: 200, headers: H, body: JSON.stringify({ text }) };
    } catch(e) {
        return { statusCode: 200, headers: H, body: JSON.stringify({ error: 'Server error: ' + e.message }) };
    }
};
