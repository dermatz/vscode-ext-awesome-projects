import * as vscode from "vscode";

/**
 * Returns footer HTML for the webview.
 * @param context Includes all structured elements to render the project list.
 */

export async function getProjectListHtml(context: vscode.ExtensionContext): Promise<string> {
    return `

        Project List

    `;
}



