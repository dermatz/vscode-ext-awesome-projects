import * as vscode from 'vscode';
import * as path from 'path';
import { Project } from './extension';

/**
 * Manages the status bar item that shows the currently open project.
 */
export class StatusBarManager implements vscode.Disposable {
    private _statusBarItem: vscode.StatusBarItem;
    private _disposables: vscode.Disposable[] = [];

    constructor() {
        this._statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this._statusBarItem.command = 'workbench.view.extension.awesomeProjects';
        this._statusBarItem.tooltip = 'Awesome Projects – Click to open project list';

        this._disposables.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => this.update()),
            vscode.workspace.onDidChangeConfiguration(e => {
                if (
                    e.affectsConfiguration('awesomeProjects.showStatusBar') ||
                    e.affectsConfiguration('awesomeProjects.projects')
                ) {
                    this.update();
                }
            })
        );
    }

    /**
     * Updates the status bar item based on the current workspace and project list.
     */
    public update(): void {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const enabled = config.get<boolean>('showStatusBar', true);

        if (!enabled) {
            this._statusBarItem.hide();
            return;
        }

        const currentWorkspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!currentWorkspacePath) {
            this._statusBarItem.hide();
            return;
        }

        const projects = config.get<Project[]>('projects') || [];
        const normalizedWorkspace = path.normalize(currentWorkspacePath);
        const matchedProject = projects.find(p => path.normalize(p.path) === normalizedWorkspace);

        if (!matchedProject) {
            this._statusBarItem.hide();
            return;
        }

        const parentFolder = path.basename(path.dirname(matchedProject.path));
        const projectName = matchedProject.name;

        this._statusBarItem.text = `$(folder) ${parentFolder} > ${projectName}`;
        this._statusBarItem.show();
    }

    public dispose(): void {
        this._statusBarItem.dispose();
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}
