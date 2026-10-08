---
name: starter-next-performance
description: Diagnose or optimize Next.js routing, Cache Components, hydration, bundles, or Core Web Vitals in the starter repository.
---

# Starter Next.js performance

The webapp uses Next.js 16, React 19, App Router, and `cacheComponents: true`. Read the relevant app-local
`node_modules/next/dist/docs` guide before changing framework behavior.

## Workflow

- Establish the exact route, navigation type, environment, device profile, and measured symptom.
- Separate field Core Web Vitals from lab results and compare like-for-like runs.
- Inspect server/client boundaries, cache behavior, the LCP request chain, fonts, images, third-party work, hydration,
  main-thread work, and layout shifts.
- Prioritize LCP, INP, and CLS, then transferred bytes and cache efficiency.
- Make the smallest measured change; preserve accessibility, SEO, visual fidelity, and freshness requirements.

Keep the hero and genuine LCP candidate in initial server HTML. Do not lazy-load above-the-fold content, broadly add
`will-change`, preload non-critical resources, or hide an LCP element until hydration. Use accurate image dimensions and
`sizes`, isolate expensive interactive dependencies, and keep mutable assets off immutable cache URLs.

Do not build as verification. Use focused tests, profiling, or a production-like deployment as appropriate, then run
`bun check`. Never claim a performance improvement without comparable before-and-after evidence.
