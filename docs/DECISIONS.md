# Brainstorm decisions — 2026-05-14

Captured during initial brainstorming session.

| # | Topic | Decision | Notes |
| --- | --- | --- | --- |
| 1 | Design direction | **Bold Activist** | charity:water / WaterAid energy |
| 2 | Palette + type | **Haitian Flag** — Navy #0a1a3f · Red #d62828 · Gold #ffd60a · ivory; Archivo Black + Playfair Display italic + Inter | Logo unchanged |
| 3 | Charity status | **CRA registered** | BN 755722097 RR0001, since 2016 |
| 4 | Page scope | **5 pages** — home, about (incl. programs), stories, team, donate | News → Stories |
| 5 | Payment rails | **CanadaHelps** (cards + auto receipts) + **Interac e-Transfer** | Drop direct Stripe (avoids building a receipt issuer) |
| 6 | Forms | **Astro form → Google Apps Script webhook → Google Sheet** | Contact, volunteer, newsletter |
| 7 | Languages | **English only** for phase 1 | French motto retained as cultural anchor only |
| 8 | CMS | **Markdown + Decap CMS** (git-based) | Free, no DB, GitHub auth |
| 9 | Repo + hosting | **New GitHub repo + Cloudflare Pages + javelinfund.ca** | DNS migration at cutover |
| 10 | Content migration | **Extract from MySQL dump → markdown** | News, team, hero copy rewritten for new voice |
| 11 | Brand | **Keep logo; refresh palette + type only** | |
| 12 | Imagery | **No stock photos** | Only Javelin Fund's own; ask before substituting |
| 13 | Stat: children in school | **325** | |
| 14 | Featured story mechanic | Markdown file in `src/content/stories/` with `featured: true` + `priority: N` — homepage renders highest-priority featured story | Same pattern for `donate-tiers` |
| 15 | Featured tiers | **$400 / year** Sponsor a child · **$1,500 / month** Feed the orphans (both featured) | Plus boilerplate tiers |
