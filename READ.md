# Movies Lookup API (Vercel)

Simple serverless API that reads `movies_data.txt` and returns matching movies with a prioritized single `preferred_watch` URL.

## Development

1. Put your `movies_data.txt` at the project root.
2. Install Vercel CLI if you want local dev: `npm i -g vercel`.
3. Run locally: `vercel dev` or test the function with `node` (note `vercel dev` is recommended).

## Deploying to Vercel

1. Create a new Git repo and push this project.
2. Connect the repo to Vercel (https://vercel.com) and deploy.
3. The endpoint will be: `https://<your-vercel-name>.vercel.app/api/movie?name=<movie%20name>`

## Notes

- The parser is heuristic-based for the `movies_data.txt` formatting. If your file uses different patterns, tell me and I'll adapt the parser.
- `preferred_watch` attempts to select a single best URL according to priority domains: `short.icu`, `zoro.rpmplay.xyz`, `dorex`, `play.zep`. It avoids Dailymotion when possible.
- If you want automatic provider-ID -> URL mapping (e.g. `G1 (id)` -> `https://short.icu/id`), provide a few examples and I'll add strict constructors.
