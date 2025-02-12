import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectsWebviewProvider } from './webviewProvider';
import { registerCommands } from './commands';
import { getProjectId } from './template/project/utils/project-id';
import { WebviewMessage } from './types/webviewMessages';

export interface Project {
    id?: string;
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

    // Handle messages from the webview
    projectsProvider.onDidReceiveMessage(async (message: WebviewMessage) => {
        switch (message.command) {
            case 'deleteProject':
                if (!message.projectId) {
                    return;
                }
                const projects = [...(configuration.get<Project[]>('projects') || [])];
                const projectIndex = projects.findIndex(p => getProjectId(p) === message.projectId);

                if (projectIndex !== -1) {
                    const project = projects[projectIndex];
                    // Normalize path for platform compatibility
                    project.path = path.normalize(project.path);

                    const answer = await vscode.window.showWarningMessage(
                        `Are you sure you want to remove project "${project.name}"?`,
                        { modal: true },
                        'Yes',
                        'No'
                    );

                    if (answer === 'Yes') {
                        projects.splice(projectIndex, 1);
                        await configuration.update('projects', projects, vscode.ConfigurationTarget.Global);
                        projectsProvider.refresh(); // Use provider's refresh method instead of updateWebview
                    }
                }
                break;
        }
    });
}

/**
 * Deactivates the extension.
 */
export function deactivate() {}
