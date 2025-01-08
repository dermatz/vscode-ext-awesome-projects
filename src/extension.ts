import * as vscode from 'vscode';
import { ProjectsWebviewProvider } from './webviewProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "awesome-projects" is now active!');
	const disposable = vscode.commands.registerCommand('awesome-projects.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from vscode-ext-awesome-projects!');
	});
	context.subscriptions.push(disposable);

    const projectsProvider = new ProjectsWebviewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ProjectsWebviewProvider.viewType,
            projectsProvider
        ),
        projectsProvider // Add the provider to be disposed when deactivating
    );

    const addProjectCommand = vscode.commands.registerCommand('awesome-projects.addProject', () => {
        vscode.window.showInformationMessage('Add Project clicked!');
        // Here you can implement the actual project adding logic
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
