import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectsWebviewProvider } from './webviewProvider';
import { registerCommands } from './commands';
import { getProjectId } from './template/project/utils/project-id';
import { WebviewMessage } from './types/webviewMessages';
import { showUpdateNotification } from './updateNotifier';
import { StatusBarManager } from './statusBar';

export interface Project {
    id: string;  // Make id required instead of optional
    path: string;
    name: string;
    color?: string | null;  // Make color optional
    icon?: string | null;
    iconUrl?: string;
    remoteUrl?: string;
    isRemote?: boolean;
    productionUrl?: string;
    devUrl?: string;
    stagingUrl?: string;
    managementUrl?: string;
    description?: string;
    group?: string;
    timeSpentSeconds?: number;
}

/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context - The extension context.
 */
async function recoverOrphanedSession(projectsProvider: ProjectsWebviewProvider): Promise<void> {
    const orphanedActive = projectsProvider.timeTrackingService.getActiveSession();
    if (!orphanedActive) {
        return;
    }
    const session = projectsProvider.timeTrackingService.getActiveSessionFull();
    const choice = await vscode.window.showInformationMessage(
        `A time tracking session for "${session?.title || orphanedActive.projectId}" is still running.`,
        'Resume',
        'Stop now',
        'Discard'
    );
    if (choice === 'Resume') {
        await projectsProvider.timeTrackingService.recoverActiveSession('resume');
    } else if (choice === 'Stop now') {
        await projectsProvider.timeTrackingService.recoverActiveSession('stop');
    } else if (choice === 'Discard') {
        await projectsProvider.timeTrackingService.recoverActiveSession('discard');
    }
}

async function autoStartTimeTracking(projectsProvider: ProjectsWebviewProvider, workspacePath?: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('awesomeProjects');
    if (!config.get<boolean>('timeTracking.enabled', true) || !config.get<boolean>('timeTracking.autoStart', false)) {
        return;
    }
    if (!workspacePath) {
        return;
    }
    const normalizedWorkspace = path.normalize(workspacePath);
    const projects = config.get<Project[]>('projects') || [];
    const matchedProject = projects.find(p => path.normalize(p.path) === normalizedWorkspace);
    if (!matchedProject || !matchedProject.id) {
        return;
    }
    const active = projectsProvider.timeTrackingService.getActiveSession();
    if (active) {
        return;
    }
    await projectsProvider.timeTrackingService.startSession(
        matchedProject.id,
        workspacePath,
        `${matchedProject.name}`
    );
    vscode.window.showInformationMessage(`Timer started for ${matchedProject.name}`);
}

async function migrateProjectIds(configuration: vscode.WorkspaceConfiguration): Promise<void> {
    const projects = configuration.get<Project[]>('projects') || [];
    const needsIdUpdate = projects.some(p => !p.id);
    const needsRemoteUpdate = projects.some(p => p.remoteUrl && p.isRemote === undefined);

    if (needsIdUpdate || needsRemoteUpdate) {
        const updatedProjects = projects.map(project => ({
            ...project,
            id: project.id || getProjectId(project),
            isRemote: project.isRemote ?? (project.remoteUrl ? true : undefined)
        }));
        await configuration.update('projects', updatedProjects, vscode.ConfigurationTarget.Global);
    }
}

function registerWebviewMessageHandler(projectsProvider: ProjectsWebviewProvider): void {
    projectsProvider.onDidReceiveMessage(async (message: WebviewMessage) => {
        switch (message.command) {
            case 'deleteProject':
                if (!message.projectId) {
                    return;
                }
                // Use the DELETE_PROJECT command to ensure consistent behavior
                await vscode.commands.executeCommand('awesome-projects.deleteProject', {
                    projectId: message.projectId
                });
                break;
        }
    });
}

export async function activate(context: vscode.ExtensionContext) {

    // Migrate legacy flat settings to the new subgroup structure once
    migrateLegacySettings();

    // Show Update-Popup
    showUpdateNotification(context);

    const projectsProvider = new ProjectsWebviewProvider(context.extensionUri, context);

    // Handle recovery of an orphaned active time tracking session asynchronously
    // so the extension activation is not blocked waiting for user input.
    recoverOrphanedSession(projectsProvider).catch(err => console.error('Error recovering time tracking session:', err));

    const configuration = vscode.workspace.getConfiguration('awesomeProjects');

    // Keep the view title context in sync with the hideMissing setting
    const hideMissing = configuration.get<boolean>('projects.hideMissing') ?? false;
    vscode.commands.executeCommand('setContext', 'awesomeProjects.hideMissing', hideMissing);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ProjectsWebviewProvider.viewType,
            projectsProvider
        ),
        projectsProvider
    );

    registerCommands(context, projectsProvider);

    // Initialize status bar
    const statusBarManager = new StatusBarManager(projectsProvider.timeTrackingService);
    context.subscriptions.push(statusBarManager);
    statusBarManager.update();

    // Auto-start time tracking when a registered workspace is opened
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            await autoStartTimeTracking(projectsProvider, folder);
        })
    );
    await autoStartTimeTracking(projectsProvider, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);

    // Migrate project settings immediately but asynchronously
    migrateProjectIds(configuration).catch(err => console.error('Error migrating project settings:', err));

    // Handle messages from the webview
    registerWebviewMessageHandler(projectsProvider);
}

/**
 * Deactivates the extension.
 */
export function deactivate() {}

/**
 * Migrates legacy flat settings to the new subgroup structure.
 * Existing values are preserved and the old keys are removed afterwards.
 */
async function migrateLegacySettings(): Promise<void> {
    const configuration = vscode.workspace.getConfiguration('awesomeProjects');
    const target = vscode.ConfigurationTarget.Global;

    const migrations: { legacy: string; current: string; defaultValue?: unknown }[] = [
        { legacy: 'useFavicons', current: 'appearance.useFavicons', defaultValue: true },
        { legacy: 'quickActionButtonDisplay', current: 'appearance.quickActionButtonDisplay', defaultValue: 'hover' },
        { legacy: 'groupSortOrder', current: 'groups.sortOrder', defaultValue: 'alphabetical' },
        { legacy: 'showStatusBar', current: 'statusBar.enabled', defaultValue: true },
        { legacy: 'showUpdateNotification', current: 'updates.showUpdateNotification', defaultValue: true }
    ];

    for (const { legacy, current } of migrations) {
        const legacyValue = configuration.inspect(legacy);
        if (legacyValue?.globalValue !== undefined) {
            const currentValue = configuration.inspect(current)?.globalValue;
            if (currentValue === undefined) {
                await configuration.update(current, legacyValue.globalValue, target);
            }
            await configuration.update(legacy, undefined, target);
        }
    }
}
