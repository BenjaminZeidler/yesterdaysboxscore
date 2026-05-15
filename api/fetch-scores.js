export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yestStr = yesterday.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: 'You are a sports data API. You only respond with raw JSON objects. Never include explanations, apologies, or markdown. If you cannot find data for a sport, use an empty array. Always respond with valid JSON starting with { and ending with }.',
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: 'Search for all final sports scores from ' + yestStr + '. Return a JSON object with keys mlb, nba, nhl, nfl, soccer, tennis. Each has a games array. Each game has: teams [{name, score}], status "Final". MLB adds innings [{away,home}], hits and errors on teams. NBA/NFL add quarters [{away,home}]. NHL adds periods [{away,home}]. Stats array with {label,value} for notable stats.'
        }],
      }),
    });

    const apiData = await apiRes.json();
    if (apiData.error) throw new Error(apiData.error.message);

    const text = (apiData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    const match = text.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON. Got: ' + text.slice(0, 300));

    const scores = JSON.parse(match[0]);
    const cacheKey = 'scores-' + new Date().toISOString().slice(0, 10);

    await fetch(process.env.KV_REST_API_URL + '/set/' + cacheKey + '/ex/86400', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scores),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
