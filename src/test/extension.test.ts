import * as assert from 'assert';
import * as vscode from 'vscode';

const extensionId = 'MathiasElle.awesome-projects';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be present', () => {
		const extension = vscode.extensions.getExtension(extensionId);
		assert.ok(extension, "Extension is not installed");
	});

	test('Extension should activate', async () => {
		const extension = vscode.extensions.getExtension(extensionId);
		if (extension) {
			await extension.activate();
			assert.ok(extension.isActive, "Extension is not active");
		}
	});

	test('Extension should start', async () => {
		const extension = vscode.extensions.getExtension(extensionId);
		if (extension) {
			await extension.activate();
			assert.ok(extension.isActive, "Extension did not start");
		}
	});

	test('Settings section should be present', () => {
		const configuration = vscode.workspace.getConfiguration('awesomeProjects');
		assert.ok(configuration, "Settings section for the extension is not present");
	});

	test('Webview should be present for the project', async () => {
		const webview = vscode.window.createWebviewPanel(
			'awesomeProjectsView',
			'Projects',
			vscode.ViewColumn.One,
			{}
		);
		assert.ok(webview, "Webview for the project is not present");
	});
});
