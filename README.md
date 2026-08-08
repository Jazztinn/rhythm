# Rhythm

Desktop-first calm personal task OS built with Next.js, TypeScript, GSAP, and Gemini structured outputs.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `GEMINI_API_KEY` to enable live chat. Keep it server-only: do not use a `NEXT_PUBLIC_` prefix and never commit `.env.local`. `GEMINI_MODEL` is optional and defaults to `gemini-3.5-flash`.

Chat calls Gemini Interactions API with JSON-schema output. Rhythm validates request payloads, validates Gemini output, and only returns create, complete, or reschedule actions for known pending tasks. Tasks and chat history remain local to browser in this prototype. No Supabase yet.

## Deploy

Deploy to Vercel and add `GEMINI_API_KEY` as a sensitive project environment variable. Add `GEMINI_MODEL` only to override default model. Redeploy after changing variables.
