import * as vscode from "vscode";

export async function getAddToHtml(context: vscode.ExtensionContext): Promise<string> {
    return `
        <button class="add-button" onclick="addProject()">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                <path stroke="none" d="M0 0h24v24H0z"/>
                <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Project
        </button>
    `;
}



