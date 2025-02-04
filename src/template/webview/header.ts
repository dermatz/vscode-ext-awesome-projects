import * as vscode from "vscode";
import * as path from "path";
import { promises as fsPromises } from "fs";

/**
 * Describes relevant parts of the extension's package.json.
 */
interface PackageJson {
    version: string;
    preview?: boolean;
}

/**
 * Cached package.json data.
 * This is used to avoid reading the package.json file multiple times.
 */

let cachedPackageJson: PackageJson | null = null;

/**
 * Returns header HTML for the webview.
 * @param context Includes all relevant elements for the project webview header.
 */
export async function getHeaderHtml(context: vscode.ExtensionContext): Promise<string> {
    const packageJsonPath = path.join(context.extensionPath, 'package.json');
    let packageJson: PackageJson = { version: "unknown", preview: false };
    if (cachedPackageJson) {
        packageJson = cachedPackageJson;
    } else {
        try {
            const data = await fsPromises.readFile(packageJsonPath, "utf8");
            packageJson = JSON.parse(data);
            cachedPackageJson = packageJson;
        } catch (error) {
            console.error("Error reading package.json:", error);
            packageJson = { version: "unknown", preview: false };
        }
    }

    return `
        <header>
            <div class="logo">
              <div>
                <h1>Awesome Projects</h1>
                <small class="version">
                  Version: ${packageJson.version}
                  ${packageJson.preview ? '<span class="preview-badge">Preview</span>' : ''}
                </small>
              </div>
            </div>
          </header>
    `;
}
