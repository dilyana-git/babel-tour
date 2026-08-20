# Babel Tour

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
