# VoidTrek Navigator

Two tools for VoidTrek / Astro Empires, in one app:

- **Closest trade** — paste your guildmates' base coords; it pairs everyone so
  each base trades exactly once, minimizing total distance. Flags the odd base
  out when the count is odd.
- **Closest free astro** — enter your base and a list of free astros; it ranks
  them nearest to farthest for picking your next base.

Distance uses the game's own `calc_distance()` model (see `lib/distance.js`):
system distance is `ceil(√(Δx² + Δy²))` with `x = reg₁·10 + sys₁` and
`y = reg₀·10 + sys₀`. Same-galaxy results are identical for either series; the
"Series ≥ 5" toggle only affects cross-galaxy jumps.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel (free)

Option A — dashboard:
1. Push this folder to a GitHub repo.
2. On vercel.com: **Add New → Project → Import** that repo.
3. Framework is auto-detected as **Next.js**. Leave every setting default and
   click **Deploy**. No environment variables needed.

Option B — CLI:
```bash
npm i -g vercel
vercel        # first run links/creates the project
vercel --prod # deploy to production
```

That's it — it's a static-friendly Next.js app with no backend or database, so
it runs on Vercel's free Hobby tier.

## Input format

One coord per line, in `Gxx:rr:ss:aa` form, e.g. `B25:44:86:30`. Labels are
optional and can go before or after the coord:

```
Serpico B25:44:86:30
B25:46:33:30 Wyald
A00:45:69:30
```

Lines without a readable coord are skipped and reported.
