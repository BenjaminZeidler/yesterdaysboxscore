export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = 'scores-' + today;
    const r = await fetch(process.env.KV_REST_API_URL + '/get/' + cacheKey, {
      headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN }
    });
    const json = await r.json();
    if (json.result) {
      return res.status(200).json(JSON.parse(json.result));
    }
    return res.status(200).json({ status: 'loading', message: 'Scores not yet available. Check back soon.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
