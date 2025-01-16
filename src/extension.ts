import * as vscode from 'vscode';
import { ProjectsWebviewProvider } from './webviewProvider';
import { showInFileManager } from './utils/fileManager';

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

/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context - The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('awesome-projects.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from vscode-ext-awesome-projects!');
    });
    context.subscriptions.push(disposable);

    const projectsProvider = new ProjectsWebviewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ProjectsWebviewProvider.viewType,
            projectsProvider
        ),
        projectsProvider
    );

    const addProjectCommand = vscode.commands.registerCommand('awesome-projects.addProject', async () => {
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectMany: false
        });

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
                    }) || projectPath.split('/').pop() || ''
                };

                await configuration.update(
                    'projects',
                    [...projects, newProject],
                    vscode.ConfigurationTarget.Global
                );

                const updatedProjects = configuration.get<Project[]>('projects');
                if (updatedProjects?.some(p => p.path === newProject.path)) {
                    projectsProvider.refresh();
                } else {
                    throw new Error('Failed to save project to settings');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to add project: ${error}`);
            }
        }
    });

    const openProjectCommand = vscode.commands.registerCommand('awesome-projects.openProject', (projectName: string) => {
        vscode.window.showInformationMessage(`Opening project: ${projectName}`);
    });

    const refreshProjectsCommand = vscode.commands.registerCommand('awesome-projects.refreshProjects', () => {
        projectsProvider.refresh();
    });

    context.subscriptions.push(
        addProjectCommand,
        openProjectCommand,
        refreshProjectsCommand
    );

    const showInFileManagerCommand = vscode.commands.registerCommand('awesome-projects.showInFileManager', (project: Project) => {
        console.log('Show in File Manager command called with project:', project);
        if (project && project.path) {
            showInFileManager(project.path);
        } else {
            vscode.window.showErrorMessage('No valid project path provided');
        }
    });

    context.subscriptions.push(showInFileManagerCommand);
}

/**
 * Deactivates the extension.
 */
export function deactivate() {}
