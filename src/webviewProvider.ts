import * as vscode from 'vscode';
import { Project } from './extension';
import { loadResourceFile } from './utils/resourceLoader';
import { generateGradient, getContrastColor } from './utils/colorUtils';

export class ProjectsWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'awesomeProjectsView';
    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
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

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview);

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
                case 'reorderProjects':
                    this._reorderProjects(message.oldIndex, message.newIndex);
                    break;
                case 'showInFileManager':
                    vscode.commands.executeCommand('awesome-projects.showInFileManager', message.project);
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

            const urlFields: (keyof Pick<Project, 'productionUrl' | 'devUrl' | 'stagingUrl' | 'managementUrl'>)[] = [
                'productionUrl',
                'devUrl',
                'stagingUrl',
                'managementUrl'
            ];

            urlFields.forEach(field => {
                const value = updates[field];
                if (typeof value === 'string' && value && !/^https?:\/\//i.test(value)) {
                    updates[field] = `https://${value}`;
                }
            });

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

    private async _reorderProjects(oldIndex: number, newIndex: number) {
        try {
            this._setLoading(true);
            const configuration = vscode.workspace.getConfiguration('awesomeProjects');
            const projects = [...(configuration.get<Project[]>('projects') || [])];
            const [movedProject] = projects.splice(oldIndex, 1);
            projects.splice(newIndex, 0, movedProject);
            await configuration.update('projects', projects, vscode.ConfigurationTarget.Global);
            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to reorder projects: ${error}`);
        } finally {
            this._setLoading(false);
        }
    }

    private _setLoading(isLoading: boolean) {
        if (this._view) {
            this._view.webview.postMessage({ command: 'setLoading', isLoading });
        }
    }

    public async refresh() {
        if (this._view) {
            this._view.webview.html = await this._getHtmlForWebview(this._view.webview);
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

    private async _getHtmlForWebview(webview: vscode.Webview) {
        let cssContent;
        try {
            cssContent = await loadResourceFile(this._context, 'dist/css/webview.css');
            if (!cssContent) {
                cssContent = await loadResourceFile(this._context, 'src/css/webview.css');
            }
        } catch (error) {
            console.error('Failed to load CSS:', error);
            cssContent = `
                body { padding: 0; margin: 0; }
                .section { margin-bottom: 20px; }
            `;
        }

        const configuration = vscode.workspace.getConfiguration('awesomeProjects');
        const projects = configuration.get<Project[]>('projects') || [];
        const useFavicons = configuration.get<boolean>('useFavicons') ?? true;
        let version = require('../package.json').version;
        if (parseFloat(version) < 1.0) {
            version += ' Preview - Please report Issues';
        }

        return `<!DOCTYPE html>
            <html>
            <head>
                <style>${cssContent}</style>
            </head>
            <body>
                <div class="section">
                    <div class="section-header">My Projects</div>
                    <div id="loading-spinner" class="loading-spinner hidden"></div>
                    <div id="projects-list" class="draggable-list">
                        ${projects
                            .map((project, index) => {
                                const bgColor = project.color || "var(--vscode-list-activeSelectionBackground)";
                                const gradientColor = project.color ? generateGradient(project.color) : "var(--vscode-list-activeSelectionBackground)";

                                const textColor = project.color ? getContrastColor(project.color) : "#ffffff";

                                const getBaseUrl = (url?: string) => {
                                    if (!url) {return null;}
                                    try {
                                        const urlObj = new URL(url);
                                        return urlObj.protocol + "//" + urlObj.hostname;
                                    } catch (e) {
                                        return null;
                                    }
                                };

                                const baseUrl = useFavicons
                                    ? getBaseUrl(project.productionUrl) || getBaseUrl(project.stagingUrl) || getBaseUrl(project.devUrl) || getBaseUrl(project.managementUrl)
                                    : null;

                                const faviconHtml =
                                    baseUrl && useFavicons ? `<img src="https://www.google.com/s2/favicons?domain=${baseUrl}" onerror="this.parentElement.innerHTML='📁'">` : "📁";

                                return `
                                <div class="project-wrapper" draggable="true" data-index="${index}">
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
                                    <div class="project-info-dropdown" id="info-${project.path.replace(/[^a-zA-Z0-9]/g, "-")}">
                                        <div class="info-section">
                                            <div class="info-label">Path</div>
                                            <div class="info-value">${project.path}</div>
                                        </div>
                                        ${
                                            project.productionUrl || project.devUrl || project.stagingUrl || project.managementUrl
                                                ? `
                                        <div class="info-section">
                                            <div class="info-label">URLs</div>
                                            <div class="info-value">
                                                ${
                                                    project.productionUrl
                                                        ? `
                                                    <a href="${project.productionUrl.replace(
                                                        /'/g,
                                                        "\\'"
                                                    )}" class="project-url" onclick="openUrl(event, '${project.productionUrl.replace(/'/g, "\\'")}')">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9-3-9m-9 9a9 9 0 019-9"/>
                                                        </svg>
                                                        Production
                                                    </a>
                                                `
                                                        : ""
                                                }
                                                ${
                                                    project.stagingUrl
                                                        ? `
                                                    <a href="${project.stagingUrl.replace(/'/g, "\\'")}" class="project-url" onclick="openUrl(event, '${project.stagingUrl.replace(
                                                              /'/g,
                                                              "\\'"
                                                          )}')">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                                        </svg>
                                                        Staging
                                                    </a>
                                                `
                                                        : ""
                                                }
                                                ${
                                                    project.devUrl
                                                        ? `
                                                    <a href="${project.devUrl.replace(/'/g, "\\'")}" class="project-url" onclick="openUrl(event, '${project.devUrl.replace(
                                                              /'/g,
                                                              "\\'"
                                                          )}')">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                                        </svg>
                                                        Development
                                                    </a>
                                                `
                                                        : ""
                                                }
                                                ${
                                                    project.managementUrl
                                                        ? `
                                                    <a href="${project.managementUrl.replace(
                                                        /'/g,
                                                        "\\'"
                                                    )}" class="project-url" onclick="openUrl(event, '${project.managementUrl.replace(/'/g, "\\'")}')">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
                                                        </svg>
                                                        Management (Jira, Trello, etc.)
                                                    </a>
                                                `
                                                        : ""
                                                }
                                            </div>
                                        </div>
                                        `
                                                : ""
                                        }
                                        <div class="info-actions">
                                            <button class="info-action-button" onclick="openProject('${project.path.replace(/'/g, "\\'")}')">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"/>
                                                </svg>
                                                Open Project
                                            </button>
                                            <button class="info-action-button show-in-file-manager" data-path="${project.path.replace(/'/g, "\\'")}" data-name="${project.name}">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                                </svg>
                                                Show in File Manager
                                            </button>
                                        </div>
                                    </div>
                                    <div class="settings-dropdown" id="settings-${project.path.replace(/[^a-zA-Z0-9]/g, "-")}">
                                        <div class="settings-item">
                                            <label>Name:</label>
                                            <input placeholder="Projectname" type="text" value="${project.name}"
                                                oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                        </div>
                                        <div class="settings-item">
                                            <label>Color:</label>
                                            <div class="color-container">
                                                <input type="color" class="project-color-input" value="${project.color || bgColor}"
                                                    data-uses-theme-color="${!project.color}"
                                                    oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                                <button class="random-color" style="display:flex; items-align:center" onclick="setRandomColor(event, '${project.path.replace(
                                                    /'/g,
                                                    "\\'"
                                                )}')">
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
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                                                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                                        <path d="M9 14l-4 -4l4 -4" />
                                                        <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
                                                    </svg>
                                                    Reset
                                                </button>
                                            </div>
                                        </div>
                                        <div class="settings-item">
                                            <label>Production URL:</label>
                                            <input placeholder="https://.." type="url" value="${project.productionUrl || ""}"
                                                oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                        </div>
                                        <div class="settings-item">
                                            <label>Staging URL:</label>
                                            <input placeholder="https://.." type="url" value="${project.stagingUrl || ""}"
                                                oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                        </div>
                                        <div class="settings-item">
                                            <label>Local development URL:</label>
                                            <input placeholder="https://.." type="url" value="${project.devUrl || ""}"
                                                oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                        </div>
                                        <div class="settings-item">
                                            <label>Management URL (e.G. Jira, Trello ... ):</label>
                                            <input placeholder="https://.." type="url" value="${project.managementUrl || ""}"
                                                oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                        </div>
                                        <div class="settings-item">
                                            <label>Path:</label>
                                            <input placeholder="~/path/to/your/project/" type="text" value="${project.path}"
                                                oninput="handleInput(event, '${project.path.replace(/'/g, "\\'")}')">
                                        </div>
                                        <button class="save-button" id="save-${project.path.replace(/[^a-zA-Z0-9]/g, "-")}"
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
                            })
                            .join("")}
                    </div>
                    <button class="add-button" onclick="addProject()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                            <path d="M20 6v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1z" />
                            <path d="M12 15l0 4" />
                            <path d="M14 17l-4 0" />
                        </svg>
                        Add Project
                    </button>
                    <div class="support-box">
                        <a href="https://github.com/OpenForgeProject/vscode-ext-awesome-projects/issues/new/choose" class="support-link">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path
                                    d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" />
                            </svg>
                            Report Issues & Feature requests
                        </a>
                        <a href="https://github.com/sponsors/dermatz" class="support-link">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M13 19l-1 1l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 0 1 8.785 4.444" />
                                <path d="M21 15h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5" />
                                <path d="M19 21v1m0 -8v1" />
                            </svg>
                            Support this Project
                        </a>
                    </div>
                    <div class="support-box">
                        <span class="version-info">Version ${version}</span>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    const pendingChanges = {};

                    document.addEventListener('DOMContentLoaded', () => {
                        document.querySelectorAll('.project-color-input').forEach(input => {
                            if (input.getAttribute('data-uses-theme-color') === 'true') {
                                const themeColor = getComputedStyle(document.documentElement)
                                    .getPropertyValue('--vscode-list-activeSelectionBackground')
                                    .trim();
                                if (themeColor.startsWith('rgb')) {
                                    const rgb = themeColor.match(/d+/g);
                                    if (rgb && rgb.length === 3) {
                                        const hex = '#' + rgb.map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
                                        input.value = hex;
                                    }
                                } else if (themeColor.startsWith('#')) {
                                    input.value = themeColor;
                                }
                            }
                        });
                    });

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
                        const themeColor = getComputedStyle(document.documentElement)
                            .getPropertyValue('--vscode-list-activeSelectionBackground')
                            .trim();

                        // Konvertiere RGB zu Hex wenn nötig
                        let hexColor = themeColor;
                        if (themeColor.startsWith('rgb')) {
                            const rgb = themeColor.match(/d+/g);
                            if (rgb && rgb.length === 3) {
                                hexColor = '#' + rgb.map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
                            }
                        }

                        colorInput.value = hexColor;
                        colorInput.setAttribute('data-uses-theme-color', 'true');

                        if (!pendingChanges[projectPath]) {
                            pendingChanges[projectPath] = {};
                        }
                        pendingChanges[projectPath]['color'] = null;

                        const projectItem = event.target.closest('.project-wrapper').querySelector('.project-item');
                        projectItem.style.setProperty('--bg-color', 'var(--vscode-list-activeSelectionBackground)');
                        projectItem.style.setProperty('--bg-gradient', 'var(--vscode-list-activeSelectionBackground)');

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

                    const list = document.getElementById('projects-list');
                    const loadingSpinner = document.getElementById('loading-spinner');
                    let dragSrcEl = null;
                    let isSaving = false;

                    function handleDragStart(e) {
                        if (isSaving) return;
                        dragSrcEl = this;
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/html', this.innerHTML);
                        this.classList.add('dragging');
                    }

                    function handleDragOver(e) {
                        if (isSaving) return;
                        if (e.preventDefault) {
                            e.preventDefault();
                        }
                        e.dataTransfer.dropEffect = 'move';
                        return false;
                    }

                    function handleDragEnter() {
                        if (isSaving) return;
                        this.classList.add('over');
                    }

                    function handleDragLeave() {
                        if (isSaving) return;
                        this.classList.remove('over');
                    }

                    function handleDrop(e) {
                        if (isSaving) return;
                        if (e.stopPropagation) {
                            e.stopPropagation();
                        }
                        if (dragSrcEl !== this) {
                            const oldIndex = parseInt(dragSrcEl.getAttribute('data-index'));
                            const newIndex = parseInt(this.getAttribute('data-index'));
                            dragSrcEl.innerHTML = this.innerHTML;
                            this.innerHTML = e.dataTransfer.getData('text/html');
                            vscode.postMessage({
                                command: 'reorderProjects',
                                oldIndex: oldIndex,
                                newIndex: newIndex
                            });
                        }
                        return false;
                    }

                    function handleDragEnd() {
                        if (isSaving) return;
                        this.classList.remove('dragging');
                        document.querySelectorAll('.project-wrapper').forEach(item => {
                            item.classList.remove('over');
                            item.classList.remove('insert-top');
                            item.classList.remove('insert-bottom');
                        });
                    }

                    document.querySelectorAll('.project-wrapper').forEach(item => {
                        item.addEventListener('dragstart', handleDragStart, false);
                        item.addEventListener('dragenter', handleDragEnter, false);
                        item.addEventListener('dragover', handleDragOver, false);
                        item.addEventListener('dragleave', handleDragLeave, false);
                        item.addEventListener('drop', handleDrop, false);
                        item.addEventListener('dragend', handleDragEnd, false);
                    });

                    document.querySelectorAll('.project-wrapper').forEach(item => {
                        item.addEventListener('dragover', function(e) {
                            if (isSaving) return;
                            const bounding = this.getBoundingClientRect();
                            const offset = bounding.y + (bounding.height / 2);
                            if (e.clientY - offset > 0) {
                                this.classList.add('insert-bottom');
                                this.classList.remove('insert-top');
                            } else {
                                this.classList.add('insert-top');
                                this.classList.remove('insert-bottom');
                            }
                        });
                    });

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

                    document.addEventListener('click', (e) => {
                        const target = e.target.closest('.show-in-file-manager');
                        if (target) {
                            const projectPath = target.getAttribute('data-path');
                            const projectName = target.getAttribute('data-name');
                            console.log('Sending showInFileManager command', { projectPath, projectName });
                            vscode.postMessage({
                                command: 'showInFileManager',
                                project: {
                                    path: projectPath,
                                    name: projectName
                                }
                            });
                        }
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'setLoading') {
                            isSaving = message.isLoading;
                            if (message.isLoading) {
                                loadingSpinner.classList.remove('hidden');
                            } else {
                                loadingSpinner.classList.add('hidden');
                            }
                        }
                    });
                </script>
            </body>
            </html>`;
    }
}
