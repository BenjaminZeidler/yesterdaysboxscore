export default async function handler(req, res) {
  if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yestStr = yesterday.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = 'Today is ' + todayStr + '. Yesterday was ' + yestStr + '. List all final sports scores from yesterday. Return ONLY a raw JSON object with these keys: mlb, nba, nhl, nfl, soccer, tennis. Each key has a games array. Each game needs: teams array with name and score, status Final. MLB needs innings array plus hits and errors on team objects. NBA and NFL need quarters array. NHL needs periods array. Add stats array with 1-2 notable stats per game. Only include sports with games played. No markdown, no explanation, just JSON.';

  try {
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
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    const match = text.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
if (!match) throw new Error('No JSON in response. Got: ' + text.slice(0, 200));


    const scores = JSON.parse(match[0]);
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = 'scores-' + today;

    await fetch(process.env.KV_REST_API_URL + '/set/' + cacheKey + '/ex/86400', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scores),
    });

    return res.status(200).json({ success: true, games: Object.keys(scores).map(k => k + ': ' + (scores[k].games || []).length + ' games') });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
