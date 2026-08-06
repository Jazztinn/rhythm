# Rhythm

Desktop-first calm personal task OS built with Next.js, TypeScript, GSAP, and optional Gemini structured outputs.

## What works

- Create, edit, complete, reopen, search, delete, and undo local tasks.
- Add dates, times, projects, priorities, estimates, and notes; dated tasks populate Calendar automatically.
- Create and remove daily rhythms. Daily completion resets while routine definitions persist.
- Use Chat without setup for local planning and common create, complete, and reschedule commands.
- Add Gemini for broader natural-language planning while retaining validated, bounded task actions.

All personal data stays in browser `localStorage` in this prototype.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

`GEMINI_API_KEY` is optional. Without it, Rhythm uses a deterministic local assistant for planning and common task commands. With it, Chat uses Gemini for broader natural-language support. Keep the key server-only: do not use a `NEXT_PUBLIC_` prefix and never commit `.env.local`. `GEMINI_MODEL` is optional and defaults to `gemini-3.5-flash`.

Chat calls Gemini Interactions API with JSON-schema output. Rhythm validates request payloads, validates Gemini output, and only returns create, complete, or reschedule actions for known pending tasks. Tasks and chat history remain local to browser in this prototype. No Supabase yet.

## Deploy

Deploy to Vercel and add `GEMINI_API_KEY` as a sensitive project environment variable. Add `GEMINI_MODEL` only to override default model. Redeploy after changing variables.
