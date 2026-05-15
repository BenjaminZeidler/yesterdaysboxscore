export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = 'scores-' + today;

    // Check cache first
    const cacheUrl = process.env.KV_REST_API_URL + '/get/' + cacheKey;
    const cacheRes = await fetch(cacheUrl, {
      headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN }
    });
    const cacheData = await cacheRes.json();

    if (cacheData.result) {
      return res.status(200).json(JSON.parse(cacheData.result));
    }

    // Not cached — call Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: req.body.messages,
      }),
    });

    const data = await response.json();

    // Cache for 23 hours
    await fetch(process.env.KV_REST_API_URL + '/set/' + cacheKey, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value: JSON.stringify(data), ex: 82800 }),
    });

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
