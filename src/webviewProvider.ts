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
                case 'openUrl':
                    vscode.env.openExternal(vscode.Uri.parse(message.url));
                    break;
                case 'openInFinder':
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(message.path));
                    break;
                case 'deleteProject':
                    vscode.window.showWarningMessage('Do you really want to delete this project?', 'Yes', 'No')
                        .then(selection => {
                            if (selection === 'Yes') {
                                this._deleteProject(message.projectPath);
                            }
                        });
                    break;
            }
        });
    }

    private async _updateProject(projectPath: string, updates: Partial<Project>) {
        try {
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

    private async _deleteProject(projectPath: string) {
        try {
            const configuration = vscode.workspace.getConfiguration('awesomeProjects');
            const projects = [...(configuration.get<Project[]>('projects') || [])];
            const projectIndex = projects.findIndex(p => p.path === projectPath);

            if (projectIndex !== -1) {
                projects.splice(projectIndex, 1);
                await configuration.update('projects', projects, vscode.ConfigurationTarget.Global);
                this.refresh();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete project: ${error}`);
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
        const useFavicons = configuration.get<boolean>('useFavicons') ?? true;

        const generateGradient = (baseColor: string): string => {
            const hex = baseColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);

            const darkerR = Math.max(0, r - 80);
            const darkerG = Math.max(0, g - 80);
            const darkerB = Math.max(0, b - 80);

            return `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
        };

        const getContrastColor = (hexColor: string): string => {
            const color = hexColor.replace('#', '');

            const r = parseInt(color.substr(0, 2), 16);
            const g = parseInt(color.substr(2, 2), 16);
            const b = parseInt(color.substr(4, 2), 16);

            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

            return luminance > 0.5 ? '#000000' : '#ffffff';
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
                        from { opacity: 0; }
                        to { opacity: 1; }
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
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        border-radius: 6px 6px 0 0;
                        position: relative;
background: linear-gradient(135deg,
    color-mix(in srgb, var(--bg-color) 80%, transparent),
    color-mix(in srgb, var(--bg-gradient) 80%, transparent)
);
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
                        margin-bottom: 10px;  /* Add this line */
                        animation: slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .project-info-dropdown.show {
                        display: block;
                    }
                    .color-container {
                        display: flex;
                        gap: 4px;
                        align-items: center;
                    }
                    .reset-color, .random-color {
                        padding: 4px 8px;
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-button-border);
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 0.9em;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .reset-color:hover, .random-color:hover {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
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
                        transition: all 0.2s ease;
                    }
                    .info-action-button:hover {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        transform: translateY(-1px);
                    }
                    .project-item:not(.active) {
                        border-radius: 6px;
                    }
                    .project-item:hover {
                        border-color: var(--vscode-input-border);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                        background: linear-gradient(135deg,
                            var(--bg-color),
                            var(--bg-gradient)
                        );
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .project-icon {
                        margin-right: 12px;
                        width: 16px;
                        height: 16px;
                        transition: transform 0.2s ease;
                        display: flex;
                        align-items: center;
                    }
                    .project-icon img {
                        width: 16px;
                        height: 16px;
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
                        margin-bottom: 10px;  /* Add this line */
                        animation: slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        position: relative; /* Wichtig für absolute Positionierung des Delete-Links */
                    }
                    .settings-dropdown.show {
                        display: block;
                    }
                    @keyframes slideDown {
                        from { opacity: 0; }
                        to { opacity: 1; }
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
                        height: 30px;
                        max-width: 30px;
                        border-radius: 5px;
                        margin-right: 6px;
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
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    .project-url {
                        opacity: 0.7;
                        text-decoration: none;
                        color: var(--vscode-foreground);
                        display: flex;
                        align-items: center;
                        gap: 5px;
                        padding: 3px 0;
                        transition: opacity 0.4s ease-in-out;
                    }
                    .project-url:hover {
                        text-decoration: underline;
                        opacity: 1;
                    }
                    .delete-link {
                        bottom: 16px;
                        right: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        gap: 6px;
                        color: var(--vscode-Foreground);
                        opacity: 0.7;
                        font-size: 12px;
                        cursor: pointer;
                        transition: opacity 0.3s ease;
                        z-index: 10;
                        margin-top: 1rem;
                    }
                    .delete-link:hover {
                        opacity: 1;
                        color: var(--vscode-errorForeground);
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

                            const textColor = project.color ? getContrastColor(project.color) : '#ffffff';

                            const getBaseUrl = (url?: string) => {
                                if (!url) return null;
                                try {
                                    const urlObj = new URL(url);
                                    return urlObj.protocol + '//' + urlObj.hostname;
                                } catch (e) {
                                    return null;
                                }
                            };

                            const baseUrl = useFavicons ? (
                                getBaseUrl(project.productionUrl) ||
                                getBaseUrl(project.stagingUrl) ||
                                getBaseUrl(project.devUrl) ||
                                getBaseUrl(project.managementUrl)
                            ) : null;

                            const faviconHtml = baseUrl && useFavicons
                                ? `<img src="https://www.google.com/s2/favicons?domain=${baseUrl}" onerror="this.parentElement.innerHTML='📁'">`
                                : '📁';

                            return `
                                <div class="project-wrapper">
                                    <div class="project-item"
                                        style="--bg-color: ${bgColor}; --bg-gradient: ${gradientColor}"
                                        onclick="toggleInfo(event, '${project.path.replace(/'/g, "\\'")}')">
                                        <span class="project-icon">${faviconHtml}</span>
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
                                        ${project.productionUrl || project.devUrl || project.stagingUrl || project.managementUrl ? `
                                        <div class="info-section">
                                            <div class="info-label">URLs</div>
                                            <div class="info-value">
                                                ${project.productionUrl ? `
                                                    <a href="${project.productionUrl.replace(/'/g, "\\'")}" class="project-url" onclick="openUrl(event, '${project.productionUrl.replace(/'/g, "\\'")}')">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9-3-9m-9 9a9 9 0 019-9"/>
                                                        </svg>
                                                        Production
                                                    </a>
                                                ` : ''}
                                                ${project.stagingUrl ? `
                                                    <a href="${project.stagingUrl.replace(/'/g, "\\'")}" class="project-url" onclick="openUrl(event, '${project.stagingUrl.replace(/'/g, "\\'")}')">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                                        </svg>
                                                        Staging
                                                    </a>
                                                ` : ''}
                                                ${project.devUrl ? `
                                                    <a href="${project.devUrl.replace(/'/g, "\\'")}" class="project-url" onclick="openUrl(event, '${project.devUrl.replace(/'/g, "\\'")}')">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                                        </svg>
                                                        Development
                                                    </a>
                                                ` : ''}
                                                ${project.managementUrl ? `
                                                    <a href="${project.managementUrl.replace(/'/g, "\\'")}" class="project-url" onclick="openUrl(event, '${project.managementUrl.replace(/'/g, "\\'")}')">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
                                                        </svg>
                                                        Management (Jira, Trello, etc.)
                                                    </a>
                                                ` : ''}
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
                                            <div class="color-container">
                                                <input type="color" value="${project.color || '#000000'}"
                                                    oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                                <button class="random-color" style="display:flex; items-align:center" onclick="setRandomColor(event, '${project.path.replace(/'/g, "\\'")}')">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                        <path d="M18 4l3 3l-3 3" />
                                                        <path d="M18 20l3 -3l-3 -3" />
                                                        <path d="M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5" />
                                                        <path d="M21 7h-5a4.978 4.978 0 0 0 -3 1m-4 8a4.984 4.984 0 0 1 -3 1h-3" />
                                                    </svg>
                                                    Randomize
                                                </button>
                                                <button class="reset-color" onclick="resetColor(event, '${project.path.replace(/'/g, "\\'")}')">
                                                    <svg  xmlns="http://www.w3.org/2000/svg"  width="16"  height="16"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-back-up"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" /></svg>
                                                    Reset
                                                </button>
                                            </div>
                                        </div>
                                        <div class="settings-item">
                                            <label>Production URL:</label>
                                            <input type="url" value="${project.productionUrl || ''}"
                                                oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                        </div>
                                        <div class="settings-item">
                                            <label>Staging URL:</label>
                                            <input type="url" value="${project.stagingUrl || ''}"
                                                oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                        </div>
                                        <div class="settings-item">
                                            <label>Development URL:</label>
                                            <input type="url" value="${project.devUrl || ''}"
                                                oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                        </div>
                                        <div class="settings-item">
                                            <label>Management URL:</label>
                                            <input type="url" value="${project.managementUrl || ''}"
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
                                        <span class="delete-link" onclick="deleteProject('${project.path.replace(/'/g, "\\'")}')">
                                            Delete
                                            <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                                                <path fill-rule="evenodd" clip-rule="evenodd" d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H6v1h3V2zM4 13h7V4H4v9zm2-8H5v7h1V5zm1 0h1v7H7V5zm2 0h1v7H9V5z"/>
                                            </svg>
                                        </span>
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
                        const labelMap = {
                            'production url': 'productionUrl',
                            'staging url': 'stagingUrl',
                            'development url': 'devUrl',
                            'management url': 'managementUrl',
                            'name': 'name',
                            'color': 'color',
                            'path': 'path'
                        };

                        const label = event.target.closest('.settings-item').querySelector('label').textContent.toLowerCase().replace(':', '');
                        const field = labelMap[label] || label;
                        let value = event.target.value;

                        if (field === 'color') {
                            const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
                            if (!value.startsWith('#')) {
                                value = '#' + value;
                            }
                            if (!isValidHex.test(value)) {
                                return;
                            }
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

                    function openUrl(event, url) {
                        event.preventDefault();
                        vscode.postMessage({
                            command: 'openUrl',
                            url: url
                        });
                    }

                    function deleteProject(projectPath) {
                        vscode.postMessage({
                            command: 'deleteProject',
                            projectPath: projectPath
                        });
                    }

                    function resetColor(event, projectPath) {
                        event.preventDefault();
                        const colorInput = event.target.closest('.color-container').querySelector('input[type="color"]');
                        colorInput.value = '#000000';
                        colorInput.removeAttribute('value');

                        if (!pendingChanges[projectPath]) {
                            pendingChanges[projectPath] = {};
                        }
                        pendingChanges[projectPath]['color'] = '';

                        const projectItem = event.target.closest('.project-wrapper').querySelector('.project-item');
                        projectItem.style.removeProperty('--bg-color');
                        projectItem.style.removeProperty('--bg-gradient');

                        const saveButton = document.getElementById('save-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-'));
                        if (saveButton) {
                            saveButton.classList.add('show');
                        }
                    }

                    function setRandomColor(event, projectPath) {
                        event.preventDefault();
                        const colorInput = event.target.previousElementSibling;
                        const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                        colorInput.value = randomColor;

                        if (!pendingChanges[projectPath]) {
                            pendingChanges[projectPath] = {};
                        }
                        pendingChanges[projectPath]['color'] = randomColor;

                        const projectItem = event.target.closest('.project-wrapper').querySelector('.project-item');
                        const gradientColor = generateGradient(randomColor);
                        projectItem.style.setProperty('--bg-color', randomColor);
                        projectItem.style.setProperty('--bg-gradient', gradientColor);

                        const saveButton = document.getElementById('save-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-'));
                        if (saveButton) {
                            saveButton.classList.add('show');
                        }
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
