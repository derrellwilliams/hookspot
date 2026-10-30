// Emit lucide-react icon nodes as template SVG imagesets for the iOS asset catalog —
// the same icon set the web uses (src/components/icons.js). From the repo root:
//   node ios/scripts/gen-lucide-icons.mjs "$PWD/node_modules/lucide-react/dist/esm/icons" "$PWD/ios/HookSpot/Resources/Assets.xcassets/Icons"
// Add a name to `icons` (and a case to DesignSystem/Icon.swift) to bring in a new one.
import fs from 'node:fs'
import path from 'node:path'
const [,, iconsDir, outDir] = process.argv
const icons = ['house','user','search','plus','layout-list','map','map-pin','pencil','x','share','check','chevrons-up-down','circle-check','image','settings','users','circle-user-round','chevron-left','chevron-right','camera','sliders-horizontal','fish']
const attr = o => Object.entries(o).filter(([k]) => k !== 'key').map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}="${v}"`).join(' ')
for (const name of icons) {
  const mod = await import(path.join(iconsDir, `${name}.mjs`))
  const body = mod.__iconNode.map(([tag, a]) => `<${tag} ${attr(a)}/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`
  const dir = path.join(outDir, `lucide.${name}.imageset`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${name}.svg`), svg)
  fs.writeFileSync(path.join(dir, 'Contents.json'), JSON.stringify({
    images: [{ filename: `${name}.svg`, idiom: 'universal' }],
    info: { author: 'xcode', version: 1 },
    properties: { 'preserves-vector-representation': true, 'template-rendering-intent': 'template' },
  }, null, 2))
}
console.log('wrote', icons.length)
