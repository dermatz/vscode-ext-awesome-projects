import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectsWebviewProvider } from './webviewProvider';
import { registerCommands } from './commands';
import { getProjectId } from './template/project/utils/project-id';
import { WebviewMessage } from './types/webviewMessages';
import { showUpdateNotification } from './updateNotifier';

export interface Project {
    id: string;  // Make id required instead of optional
    path: string;
    name: string;
    color?: string | null;  // Make color optional
    icon?: string;
    productionUrl?: string;
    devUrl?: string;
    stagingUrl?: string;
    managementUrl?: string;
    description?: string;
}

/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context - The extension context.
 */
export function activate(context: vscode.ExtensionContext) {

    // Show Update-Popup
    showUpdateNotification(context);


    const projectsProvider = new ProjectsWebviewProvider(context.extensionUri, context);
    const configuration = vscode.workspace.getConfiguration('awesomeProjects');

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ProjectsWebviewProvider.viewType,
            projectsProvider
        ),
        projectsProvider
    );

    registerCommands(context, projectsProvider);

    // Check project IDs immediately but asynchronously
    (async () => {
        const projects = configuration.get<Project[]>('projects') || [];
        const needsUpdate = projects.some(p => !p.id);

        if (needsUpdate) {
            const updatedProjects = projects.map(project => ({
                ...project,
                id: project.id || getProjectId(project)
            }));
            await configuration.update('projects', updatedProjects, vscode.ConfigurationTarget.Global);
        }
    })().catch(err => console.error('Error updating project IDs:', err));

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
