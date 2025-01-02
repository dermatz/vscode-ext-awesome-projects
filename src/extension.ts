import * as vscode from 'vscode';
import { ProjectsWebviewProvider } from './webviewProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "awesome-projects" is now active!');
	const disposable = vscode.commands.registerCommand('awesome-projects.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from vscode-ext-awesome-projects!');
	});
	context.subscriptions.push(disposable);

    const provider = new ProjectsWebviewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ProjectsWebviewProvider.viewType,
            provider
        )
    );

    const addProjectCommand = vscode.commands.registerCommand('awesome-projects.addProject', () => {
        vscode.window.showInformationMessage('Add Project clicked!');
        // Here you can implement the actual project adding logic
    });

    context.subscriptions.push(addProjectCommand);

    const openProjectCommand = vscode.commands.registerCommand('awesome-projects.openProject', (projectName: string) => {
        vscode.window.showInformationMessage(`Opening project: ${projectName}`);
        // Add your logic to open the project here
    });

    context.subscriptions.push(openProjectCommand);
}

export function deactivate() {}
