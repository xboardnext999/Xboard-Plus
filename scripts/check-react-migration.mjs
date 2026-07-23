import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const applications = ["admin-src", "user-src"]
const forbiddenLegacyArtifacts = [
  "public/assets/admin",
  "public/assets/admin-vue",
  "public/theme/Xboard/assets/umi.js",
  "theme/Xboard/assets/umi.js",
  "theme/Xboard/assets/app/api.js",
  "theme/Xboard/assets/app/helpers.js",
  "theme/Xboard/assets/app/store-service.css",
  "theme/Xboard/assets/app/vendor/vue.esm-browser.prod.js",
]
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"])
const ignoredDirectories = new Set(["node_modules", "dist", "build", ".git"])

const vueImportPattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["'](?:vue(?:\/[^"']*)?|vue-router(?:\/[^"']*)?|@vue\/[^"']+)["']/g

function relative(filePath) {
  return path.relative(projectRoot, filePath) || "."
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

async function isDirectory(filePath) {
  try {
    return (await stat(filePath)).isDirectory()
  } catch {
    return false
  }
}

async function walk(directory) {
  const files = []
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue

    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(entryPath)))
    else if (entry.isFile()) files.push(entryPath)
  }

  return files
}

function isVueDependency(packageName) {
  return packageName === "vue"
    || packageName.startsWith("vue-")
    || packageName.startsWith("@vue/")
    || packageName.startsWith("@vueuse/")
    || packageName.includes("-vue")
    || packageName.endsWith("/vue")
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length
}

function validateVueImports(filePath, source, errors) {
  vueImportPattern.lastIndex = 0
  for (const match of source.matchAll(vueImportPattern)) {
    errors.push(`${relative(filePath)}:${lineNumberAt(source, match.index)} still imports ${match[0]}`)
  }
}

async function readJson(filePath, errors, label) {
  if (!(await isFile(filePath))) {
    errors.push(`${relative(filePath)} is missing (${label})`)
    return null
  }

  try {
    return JSON.parse(await readFile(filePath, "utf8"))
  } catch (error) {
    errors.push(`${relative(filePath)} is not valid JSON: ${error.message}`)
    return null
  }
}

async function validateApplication(application) {
  const errors = []
  const applicationRoot = path.join(projectRoot, application)
  const sourceRoot = path.join(applicationRoot, "src")

  if (!(await isDirectory(applicationRoot))) {
    return [`${application}/ is missing; the React migration is incomplete`]
  }

  const packageJson = await readJson(
    path.join(applicationRoot, "package.json"),
    errors,
    "frontend package metadata",
  )

  if (packageJson) {
    const dependencySections = [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]

    for (const section of dependencySections) {
      for (const packageName of Object.keys(packageJson[section] ?? {})) {
        if (isVueDependency(packageName)) {
          errors.push(`${application}/package.json still declares Vue package ${packageName} in ${section}`)
        }
      }
    }
  }

  if (!(await isDirectory(sourceRoot))) {
    errors.push(`${application}/src/ is missing`)
  } else {
    const sourceFiles = await walk(sourceRoot)
    for (const filePath of sourceFiles) {
      if (path.extname(filePath).toLowerCase() === ".vue") {
        errors.push(`${relative(filePath)} is a Vue single-file component`)
        continue
      }

      if (!sourceExtensions.has(path.extname(filePath).toLowerCase())) continue
      validateVueImports(filePath, await readFile(filePath, "utf8"), errors)
    }
  }

  const mainEntry = path.join(sourceRoot, "main.tsx")
  if (!(await isFile(mainEntry))) {
    errors.push(`${relative(mainEntry)} is missing (React TypeScript entry point)`)
  }

  const htmlEntry = path.join(applicationRoot, "index.html")
  if (!(await isFile(htmlEntry))) {
    errors.push(`${relative(htmlEntry)} is missing`)
  } else {
    const html = await readFile(htmlEntry, "utf8")
    if (!/(?:^|\/)src\/main\.tsx(?:[?"'])/.test(html)) {
      errors.push(`${relative(htmlEntry)} does not load src/main.tsx`)
    }
  }

  const componentsJson = await readJson(
    path.join(applicationRoot, "components.json"),
    errors,
    "shadcn/ui component manifest",
  )
  if (componentsJson) {
    if (componentsJson.$schema !== "https://ui.shadcn.com/schema.json") {
      errors.push(`${application}/components.json must use the official shadcn/ui schema`)
    }
    if (componentsJson.tsx !== true) {
      errors.push(`${application}/components.json must set \"tsx\" to true`)
    }
  }

  const viteConfigCandidates = ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs"]
    .map((fileName) => path.join(applicationRoot, fileName))
  const viteConfig = (await Promise.all(viteConfigCandidates.map(async (candidate) => (
    (await isFile(candidate)) ? candidate : null
  )))).find(Boolean)

  if (!viteConfig) {
    errors.push(`${application}/vite.config.ts is missing`)
  } else {
    const configSource = await readFile(viteConfig, "utf8")
    if (!/\bmanifest\s*:\s*(?:true|["'`][^"'`]+["'`])/.test(configSource)) {
      errors.push(`${relative(viteConfig)} must enable Vite build.manifest for Blade integration`)
    }
  }

  return errors
}

const results = await Promise.all(applications.map(async (application) => ({
  application,
  errors: await validateApplication(application),
})))
const errors = results.flatMap(({ errors: applicationErrors }) => applicationErrors)

for (const artifact of forbiddenLegacyArtifacts) {
  const artifactPath = path.join(projectRoot, artifact)
  if (await isFile(artifactPath) || await isDirectory(artifactPath)) {
    errors.push(`${artifact} is a legacy frontend artifact and must not be shipped`)
  }
}

if (errors.length > 0) {
  console.error(`[react-migration] failed with ${errors.length} issue${errors.length === 1 ? "" : "s"}:`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exitCode = 1
} else {
  console.log("[react-migration] passed: both frontends are React/TypeScript shadcn/ui applications and no legacy Vue runtime is present")
}
