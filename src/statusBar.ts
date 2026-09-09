import * as vscode from 'vscode';
import * as path from 'path';
import { Project } from './extension';
import { TimeTrackingService } from './timeTrackingService';

function formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${seconds}s`;
}

/**
 * Manages the status bar item that shows the currently open project.
 */
export class StatusBarManager implements vscode.Disposable {
    private _statusBarItem: vscode.StatusBarItem;
    private _disposables: vscode.Disposable[] = [];
    private _timeTrackingService?: TimeTrackingService;

    constructor(timeTrackingService?: TimeTrackingService) {
        this._timeTrackingService = timeTrackingService;
        this._statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this._statusBarItem.command = 'awesome-projects.openTimeTrackingMenu';
        this._statusBarItem.tooltip = 'Awesome Projects – Click to open project list';

        this._disposables.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => this.update()),
            vscode.workspace.onDidChangeConfiguration(e => {
                if (
                    e.affectsConfiguration('awesomeProjects.statusBar.enabled') ||
                    e.affectsConfiguration('awesomeProjects.statusBar.format') ||
                    e.affectsConfiguration('awesomeProjects.showStatusBar') ||
                    e.affectsConfiguration('awesomeProjects.projects')
                ) {
                    this.update();
                }
            })
        );

        if (this._timeTrackingService) {
            this._disposables.push(
                this._timeTrackingService.onDidChangeTimer(() => this.update())
            );
        }
    }

    /**
     * Updates the status bar item based on the current workspace and project list.
     */
    public update(): void {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const enabled = config.get<boolean>('statusBar.enabled')
            ?? config.get<boolean>('showStatusBar', true);

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

        const activeSession = this._timeTrackingService?.getActiveSession();
        const isTimerActive = activeSession?.projectId === matchedProject.id;

        if (isTimerActive && this._timeTrackingService) {
            const fullSession = this._timeTrackingService.getActiveSessionFull();
            const elapsed = fullSession?.durationSeconds ?? activeSession.accumulatedSeconds;
            this._statusBarItem.text = `$(watch) ${matchedProject.name} ${formatDuration(elapsed)}`;
            this._statusBarItem.tooltip = `Timer running: ${fullSession?.title || matchedProject.name}\nBranch: ${activeSession.lastBranch}`;
        } else {
            const format = config.get<string>('statusBar.format', '$(folder) ${parent} > ${name}');
            const parentFolder = path.basename(path.dirname(matchedProject.path));
            const projectName = matchedProject.name;

            this._statusBarItem.text = format
                .replace(/\$\{name\}/g, projectName)
                .replace(/\$\{parent\}/g, parentFolder)
                .replace(/\$\{path\}/g, matchedProject.path);
            this._statusBarItem.tooltip = 'Awesome Projects – Click to open project list';
        }

        this._statusBarItem.show();
    }

    public dispose(): void {
        this._statusBarItem.dispose();
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}
