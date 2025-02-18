import * as vscode from "vscode";

export async function getAddToHtml(): Promise<string> {
    return `
        <div style="display: flex; gap: 1rem; align-items: center;">
            <button class="button" onclick="addProject()">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M12 5v14M5 12h14"/>
                </svg>
                Add Project
            </button>

            <button class="button secondary" onclick="scanProjects()">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M11.5 16H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6.5M7 20h4m-2-4v4m6-2a3 3 0 1 0 6 0 3 3 0 1 0-6 0m5.2 2.2L22 22"/>
                </svg>
                Scan for Projects
            </button>
        </div>
        <script>
            if (!window.vscodeApi) {
                window.vscodeApi = acquireVsCodeApi();
            }

            function addProject() {
                window.vscodeApi.postMessage({
                    command: 'addProject'
                });
            }

            function scanProjects() {
                window.vscodeApi.postMessage({
                    command: 'scanProjects'
                });
            }
        </script>
    `;
}



