import * as vscode from 'vscode';
import { Project } from './extension';
import { loadResourceFile } from './utils/resourceLoader';
import { getHeaderHtml } from './template/webview/header';
import { getFooterHtml } from './template/webview/footer';
import { getProjectListHtml } from './template/project/projectlist';
import { getProjectItemHtml } from './template/project/components/project-item';

/**
 * Project Components
 */

import { getSettingsDropdownHtml } from './template/project/components/settings-dropdown';
import { getAddToHtml } from './template/project/components/add-to';


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
                                    }) || projectPath.split('/').pop() || '',
                                    color: null  // Set default color to null
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
                case 'reorderProjects':
                    this._reorderProjects(message.oldIndex, message.newIndex);
                    break;
                case 'showInFileManager':
                    vscode.commands.executeCommand('awesome-projects.showInFileManager', message.project);
                    break;
                case 'deleteProject':
                    this._handleProjectDeletion(message.projectPath);
                    break;
            }
        });
    }

    private async _handleProjectDeletion(projectPath: string) {
        const selection = await vscode.window.showWarningMessage(
            'Do you really want to delete this project?',
            'Yes',
            'No'
        );

        if (selection === 'Yes') {
            await this._deleteProject(projectPath);
        }
    }

    private async _updateProject(projectPath: string, updates: Partial<Project>) {
        try {
            if ('color' in updates) {
                if (updates.color === null) {
                    updates.color = undefined; // Ermöglicht das Zurücksetzen auf den Standardwert
                } else if (updates.color) {
                    const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
                    if (!isValidHex.test(updates.color)) {
                        throw new Error('Invalid color format');
                    }
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
                this.refresh(); // Wichtig: Aktualisiert die gesamte Ansicht
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

        /**
         * Load CSS content from dist file.
         * If the file is not found, load the CSS content from the src folder.
         */
        let cssContent = '';
        try {
            cssContent = await loadResourceFile(this._context, 'dist/css/webview.css') || await loadResourceFile(this._context, 'src/css/webview.css');
        } catch (error) {
            console.error('Failed to load CSS:', error);
        }

        const configuration = vscode.workspace.getConfiguration('awesomeProjects');
        const projects = configuration.get<Project[]>('projects') || [];
        const useFavicons = configuration.get<boolean>('useFavicons') ?? true;

        // Pre-load all HTML components
        const headerHtml = await getHeaderHtml(this._context);
        const projectListHtml = await getProjectListHtml(this._context);
        const footerHtml = await getFooterHtml(this._context);

        const projectsHtml = await Promise.all(
            projects.map((project, index) =>
                getProjectItemHtml(this._context, { project, index, useFavicons })
            )
        );

        return `<!DOCTYPE html>
            <html>
                <head>
                    <style>${cssContent}</style>
                </head>
                <body>
                    ${headerHtml}

                    <div class="projects-wrapper">
                        <div id="loading-spinner" class="loading-spinner hidden"></div>
                        ${projectListHtml}

                        <section>
                            <div id="projects-list" class="draggable-list">
                                ${projectsHtml.join("")}
                            </div>
                        </section>
                        <section>
                            ${await getAddToHtml(this._context)}
                        </section>
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

                        function openUrl(event, url) {
                            event.preventDefault();
                            vscode.postMessage({
                                command: 'openUrl',
                                url: url
                            });
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
                            document.querySelectorAll('.project-item-wrapper').forEach(item => {
                                item.classList.remove('over');
                                item.classList.remove('insert-top');
                                item.classList.remove('insert-bottom');
                            });
                        }

                        document.querySelectorAll('.project-item-wrapper').forEach(item => {
                            item.addEventListener('dragstart', handleDragStart, false);
                            item.addEventListener('dragenter', handleDragEnter, false);
                            item.addEventListener('dragover', handleDragOver, false);
                            item.addEventListener('dragleave', handleDragLeave, false);
                            item.addEventListener('drop', handleDrop, false);
                            item.addEventListener('dragend', handleDragEnd, false);
                        });

                        document.querySelectorAll('.project-item-wrapper').forEach(item => {
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
                    </script>

                    ${footerHtml}
                </body>
            </html>`;
    }
}
