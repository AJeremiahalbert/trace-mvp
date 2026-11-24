# Trace

**An AI agent that investigates "debited but not credited" bank transfer disputes.**

A customer complains in plain English: *"I sent 50k to my landlord on Monday, I was debited but he never got it."* Trace reads the complaint, searches the sending bank's ledger, follows the transfer through the NIBSS switch, checks the receiving bank and looks for reversals. It then shows where the money stopped, recommends the fix and drafts the reply to the customer. A staff member approves or escalates, and every decision goes into an audit log.

> This is a hackathon MVP. All customers, accounts and banks in it are made up.

## Features

- **Claude agent with tool use.** Claude decides which systems to check and calls four tools: sender ledger, NIBSS switch log, receiving bank, reversals.
- **Rule engine fallback.** The same investigation runs without AI, so the app works even with no API key.
- **Money trail** showing the sending bank, NIBSS and the receiving bank, with the stage where the money stopped highlighted.
- **Recommended action:** reverse to the customer, request the credit from the receiving bank, send proof of credit, confirm a reversal already happened, or escalate.
- **Draft customer message**, **approve or escalate**, and an **audit log**.
- **Data sources tab** showing every record the agent can search.

## Run it on your computer

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
cp .env.example .env      # then paste your Anthropic API key into .env (optional)
npm run dev               # open http://localhost:3000
npm test                  # checks the 4 sample cases
```

Without `ANTHROPIC_API_KEY`, the AI toggle is turned off and Trace uses the rule engine.

## Deploy for free on Vercel

1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, click **Add New → Project** and import the repo. You don't need to change any settings.
3. Under **Environment Variables**, add `ANTHROPIC_API_KEY` with your key from [console.anthropic.com](https://console.anthropic.com). Note that API usage is billed separately from a Claude Pro subscription.
4. Click **Deploy**. Vercel gives you a public link.

Vercel serves `public/` as the website and turns each file in `api/` into a serverless endpoint.

## How it works

```
public/
  index.html, styles.css   the console layout and design tokens
  app.js                   state and the investigation flow
  view.js                  rendering helpers (no state)
  engine.js                sample data, tools, rule engine (used by both browser and server)
api/
  investigate.js           POST: runs the Claude agent loop with the tools
  health.js                GET: is the AI agent configured?
lib/rate-limit.js          per-IP rate limit for the agent endpoint
vercel.json                security headers (the local server applies the same ones)
server.js                  local dev server (Vercel doesn't use it)
test/engine.test.js        tests: sample scenarios, parsing, agent loop, rate limit, API validation
```

The agent loop in `api/investigate.js` sends the complaint and tool definitions to Claude. Each time Claude asks for a tool, it runs that tool against the data and returns the result, until Claude replies with a JSON finding. The server checks the recommended action against an allowed list before the page shows it.

## Design

A calm back-office tool: warm paper background, one deep green for actions, and red only where the money stopped. There is one primary action at a time (Investigate, then Approve, then Open next complaint), and on phones it sits in a sticky bar within thumb reach. Approvals can be undone from a toast for six seconds instead of a "Are you sure?" pop-up. Colours meet WCAG contrast (text at least 4.5:1, form controls at least 3:1), there is a separate dark theme, and motion respects reduced-motion settings.

## Security

- The API key is only read from environment variables. `.env` is git-ignored.
- `/api/investigate` validates input (text up to 2,000 characters, 10-digit account), allows 10 requests per minute per IP, and accepts only known actions back from the model.
- Everything rendered from data or the model is escaped. Security headers (CSP, frame blocking, nosniff) are set in `vercel.json`.

## The four sample cases

| Case | Customer | What happened | Trace's answer |
|---|---|---|---|
| TRC-1042 | Tolu Adebayo | NIBSS delivered it, receiving bank failed to post the credit | Request the credit from the receiving bank |
| TRC-1043 | Ibrahim Musa | Failed at NIBSS (code 91), never reversed | Reverse to the customer |
| TRC-1044 | Grace Eze | Delivered and credited | Send proof of credit |
| TRC-1045 | Femi Johnson | Failed at NIBSS, already reversed | Tell the customer it was refunded |

## Road to production

- Replace the sample data in `engine.js` with real connectors: the bank's core banking system, NIBSS APIs and partner banks.
- Add staff sign-in, roles and a database for cases and the audit log.
- Add rate limiting on `/api/investigate`, and redact personal data before it is sent to the model.
- Map actions to the bank's actual reversal and credit-request workflows, with a human approving every money movement.
