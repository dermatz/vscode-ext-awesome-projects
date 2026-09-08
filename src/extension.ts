import * as vscode from 'vscode';
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
}

/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context - The extension context.
 */
export function activate(context: vscode.ExtensionContext) {

    // Migrate legacy flat settings to the new subgroup structure once
    migrateLegacySettings();

    // Show Update-Popup
    showUpdateNotification(context);


    const projectsProvider = new ProjectsWebviewProvider(context.extensionUri, context);
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
    const statusBarManager = new StatusBarManager();
    context.subscriptions.push(statusBarManager);
    statusBarManager.update();

    // Migrate project settings immediately but asynchronously
    (async () => {
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
    })().catch(err => console.error('Error migrating project settings:', err));

    // Handle messages from the webview
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
