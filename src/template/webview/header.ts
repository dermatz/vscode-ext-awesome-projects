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
        <header class="award-header">
            <div class="logo">
              <div class="brand-text">
                <h1>Awesome Projects</h1>
                <small class="version">
                  <span class="version-label">Version ${packageJson.version}</span>
                  ${isBetaVersion(packageJson.version) ? '<span class="badge">Beta</span>' : '<span class="badge badge-stable">Award Winning</span>'}
                </small>
              </div>
            </div>
          </header>
    `;
}
