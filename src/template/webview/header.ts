import * as vscode from "vscode";
import * as path from "path";
import { promises as fsPromises } from "fs";

/**
 * Describes relevant parts of the extension's package.json.
 */
interface PackageJson {
    version: string;
}

/**
 * Cached package.json data.
 * This is used to avoid reading the package.json file multiple times.
 */

let cachedPackageJson: PackageJson | null = null;

/**
 * Checks if the version is below 1.0.0
 */
function isBetaVersion(version: string): boolean {
    try {
        const [major] = version.split('.').map(Number);
        return major < 1;
    } catch {
        return false;
    }
}

/**
 * Returns header HTML for the webview.
 * @param context Includes all relevant elements for the project webview header.
 */
export async function getHeaderHtml(context: vscode.ExtensionContext): Promise<string> {
    const packageJsonPath = path.join(context.extensionPath, 'package.json');
    let packageJson: PackageJson = { version: "unknown" };
    if (cachedPackageJson) {
        packageJson = cachedPackageJson;
    } else {
        try {
            const data = await fsPromises.readFile(packageJsonPath, "utf8");
            packageJson = JSON.parse(data);
            cachedPackageJson = packageJson;
        } catch (error) {
            console.error("Error reading package.json:", error);
            packageJson = { version: "unknown" };
        }
    }

    return `
        <header class="projects-header">
            <div class="projects-header-top">
              <div class="brand-text">
                <h1>Awesome Projects</h1>
                <small class="version">
                  <span class="version-label">Version ${packageJson.version}</span>
                  ${isBetaVersion(packageJson.version) ? '<span class="badge">Beta</span>' : '<span class="badge badge-stable">Stable</span>'}
                </small>
              </div>
            </div>
            <div class="projects-header-search">
              <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input type="search" id="project-search" placeholder="Search projects..." autocomplete="off">
            </div>
          </header>
    `;
}
