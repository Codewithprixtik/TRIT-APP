// Simple test function to verify Netlify functions work
exports.handler = async (event) => {
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
            status: 'ok',
            node: process.version,
            hasFetch: typeof fetch !== 'undefined',
            time: new Date().toISOString()
        })
    };
};
