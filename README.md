# Babel Tour

## Checks

None of these adds a runtime or test dependency. Run them from the project root.

```powershell
npm run check:walk       # needs the dev server; teleports through all eight
                         # galleries and fails on anything thrown
npm run check:governor    # the frame-rate rule, handed numbers directly
npm run verify:assets     # every plate, depth map and clip a walk can ask for
npm run review:ux         # needs the dev server; the heuristic UX pass below
```

`check:walk` is the one to run after moving code between modules. A free
variable is a runtime error, so the build, the bundler and oxlint are all blind
to it; only something that walks the tour can see it.

## Deploying

The clip batches are carried out of band (see `.gitignore`) and have to be
copied into `public/` before a build. A default build then prunes them down the
`best` chain and comes out around 580 MB.

To ship without them, put them on a bucket or CDN and point the build at it:

```powershell
$env:VITE_VIDEO_HOST = "https://clips.example.com"
npm run build
```

Every clip URL is rewritten to that origin and no clip root is copied into
`dist`, which takes the build to about 70 MB. Upload `public/video*` as it
stands — the same `root/file` layout is expected underneath — and give the
bucket CORS for the origin the tour is served from.

## Automated UI/UX review

With the Vite app running on `localhost:5173`, run:

```powershell
npm run review:ux
```

The review agent opens a headless Chromium browser, clicks through the entry,
help, audio, autoplay and chapter controls, checks keyboard navigation, repeats
the layout check at 390 px, and writes screenshots plus prioritized feedback to
`.ux-review/latest/report.md`. It uses the browser's DevTools protocol directly,
so it adds no runtime or test dependency.

Options:

```powershell
npm run review:ux -- --url http://localhost:5173 --out .ux-review/my-run
npm run review:ux -- --browser "C:\path\to\chrome.exe" --no-mobile
```

Start the app first with `npm run dev`. The agent exits with a clear message if
the target is not reachable. Its report is a repeatable heuristic review; use it
alongside manual visual, assistive-technology, and user testing.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
