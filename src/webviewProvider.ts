import * as vscode from 'vscode';
import { Project } from './types';

export class ProjectsWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'awesomeProjectsView';
    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {
        // Add configuration change listener
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

        // Handle messages from the webview
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

                                // Create new project object
                                const newProject: Project = {
                                    path: projectPath,
                                    name: await vscode.window.showInputBox({
                                        prompt: 'Enter project name',
                                        value: projectPath.split('/').pop()
                                    }) || projectPath.split('/').pop() || ''
                                };

                                // Update settings.json
                                await configuration.update(
                                    'projects',
                                    [...projects, newProject],
                                    vscode.ConfigurationTarget.Global
                                );

                                // Verify the update
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
            }
        });
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
                    }
                    .section-header {
                        padding: 8px;
                        font-weight: bold;
                        background: var(--vscode-sideBar-background);
                        border-bottom: 1px solid var(--vscode-sideBar-border);
                    }
                    .project-item {
                        display: flex;
                        align-items: center;
                        padding: 6px 8px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        border-radius: 4px;
                        margin: 2px 4px;
                    }
                    .project-item:hover {
                        filter: brightness(1.1);
                    }
                    .project-icon {
                        margin-right: 8px;
                    }
                    .project-info {
                        flex: 1;
                    }
                    .project-name {
                        font-weight: 500;
                    }
                    .project-path {
                        font-size: 0.85em;
                        opacity: 0.8;
                    }
                    .add-button {
                        display: flex;
                        align-items: center;
                        padding: 6px 8px;
                        cursor: pointer;
                        color: var(--vscode-button-foreground);
                        background: var(--vscode-button-background);
                        border: none;
                        border-radius: 3px;
                        margin: 8px;
                    }
                    .add-button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="section">
                    <div class="section-header">My Projects</div>
                    <div id="projects-list">
                        ${projects.map(project => {
                            const bgColor = project.color || 'var(--vscode-list-activeSelectionBackground)';
                            // Berechne Textfarbe basierend auf Hintergrundfarbe
                            const textColor = bgColor.toLowerCase() === '#ffffff' ? '#000000' : '#ffffff';
                            return `
                                <div class="project-item"
                                    onclick="openProject('${project.path.replace(/'/g, "\\'")}')"
                                    style="background: ${bgColor};">
                                    <span class="project-icon">${project.icon || '📁'}</span>
                                    <div class="project-info">
                                        <div class="project-name" style="color: ${textColor}">${project.name}</div>
                                        <div class="project-path" style="color: ${textColor}">${project.path}</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <button class="add-button" onclick="addProject()">Add Project</button>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();

                    function addProject() {
                        vscode.postMessage({ command: 'addProject' });
                    }

                    function openProject(project) {
                        vscode.postMessage({ command: 'openProject', project });
                    }
                </script>
            </body>
            </html>`;
    }
}
