import * as vscode from 'vscode';
import { Project } from './extension';
import { loadResourceFile } from './template/utils/resourceLoader';
import { getHeaderHtml } from './template/webview/header';
import { getFooterHtml } from './template/webview/footer';
import { getProjectListHtml } from './template/project/projectlist';
import { getProjectItemHtml } from './template/project/components/project-item';
import { scanForGitProjects, addScannedProjects } from './utils/scanForProjects';
import { openProjectInNewWindow, openUrl } from './template/project/utils/projectOpener';
import { WebviewMessage } from './types/webviewMessages';
import { getProjectId } from './template/project/utils/project-id';
import * as path from 'path';

/**
 * Project Components
 */

export class ProjectsWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'awesomeProjectsView';
    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];
    private _messageHandlers: ((message: WebviewMessage) => void)[] = [];
    private _isFirstLoad: boolean = true;
    private _cachedCss: string = '';

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

        // Initially only load a loading indicator
        if (this._isFirstLoad) {
            webviewView.webview.html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        .loading-spinner {
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            border: 4px solid rgba(0, 0, 0, 0.1);
                            border-top: 4px solid var(--vscode-progressBar-background);
                            border-radius: 50%;
                            width: 40px;
                            height: 40px;
                            animation: spin 1s linear infinite;
                        }
                        @keyframes spin {
                            0% { transform: translate(-50%, -50%) rotate(0deg); }
                            100% { transform: translate(-50%, -50%) rotate(360deg); }
                        }
                    </style>
                </head>
                <body>
                    <div class="loading-spinner"></div>
                </body>
                </html>
            `;

            // Delay loading the full content
            setTimeout(async () => {
                webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview);
                this._isFirstLoad = false;
            }, 100);
        } else {
            webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview);
        }

        webviewView.webview.onDidReceiveMessage(message => {
            // Forward all messages to message handlers first
            this.handleMessage(message);

            // Then handle local commands
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

                                const name = await vscode.window.showInputBox({
                                    prompt: 'Enter project name',
                                    value: projectPath.split('/').pop()
                                }) || projectPath.split('/').pop() || '';

                                const newProject: Project = {
                                    id: getProjectId({ path: projectPath, name, color: null } as Project),
                                    path: projectPath,
                                    name,
                                    color: null
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
                    openProjectInNewWindow(message.project);
                    break;
                case 'projectSelected':
                    vscode.window.showInformationMessage(`Project selected: ${message.path}`);
                    break;
                case 'updateProject':
                    this._updateProject(message.projectId, message.updates);
                    break;
                case 'openUrl':
                    openUrl(message.url);
                    break;
                case 'reorderProjects':
                    this._reorderProjects(message.oldIndex, message.newIndex);
                    break;
                case 'scanProjects':
                    vscode.window.showOpenDialog({
                        canSelectFolders: true,
                        canSelectMany: false,
                        title: 'Select folder to scan for Git projects'
                    }).then(async folderUri => {
                        if (folderUri && folderUri[0]) {
                            try {
                                this._setLoading(true);
                                const projects = await scanForGitProjects(folderUri[0].fsPath);
                                await addScannedProjects(projects);
                                this.refresh();
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to scan for projects: ${error}`);
                            } finally {
                                this._setLoading(false);
                            }
                        }
                    });
                    break;
            }
        });
    }

    public onDidReceiveMessage(handler: (message: WebviewMessage) => void): vscode.Disposable {
        this._messageHandlers.push(handler);
        return {
            dispose: () => {
                const index = this._messageHandlers.indexOf(handler);
                if (index !== -1) {
                    this._messageHandlers.splice(index, 1);
                }
            }
        };
    }

    private handleMessage(message: WebviewMessage): void {
        if (!message || typeof message !== 'object' || !message.command) {
            console.error('WebviewProvider: Invalid message received:', message);
            return;
        }
        this._messageHandlers.forEach(handler => handler(message));
    }

    private async _updateProject(projectId: string, updates: Partial<Project>) {
        try {
            const configuration = vscode.workspace.getConfiguration('awesomeProjects');
            const projects = [...(configuration.get<Project[]>('projects') || [])];
            const projectIndex = projects.findIndex(p => getProjectId(p) === projectId);

            if (projectIndex !== -1) {
                // Normalize path if it's being updated
                if (updates.path) {
                    updates.path = path.normalize(updates.path);
                }

                projects[projectIndex] = {
                    ...projects[projectIndex],
                    ...updates,
                };

                await configuration.update('projects', projects, vscode.ConfigurationTarget.Global);
                this.refresh();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update project: ${error}`);
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
        // Load CSS only once and cache it
        if (!this._cachedCss) {
            try {
                this._cachedCss = await loadResourceFile(this._context, 'dist/css/webview.css') ||
                                 await loadResourceFile(this._context, 'src/css/webview.css');
            } catch (error) {
                console.error('Failed to load CSS:', error);
            }
        }

        // Get current workspace folder path
        const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        // Pre-load all HTML components
        const headerHtml = await getHeaderHtml(this._context);
        const projectListHtml = await getProjectListHtml(this._context, currentWorkspace);
        const footerHtml = await getFooterHtml(this._context);

        return `<!DOCTYPE html>
            <html>
            <head>
                <style>${this._cachedCss}</style>
                <script>
                    const vscode = acquireVsCodeApi();

                    document.addEventListener('DOMContentLoaded', () => {
                        const list = document.getElementById('projects-list');
                        let draggedItem = null;

                        // Drag & Drop Event Listener hinzufügen
                        document.querySelectorAll('.project-item-wrapper').forEach(item => {
                            item.setAttribute('draggable', 'true');

                            item.addEventListener('dragstart', (e) => {
                                draggedItem = item;
                                e.dataTransfer.effectAllowed = 'move';
                                item.classList.add('dragging');
                            });

                            item.addEventListener('dragend', () => {
                                item.classList.remove('dragging');
                                draggedItem = null;
                                // Alle Indikatoren entfernen
                                document.querySelectorAll('.project-item-wrapper').forEach(item => {
                                    item.classList.remove('insert-after');
                                });
                            });

                            item.addEventListener('dragover', (e) => {
                                e.preventDefault();
                                if (draggedItem === item) return;

                                // Nur den aktuellen Indikator zeigen
                                document.querySelectorAll('.project-item-wrapper').forEach(item => {
                                    item.classList.remove('insert-after');
                                });
                                item.classList.add('insert-after');
                            });

                            item.addEventListener('drop', (e) => {
                                e.preventDefault();
                                if (draggedItem === item) return;

                                // Indizes für die Neuordnung ermitteln
                                const items = [...list.querySelectorAll('.project-item-wrapper')];
                                const fromIndex = items.indexOf(draggedItem);
                                const toIndex = items.indexOf(item);

                                // Element an neuer Position einfügen
                                if (fromIndex !== -1 && toIndex !== -1) {
                                    // Element an der alten Position entfernen
                                    list.removeChild(draggedItem);

                                    // Element an neuer Position einfügen
                                    list.insertBefore(draggedItem, item);

                                    // VS Code über die Änderung informieren
                                    vscode.postMessage({
                                        command: 'reorderProjects',
                                        oldIndex: fromIndex,
                                        newIndex: toIndex
                                    });
                                }

                                // Aufräumen
                                item.classList.remove('insert-after');
                                draggedItem.classList.remove('dragging');
                                draggedItem = null;
                            });
                        });

                        // Rest der Event Listener
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

                        document.addEventListener('click', (event) => {
                            if (!event.target.closest('.project-item-wrapper')) {
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
                    });

                    // Export Funktionen für globale Verwendung
                    window.openProject = function(project) {
                        const normalizedPath = project.replace(/\\/g, '\\\\');
                        vscode.postMessage({
                            command: 'openProject',
                            project: normalizedPath
                        });
                    };

                    window.openUrl = function(event, url) {
                        event.preventDefault();
                        if (vscode) {
                            vscode.postMessage({
                                command: 'openUrl',
                                url: url
                            });
                        }
                    };
                </script>
            </head>
            <body>
                ${headerHtml}
                <div class="projects-wrapper">
                    <div id="loading-spinner" class="loading-spinner hidden"></div>
                    ${projectListHtml}
                </div>
                ${footerHtml}
            </body>
            </html>`;
    }
}
