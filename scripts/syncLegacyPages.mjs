import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distAssetsDir = path.join(rootDir, 'dist', 'assets')
const rootAssetsDir = path.join(rootDir, 'assets')
const rootIndexPath = path.join(rootDir, 'index.html')

if (!existsSync(distAssetsDir)) {
  throw new Error('dist/assets does not exist. Run the Vite build before syncing legacy Pages assets.')
}

rmSync(rootAssetsDir, { recursive: true, force: true })
mkdirSync(rootAssetsDir, { recursive: true })

for (const entry of readdirSync(distAssetsDir)) {
  cpSync(path.join(distAssetsDir, entry), path.join(rootAssetsDir, entry), {
    recursive: true,
  })
}

writeFileSync(
  rootIndexPath,
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
    />
    <link rel="stylesheet" href="./assets/app.css" />
    <title>DART — Design & Development Accountability Tracker</title>
  </head>
  <body class="antialiased overflow-x-hidden">
    <div id="root" class="w-full max-w-full overflow-x-hidden"></div>
    <script type="module" src="./assets/app.js"></script>
  </body>
</html>
`,
)