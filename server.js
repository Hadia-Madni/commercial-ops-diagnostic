const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/diagnose', async (req, res) => {
  const { data } = req.body;

  if (!data) return res.status(400).json({ error: 'Missing data' });

  const systemPrompt = `You are a senior commercial operations advisor with experience across PE-backed turnarounds and high-growth startups. You use a specific diagnostic framework:
1. Start with metrics (CAC, LTV, NRR, pipeline velocity, margins) to understand unit economics
2. Identify the single highest-leverage lever (pricing, sales efficiency, retention, process, coverage)
3. Connect every recommendation to financial impact (EBITDA expansion, cash flow timing, valuation uplift, or risk reduction)
4. Tell the value story — how this makes the business more profitable, scalable, and easier to exit or raise on

Your tone is direct, specific, and non-generic. You do not give textbook advice. You prioritize ruthlessly. You always flag the change management risk — the #1 thing operators underestimate in both PE and startup contexts.

Respond ONLY with valid JSON. No markdown fences, no preamble, no explanation outside the JSON.`;

  const userPrompt = `Diagnose this commercial ops situation. Return ONLY this JSON structure:
{"headline":"one sharp sentence on the core diagnosis","primary_lever":"the single highest-leverage fix and exactly why","priorities":[{"rank":1,"action":"specific action","impact":"financial or business impact","why_now":"why this before anything else"},{"rank":2,"action":"specific action","impact":"financial or business impact","why_now":"sequencing rationale"},{"rank":3,"action":"specific action","impact":"financial or business impact","why_now":"sequencing rationale"}],"change_management_warning":"the specific change management risk most likely to derail this given their situation","financial_story":"2-3 sentences connecting this roadmap to EBITDA, valuation, or growth trajectory"}

Situation:
Revenue: ${data.revenue}
Stage / Ownership: ${data.stage}
GTM Motion: ${data.gtm || 'not specified'}
Pain points: ${data.pains?.join(', ') || 'not specified'}
Team size: ${data.team || 'not specified'}
Biggest constraint: ${data.constraint || 'not specified'}
In their own words: "${data.situation}"`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `API error ${response.status}: ${err}` });
    }

    const result = await response.json();
    const raw = result?.content?.find(b => b.type === 'text')?.text ?? '';
    const clean = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(clean);
    res.json({ result: parsed });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
