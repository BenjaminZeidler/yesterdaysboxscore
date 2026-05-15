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
      headers: { Authorization: 'Bearer ' + process.env.KV_R
