import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "awesome-projects" is now active!');
	const disposable = vscode.commands.registerCommand('awesome-projects.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from vscode-ext-awesome-projects!');
	});
	context.subscriptions.push(disposable);
}

export function deactivate() {}
