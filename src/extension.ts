import * as vscode from 'vscode';
import { ProjectsWebviewProvider } from './webviewProvider';
import { handleAddProject, handleOpenProject, handleShowInFileManager } from './commandHandlers';

export interface Project {
    path: string;
    name: string;
    color?: string;
    icon?: string;
    productionUrl?: string;
    devUrl?: string;
    stagingUrl?: string;
    managementUrl?: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "awesome-projects" is now active!');

    const projectsProvider = new ProjectsWebviewProvider(context.extensionUri, context);

    registerWebviewProvider(context, projectsProvider);
    registerCommands(context, projectsProvider);
}

function registerWebviewProvider(context: vscode.ExtensionContext, provider: ProjectsWebviewProvider): void {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ProjectsWebviewProvider.viewType,
            provider
        ),
        provider
    );
}

function registerCommands(context: vscode.ExtensionContext, provider: ProjectsWebviewProvider): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('awesome-projects.addProject', handleAddProject),
        vscode.commands.registerCommand('awesome-projects.openProject', handleOpenProject),
        vscode.commands.registerCommand('awesome-projects.refreshProjects', () => provider.refresh()),
        vscode.commands.registerCommand('awesome-projects.showInFileManager', handleShowInFileManager)
    );
}

export function deactivate() {}
