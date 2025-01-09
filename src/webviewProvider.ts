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
                    vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(message.project));
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
            // Validate color format if it exists in updates
            if (updates.color) {
                const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
                if (!isValidHex.test(updates.color)) {
                    throw new Error('Invalid color format');
                }
            }

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

        // Gradient helper function
        const generateGradient = (baseColor: string): string => {
            const hex = baseColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);

            const darkerR = Math.max(0, r - 40);
            const darkerG = Math.max(0, g - 40);
            const darkerB = Math.max(0, b - 40);

            return `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
        };

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
                    .project-wrapper {
                        margin: 4px 6px;
                    }
                    .project-item {
                        display: flex;
                        align-items: center;
                        padding: 10px 12px;
                        cursor: pointer;
                        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        border-radius: 6px 6px 0 0;
                        position: relative;
                        background: linear-gradient(135deg, var(--bg-color) 0%, var(--bg-gradient) 100%);
                        border: 1px solid transparent;
                    }
                    .project-info-dropdown {
                        display: none;
                        background: var(--vscode-menu-background);
                        border: 1px solid var(--vscode-input-border);
                        border-top: none;
                        border-radius: 0 0 6px 6px;
                        padding: 16px;
                        margin-top: -1px;
                        animation: slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .project-info-dropdown.show {
                        display: block;
                    }
                    .info-section {
                        margin-bottom: 12px;
                    }
                    .info-label {
                        font-size: 0.85em;
                        color: var(--vscode-foreground);
                        opacity: 0.7;
                        margin-bottom: 4px;
                    }
                    .info-value {
                        font-size: 0.95em;
                        color: var(--vscode-foreground);
                    }
                    .info-actions {
                        display: flex;
                        gap: 8px;
                        margin-top: 12px;
                    }
                    .info-action-button {
                        padding: 4px 8px;
                        border-radius: 3px;
                        border: 1px solid var(--vscode-button-border);
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        cursor: pointer;
                        font-size: 0.9em;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .project-item:not(.active) {
                        border-radius: 6px;
                    }
                    .project-item:hover {
                        border-color: var(--vscode-input-border);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    }
                    .project-item.active {
                        border-color: var(--vscode-input-border);
                        border-bottom-color: transparent;
                        background: var(--vscode-menu-background);
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
                        z-index: 1;
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
                        display: none;
                        background: var(--vscode-menu-background);
                        border: 1px solid var(--vscode-input-border);
                        border-top: none;
                        border-radius: 0 0 6px 6px;
                        padding: 16px;
                        margin-top: -1px;
                        animation: slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .settings-dropdown.show {
                        display: block;
                    }
                    @keyframes slideDown {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
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
                    .settings-item input[type="color"] {
                        padding: 0;
                        height: 40px;
                        cursor: pointer;
                    }
                    .settings-item input[type="color"]::-webkit-color-swatch-wrapper {
                        padding: 0;
                    }
                    .settings-item input[type="color"]::-webkit-color-swatch {
                        border: none;
                        border-radius: 3px;
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
                            const gradientColor = project.color ? generateGradient(project.color) : 'var(--vscode-list-activeSelectionBackground)';
                            const textColor = bgColor.toLowerCase() === '#ffffff' ? '#000000' : '#ffffff';
                            return `
                                <div class="project-wrapper">
                                    <div class="project-item"
                                        style="--bg-color: ${bgColor}; --bg-gradient: ${gradientColor}"
                                        onclick="toggleInfo(event, '${project.path.replace(/'/g, "\\'")}')">
                                        <span class="project-icon">${project.icon || '📁'}</span>
                                        <div class="project-info">
                                            <div class="project-name" style="color: ${textColor}">${project.name}</div>
                                        </div>
                                        <div class="project-settings" onclick="toggleSettings(event, '${project.path.replace(/'/g, "\\'")}')">
                                            Edit
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="1rem" width="1rem" style="margin-left: 0.25rem" stroke-width="1.5" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div class="project-info-dropdown" id="info-${project.path.replace(/[^a-zA-Z0-9]/g, '-')}">
                                        <div class="info-section">
                                            <div class="info-label">Path</div>
                                            <div class="info-value">${project.path}</div>
                                        </div>
                                        ${project.url ? `
                                        <div class="info-section">
                                            <div class="info-label">URL</div>
                                            <div class="info-value">
                                                <a href="#" onclick="openUrl(event, '${project.url.replace(/'/g, "\\'")}')">
                                                    ${project.url}
                                                </a>
                                            </div>
                                        </div>
                                        ` : ''}
                                        <div class="info-actions">
                                            <button class="info-action-button" onclick="openProject('${project.path.replace(/'/g, "\\'")}')">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"/>
                                                </svg>
                                                Open Project
                                            </button>
                                            <button class="info-action-button" onclick="openInFinder('${project.path.replace(/'/g, "\\'")}')">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                                </svg>
                                                Show in Finder
                                            </button>
                                        </div>
                                    </div>
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
                        const projectItem = event.target.closest('.project-item');

                        // Close all other dropdowns
                        document.querySelectorAll('.settings-dropdown.show').forEach(el => {
                            if (el.id !== dropdownId) {
                                el.classList.remove('show');
                                el.previousElementSibling.classList.remove('active');
                            }
                        });

                        if (dropdown) {
                            dropdown.classList.toggle('show');
                            projectItem.classList.toggle('active');
                        }
                    }

                    function handleInput(event, projectPath) {
                        const field = event.target.closest('.settings-item').querySelector('label').textContent.toLowerCase().replace(':', '');
                        let value = event.target.value;

                        if (field === 'color') {
                            const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa6-f0-9]{3})$/;
                            if (!value.startsWith('#')) {
                                value = '#' + value;
                            }
                            if (!isValidHex.test(value)) {
                                return;
                            }
                            // Update gradient in real-time
                            const projectItem = event.target.closest('.project-wrapper').querySelector('.project-item');
                            const gradientColor = generateGradient(value);
                            projectItem.style.setProperty('--bg-color', value);
                            projectItem.style.setProperty('--bg-gradient', gradientColor);
                        }

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

                    function toggleInfo(event, projectPath) {
                        if (event.target.closest('.project-settings')) {
                            return;
                        }

                        const infoId = 'info-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-');
                        const infoDropdown = document.getElementById(infoId);
                        const projectItem = event.currentTarget;

                        // Close all other dropdowns
                        document.querySelectorAll('.project-info-dropdown.show, .settings-dropdown.show').forEach(el => {
                            if (el.id !== infoId) {
                                el.classList.remove('show');
                                el.previousElementSibling.classList.remove('active');
                            }
                        });

                        if (infoDropdown) {
                            infoDropdown.classList.toggle('show');
                            projectItem.classList.toggle('active');
                        }
                    }

                    function openInFinder(path) {
                        vscode.postMessage({
                            command: 'openInFinder',
                            path: path
                        });
                    }

                    function generateGradient(baseColor) {
                        const hex = baseColor.replace('#', '');
                        const r = parseInt(hex.substring(0, 2), 16);
                        const g = parseInt(hex.substring(2, 4), 16);
                        const b = parseInt(hex.substring(4, 6), 16);

                        const darkerR = Math.max(0, r - 40);
                        const darkerG = Math.max(0, g - 40);
                        const darkerB = Math.max(0, b - 40);

                        return 'rgb(' + darkerR + ', ' + darkerG + ', ' + darkerB + ')';
                    }

                    document.addEventListener('click', (event) => {
                        if (!event.target.closest('.project-wrapper')) {
                            document.querySelectorAll('.settings-dropdown.show').forEach(el => {
                                el.classList.remove('show');
                                el.previousElementSibling.classList.remove('active');
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
