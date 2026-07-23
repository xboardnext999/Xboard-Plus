import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const applications = ["admin-src", "user-src"]

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

async function readBuildCommand(application) {
  const packagePath = path.join(projectRoot, application, "package.json")
  if (!(await isFile(packagePath))) {
    throw new Error(`${application}/package.json is missing; cannot build ${application}`)
  }

  let packageJson
  try {
    packageJson = JSON.parse(await readFile(packagePath, "utf8"))
  } catch (error) {
    throw new Error(`${application}/package.json is invalid JSON: ${error.message}`)
  }

  if (typeof packageJson.scripts?.build !== "string" || packageJson.scripts.build.trim() === "") {
    throw new Error(`${application}/package.json does not define a non-empty \"build\" script`)
  }
}

function runBuild(application) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"

  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, ["run", "build"], {
      cwd: path.join(projectRoot, application),
      stdio: "inherit",
      env: process.env,
    })

    child.once("error", (error) => reject(new Error(`could not start ${application} build: ${error.message}`)))
    child.once("exit", (code, signal) => {
      if (code === 0) resolve()
      else if (signal) reject(new Error(`${application} build was terminated by ${signal}`))
      else reject(new Error(`${application} build failed with exit code ${code ?? "unknown"}`))
    })
  })
}

try {
  // Validate both packages before starting either build so a missing user-src
  // never leaves only the admin bundle refreshed (or vice versa).
  await Promise.all(applications.map(readBuildCommand))

  for (const application of applications) {
    console.log(`[frontends] building ${application}`)
    await runBuild(application)
  }

  console.log("[frontends] admin-src and user-src builds completed")
} catch (error) {
  console.error(`[frontends] ${error.message}`)
  process.exitCode = 1
}
