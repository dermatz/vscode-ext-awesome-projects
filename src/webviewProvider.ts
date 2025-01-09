import * as vscode from 'vscode';
import { Project } from './types';

export class ProjectsWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'awesomeProjectsView';
    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {
        this._disposables.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('awesomeProjects.projects')) {
                    this.refresh();
                }
            })
        );
    }

    public getView(): vscode.WebviewView | undefined {
        return this._view;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'addProject':
                    vscode.window.showOpenDialog({
                        canSelectFolders: true,
                        canSelectMany: false
                    }).then(async folderUri => {
                        if (folderUri && folderUri[0]) {
                            try {
                                const projectPath = folderUri[0].fsPath;
                                const configuration = vscode.workspace.getConfiguration('awesomeProjects');
                                const projects: Project[] = configuration.get('projects') || [];

                                const newProject: Project = {
                                    path: projectPath,
                                    name: await vscode.window.showInputBox({
                                        prompt: 'Enter project name',
                                        value: projectPath.split('/').pop()
                                    }) || projectPath.split('/').pop() || ''
                                };

                                await configuration.update(
                                    'projects',
                                    [...projects, newProject],
                                    vscode.ConfigurationTarget.Global
                                );

                                const updatedProjects = configuration.get<Project[]>('projects');
                                if (updatedProjects?.some(p => p.path === newProject.path)) {
                                    this.refresh();
                                } else {
                                    throw new Error('Failed to save project to settings');
                                }
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to add project: ${error}`);
                            }
                        }
                    });
                    break;
                case 'openProject':
                    vscode.window.showInformationMessage(`Open Project: ${message.project}`);
                    break;
                case 'projectSelected':
                    vscode.window.showInformationMessage(`Project selected: ${message.path}`);
                    break;
                case 'updateProject':
                    this._updateProject(message.projectPath, message.updates);
                    break;
            }
        });
    }

    private async _updateProject(projectPath: string, updates: Partial<Project>) {
        try {
            const configuration = vscode.workspace.getConfiguration('awesomeProjects');
            const projects = [...(configuration.get<Project[]>('projects') || [])];
            const projectIndex = projects.findIndex(p => p.path === projectPath);

            if (projectIndex !== -1) {
                projects[projectIndex] = { ...projects[projectIndex], ...updates };
                await configuration.update('projects', projects, vscode.ConfigurationTarget.Global);
                this.refresh();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update project: ${error}`);
        }
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    public dispose() {
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const configuration = vscode.workspace.getConfiguration('awesomeProjects');
        const projects = configuration.get<Project[]>('projects') || [];

        return `<!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                    }
                    .section {
                        margin-bottom: 20px;
                        opacity: 0;
                        animation: fadeIn 0.3s ease forwards;
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .section-header {
                        padding: 12px 16px;
                        font-weight: 600;
                        background: var(--vscode-sideBar-background);
                        border-bottom: 1px solid var(--vscode-sideBar-border);
                        letter-spacing: 0.5px;
                        font-size: 13px;
                        position: sticky;
                        top: 0;
                        z-index: 100;
                        backdrop-filter: blur(10px);
                    }
                    .project-item {
                        display: flex;
                        align-items: center;
                        padding: 10px 12px;
                        cursor: pointer;
                        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        border-radius: 6px;
                        margin: 4px 6px;
                        position: relative;
                        z-index: 1;
                        background: var(--vscode-editor-background);
                        border: 1px solid transparent;
                    }
                    .project-item:hover {
                        transform: translateY(-1px);
                        border-color: var(--vscode-input-border);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    }
                    .project-icon {
                        margin-right: 12px;
                        font-size: 1.2em;
                        transition: transform 0.2s ease;
                    }
                    .project-item:hover .project-icon {
                        transform: scale(1.1);
                    }
                    .project-info {
                        flex: 1;
                        transition: transform 0.2s ease;
                    }
                    .project-name {
                        font-weight: 500;
                        margin-bottom: 2px;
                    }
                    .project-path {
                        font-size: 0.85em;
                        opacity: 0.7;
                    }
                    .add-button {
                        display: flex;
                        align-items: center;
                        padding: 8px 16px;
                        cursor: pointer;
                        color: var(--vscode-button-foreground);
                        background: var(--vscode-button-background);
                        border: none;
                        border-radius: 4px;
                        margin: 12px 8px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                        position: relative;
                        overflow: hidden;
                    }
                    .add-button:hover {
                        transform: translateY(-1px);
                    }
                    .add-button::after {
                        content: '';
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        top: 0;
                        left: -100%;
                        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
                        transition: 0.5s;
                    }
                    .add-button:hover::after {
                        left: 100%;
                    }
                    .project-settings {
                        position: absolute;
                        right: 12px;
                        top: 50%;
                        transform: translateY(-50%) scale(0.9);
                        cursor: pointer;
                        opacity: 0;
                        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        padding: 6px;
                        border-radius: 4px;
                        z-index: 10;
                        display: flex;
                        align-items: center;
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-input-border);
                    }
                    .project-item:hover .project-settings {
                        opacity: 1;
                        transform: translateY(-50%) scale(1);
                    }
                    .settings-dropdown {
                        position: absolute;
                        right: 110%;
                        top: -20px;
                        background: var(--vscode-menu-background);
                        border: 1px solid var(--vscode-menu-border);
                        border-radius: 6px;
                        padding: 16px;
                        opacity: 0;
                        visibility: hidden;
                        transform: translateX(10px);
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        z-index: 9999;
                        min-width: 240px;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                        margin-right: 8px;
                    }
                    .settings-dropdown.show {
                        opacity: 1;
                        visibility: visible;
                        transform: translateX(0);
                    }
                    .settings-item {
                        margin: 12px 0;
                    }
                    .settings-item label {
                        display: block;
                        margin-bottom: 6px;
                        color: var(--vscode-foreground);
                        font-size: 0.9em;
                        font-weight: 500;
                    }
                    .settings-item input {
                        width: 100%;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        padding: 6px 10px;
                        border-radius: 4px;
                        box-sizing: border-box;
                        transition: all 0.2s ease;
                    }
                    .settings-item input:focus {
                        border-color: var(--vscode-focusBorder);
                        outline: none;
                    }
                    .save-button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-top: 16px;
                        width: 100%;
                        display: none;
                        font-weight: 500;
                        transform: translateY(5px);
                        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .save-button:hover {
                        filter: brightness(1.1);
                        transform: translateY(3px);
                    }
                    .save-button.show {
                        display: block;
                        animation: slideUp 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                    }
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                </style>
            </head>
            <body>
                <div class="section">
                    <div class="section-header">My Projects</div>
                    <div id="projects-list">
                        ${projects.map(project => {
                            const bgColor = project.color || 'var(--vscode-list-activeSelectionBackground)';
                            const textColor = bgColor.toLowerCase() === '#ffffff' ? '#000000' : '#ffffff';
                            return `
                                <div class="project-item"
                                    onclick="openProject('${project.path.replace(/'/g, "\\'")}')"
                                    style="background: ${bgColor};position: relative;z-index: 1;">
                                    <span class="project-icon">${project.icon || '📁'}</span>
                                    <div class="project-info">
                                        <div class="project-name" style="color: ${textColor}">${project.name}</div>
                                        <div class="project-path" style="color: ${textColor}">${project.path}</div>
                                    </div>
                                    <div class="project-settings" onclick="toggleSettings(event, '${project.path.replace(/'/g, "\\'")}')">

                                        Edit
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="1rem" width="1rem" style="margin-left: 0.25rem" stroke-width="1.5" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                        </svg>

                                        <div class="settings-dropdown" id="settings-${project.path.replace(/[^a-zA-Z0-9]/g, '-')}">
                                            <div class="settings-item">
                                                <label>Name:</label>
                                                <input type="text" value="${project.name}"
                                                    oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                            </div>
                                            <div class="settings-item">
                                                <label>Color:</label>
                                                <input type="color" value="${project.color || '#000000'}"
                                                    oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                            </div>
                                            <div class="settings-item">
                                                <label>URL:</label>
                                                <input type="url" value="${project.url || ''}"
                                                    oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                            </div>
                                            <div class="settings-item">
                                                <label>Icon:</label>
                                                <input type="text" value="${project.icon || '📁'}"
                                                    oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                            </div>
                                            <div class="settings-item">
                                                <label>Path:</label>
                                                <input type="text" value="${project.path}"
                                                    oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                            </div>
                                            <button class="save-button" id="save-${project.path.replace(/[^a-zA-Z0-9]/g, '-')}"
                                                onclick="saveChanges('${project.path.replace(/'/g, "\\'")}')">
                                                Save Changes
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <button class="add-button" onclick="addProject()">Add Project</button>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    const pendingChanges = {};

                    function addProject() {
                        vscode.postMessage({ command: 'addProject' });
                    }

                    function openProject(project) {
                        vscode.postMessage({ command: 'openProject', project });
                    }

                    function toggleSettings(event, projectPath) {
                        event.stopPropagation();
                        const dropdownId = 'settings-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-');
                        const dropdown = document.getElementById(dropdownId);

                        document.querySelectorAll('.settings-dropdown.show').forEach(el => {
                            if (el.id !== dropdownId) el.classList.remove('show');
                        });

                        dropdown.classList.toggle('show');
                    }

                    function handleInput(event, projectPath) {
                        const field = event.target.closest('.settings-item').querySelector('label').textContent.toLowerCase().replace(':', '');
                        const value = event.target.value;

                        if (!pendingChanges[projectPath]) {
                            pendingChanges[projectPath] = {};
                        }
                        pendingChanges[projectPath][field] = value;

                        const saveButton = document.getElementById('save-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-'));
                        if (saveButton) {
                            saveButton.classList.add('show');
                        }
                    }

                    function saveChanges(projectPath) {
                        if (pendingChanges[projectPath]) {
                            vscode.postMessage({
                                command: 'updateProject',
                                projectPath: projectPath,
                                updates: pendingChanges[projectPath]
                            });
                            delete pendingChanges[projectPath];

                            const saveButton = document.getElementById('save-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-'));
                            if (saveButton) {
                                saveButton.classList.remove('show');
                            }
                        }
                    }

                    document.addEventListener('click', (event) => {
                        if (!event.target.closest('.project-settings') &&
                            !event.target.closest('.settings-dropdown')) {
                            document.querySelectorAll('.settings-dropdown.show').forEach(el => {
                                el.classList.remove('show');
                            });
                        }
                    });

                    document.querySelectorAll('.settings-dropdown').forEach(dropdown => {
                        dropdown.addEventListener('click', (event) => {
                            event.stopPropagation();
                        });
                    });
                </script>
            </body>
            </html>`;
    }
}
