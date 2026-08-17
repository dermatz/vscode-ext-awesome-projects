export async function getAddToHtml(): Promise<string> {
    return `
        <div class="add-project-section">
            <div class="add-project-header">
                <span class="add-project-title">Add Project</span>
                <span class="add-project-subtitle">Choose how to add your next project</span>
            </div>
            <div class="add-project-actions">
                <button class="add-project-button add-project-button-primary" onclick="addProject()" title="Add an existing project folder">
                    <span class="add-project-button-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke="none" d="M0 0h24v24H0z"/>
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                    </span>
                    <span class="add-project-button-label">Add</span>
                    <span class="add-project-button-desc">Existing folder</span>
                </button>
                <button class="add-project-button add-project-button-secondary" onclick="scanProjects()" title="Scan folders for Git repositories">
                    <span class="add-project-button-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke="none" d="M0 0h24v24H0z"/>
                            <path d="M11.5 16H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6.5M7 20h4m-2-4v4m6-2a3 3 0 1 0 6 0 3 3 0 1 0-6 0m5.2 2.2L22 22"/>
                        </svg>
                    </span>
                    <span class="add-project-button-label">Scan</span>
                    <span class="add-project-button-desc">Find projects</span>
                </button>
                <button class="add-project-button add-project-button-secondary" onclick="addRemoteProject()" title="Connect to a remote repository">
                    <span class="add-project-button-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke="none" d="M0 0h24v24H0z"/>
                            <path d="M6 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
                            <path d="M6 9v2a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v2"/>
                            <path d="M18 21a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
                        </svg>
                    </span>
                    <span class="add-project-button-label">Connect</span>
                    <span class="add-project-button-desc">Remote repo</span>
                </button>
            </div>
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

            function addRemoteProject() {
                window.vscodeApi.postMessage({
                    command: 'addRemoteProject'
                });
            }
        </script>
    `;
}


