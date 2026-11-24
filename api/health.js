// GET /api/health — tells the page whether the Claude agent is configured.
export default function handler(req, res) {
  res.status(200).json({ ok: true, ai: Boolean(process.env.ANTHROPIC_API_KEY) });
}
