# Rhythm

Desktop-first calm personal task OS built with Next.js, TypeScript, GSAP, and Gemini structured outputs.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `GEMINI_API_KEY` to enable live chat. Tasks and chat history remain local to the browser in this prototype.

## Deploy

Deploy to Vercel and add `GEMINI_API_KEY` as a project environment variable. `GEMINI_MODEL` is optional and defaults to `gemini-3.5-flash`.
