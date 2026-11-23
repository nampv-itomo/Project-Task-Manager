This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Auto task watch + Telegram

A job inside the server re-reads `<project>/specs/<slug>/tasks.md` every 60s and sends a Telegram
message when tasks newly become complete (one grouped message per project per tick, plus a separate
message when a spec reaches 100%). Behaviour and invariants: `src/lib/watch/SKILL.md`.

Only the **Spec Kit layout** is counted: `specs/<slug>/tasks.md`. The older `<project>/tasks/<slug>/todo.md`
form (its own page, watcher and `task_watch` table) has been removed.

**Enable Telegram** — put both values in `.env.local` (read lazily, so a change only needs a restart):

```bash
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789
```

Without them the job still runs and records every message as `notification_log.status = skipped_no_config`.

**Tune / disable**

```bash
TASK_WATCH_INTERVAL_MS=60000   # tick period (production minimum 5000)
TASK_WATCH_ENABLED=0           # turn the job off
```

**Verify**

```bash
npm test                                            # unit + integration tests
node --conditions=react-server scripts/smoke-telegram.mts   # send 2 test messages (needs .env.local)
sqlite3 data/projects.db "select slug,mode,done,total from spec_watch;"
sqlite3 data/projects.db "select created_at,kind,status,attempts from notification_log order by id desc limit 10;"
```

The pages `/projects/[id]` and `/projects/[id]/specs/[slug]` show the same data ("Auto-check" and
"Thông báo gần đây"). Pages never refresh themselves — use the existing **↻ Làm mới** button.
Watched project folders are never written to: the job only reads them.
