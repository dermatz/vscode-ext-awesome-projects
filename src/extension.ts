import * as vscode from 'vscode';
import { ProjectsWebviewProvider } from './webviewProvider';
import { Project } from './types';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "awesome-projects" is now active!');
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
        projectsProvider // Add the provider to be disposed when deactivating
    );

    const addProjectCommand = vscode.commands.registerCommand('awesome-projects.addProject', () => {
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
    });

    const openProjectCommand = vscode.commands.registerCommand('awesome-projects.openProject', (projectName: string) => {
        vscode.window.showInformationMessage(`Opening project: ${projectName}`);
        // Add your logic to open the project here
    });

    // Add refresh command registration
    const refreshProjectsCommand = vscode.commands.registerCommand('awesome-projects.refreshProjects', () => {
        projectsProvider.refresh();
    });

    context.subscriptions.push(
        addProjectCommand,
        openProjectCommand,
        refreshProjectsCommand  // Add the new command to subscriptions
    );
}

export function deactivate() {}
