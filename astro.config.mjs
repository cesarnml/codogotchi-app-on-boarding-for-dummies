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
  markdown: {
    remarkPlugins: [remarkMermaid],
  },
  integrations: [
    starlight({
      customCss: ['./src/styles/custom.css'],
      title: 'Codogotchi for Dummies',
      description: "A TS/FP developer's field guide to the Codogotchi macOS menubar app.",
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/cesarnml/codogotchi-app-on-boarding-for-dummies' }],
      favicon: '/favicon.webp',
      head: [
        { tag: 'link', attrs: { rel: 'icon', type: 'image/webp', href: '/favicon.webp' } },
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
          label: 'Hands-on',
          items: [
            { label: '07 — Challenges', slug: '07-challenges' },
            { label: '08 — Swift Learning Resources', slug: '08-swift-learning-resources' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: '09 — Dev-Workflow Shell Helpers', slug: '09-dev-workflow-shell-helpers' },
            { label: '10 — macOS Primitives Primer', slug: '10-macos-primitives-primer' },
            { label: '11 — Procedural Effects Deep-Dive', slug: '11-procedural-effects-deep-dive' },
          ],
        },
      ],
    }),
  ],
});
