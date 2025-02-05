import * as vscode from 'vscode';
import { ProjectsWebviewProvider } from './webviewProvider';
import { registerCommands } from './commands';

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
}

/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context - The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    const projectsProvider = new ProjectsWebviewProvider(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ProjectsWebviewProvider.viewType,
            projectsProvider
        ),
        projectsProvider
    );

    registerCommands(context, projectsProvider);
}

/**
 * Deactivates the extension.
 */
export function deactivate() {}
