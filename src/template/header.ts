import * as vscode from "vscode";
import { loadResourceFile } from "../utils/resourceLoader";
import * as path from "path";
import * as fs from "fs";

export async function getHeaderHtml(context: vscode.ExtensionContext): Promise<string> {
    const packageJsonPath = path.join(context.extensionPath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    return `
        <header>
            <div class="logo">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="logo" viewBox="0 0 24 24">
                <path stroke="none" d="M0 0h24v24H0z"/>
                <path d="M8 4H6L3 14M16 4h2l3 10M10 16h4M21 16.5a3.5 3.5 0 0 1-7 0V14h7v2.5M10 16.5a3.5 3.5 0 0 1-7 0V14h7v2.5M4 14l4.5 4.5M15 14l4.5 4.5"/>
              </svg>
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
