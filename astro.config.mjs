// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { visit } from 'unist-util-visit';

/** Remark plugin: convert ```mermaid blocks to <div class="mermaid"> for CDN rendering */
function remarkMermaid() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang === 'mermaid') {
        parent.children.splice(index, 1, {
          type: 'html',
          value: `<div class="mermaid">\n${node.value}\n</div>`,
        });
      }
    });
  };
}

export default defineConfig({
  site: 'https://codogotchifordummies.vercel.app',
  // Chapter renumbering (v3 restructure): old slugs → new homes, so inbound
  // links and bookmarks keep working.
  redirects: {
    '/09-dev-workflow-shell-helpers': '/13-dev-workflow-shell-helpers',
    '/10-macos-primitives-primer': '/14-macos-primitives-primer',
    '/11-procedural-effects-deep-dive': '/15-procedural-effects-deep-dive',
    '/12-v2-as-built': '/09-v2-as-built',
    '/13-the-seams-v3-redesign': '/10-the-seams-v3-redesign',
  },
  markdown: {
    remarkPlugins: [remarkMermaid],
  },
  integrations: [
    starlight({
      components: {
        Header: './src/components/starlight/Header.astro',
      },
      customCss: ['./src/styles/custom.css'],
      title: 'Codogotchi for Dummies',
      description: "A field guide to Codogotchi for TypeScript & FP developers — learn the Swift/AppKit architecture, data flow, and contribute to v2. Works with Claude Code, Codex, Cursor, Copilot, and Antigravity.",
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/cesarnml/codogotchi-app-on-boarding-for-dummies' }],
      head: [
        { tag: 'link', attrs: { rel: 'icon', type: 'image/webp', href: '/favicon.webp' } },
        {
          tag: 'meta',
          attrs: {
            name: 'keywords',
            content: 'Codogotchi, Codogotchi architecture, Codex pets, OpenPets alternative, AI coding pet, macOS menubar pet, Claude Code, Codex, Cursor, Copilot, Antigravity, Swift AppKit, contribute Codogotchi, developer Tamagotchi, AI coding companion, open source',
          },
        },
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://codogotchi.app/og-image.png' } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: 'https://codogotchi.app/og-image.png' } },
        { tag: 'script', attrs: { defer: true, src: '/_vercel/insights/script.js' } },
        {
          tag: 'script',
          attrs: { type: 'module' },
          content: `
            import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
            mermaid.initialize({ startOnLoad: true, theme: 'dark' });
          `,
        },
      ],
      sidebar: [
        { label: 'Home', slug: '' },
        {
          label: 'Core pipeline',
          items: [
            { label: '01 — The Big Picture', slug: '01-the-big-picture' },
            { label: '02 — The Data Contract', slug: '02-the-data-contract' },
            { label: '03 — The Polling Loop', slug: '03-the-polling-loop' },
            { label: '04 — The Renderers', slug: '04-the-renderers' },
            { label: '05 — Swift & AppKit for TS/FP Devs', slug: '05-swift-and-appkit-for-ts-devs' },
            { label: '06 — Where v2 is Going', slug: '06-v2-per-platform-multipet' },
          ],
        },
        {
          label: 'v1 → v2 Hands-on',
          items: [
            { label: '07 — Challenges', slug: '07-challenges' },
            { label: '08 — Swift Learning Resources', slug: '08-swift-learning-resources' },
          ],
        },
        {
          label: 'The v2 architecture (v3 prep)',
          items: [
            { label: '09 — v2 As Built: Slices, Keys & the Window Pool', slug: '09-v2-as-built' },
            { label: '10 — The Seams: Why v3 Wants a Redesign', slug: '10-the-seams-v3-redesign' },
          ],
        },
        {
          label: 'v2 → v3 Hands-on',
          items: [
            { label: '11 — v2 → v3 Challenges', slug: '11-v3-challenges' },
            { label: '12 — v3 Learning Resources', slug: '12-v3-learning-resources' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: '13 — Dev-Workflow Shell Helpers', slug: '13-dev-workflow-shell-helpers' },
            { label: '14 — macOS Primitives Primer', slug: '14-macos-primitives-primer' },
            { label: '15 — Procedural Effects Deep-Dive', slug: '15-procedural-effects-deep-dive' },
            { label: '16 — The ~/.codogotchi Disk Contract', slug: '16-disk-contract' },
          ],
        },
      ],
    }),
  ],
});
