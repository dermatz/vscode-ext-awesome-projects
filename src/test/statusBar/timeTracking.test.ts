import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { StatusBarManager } from '../../statusBar';
import { TimeTrackingService } from '../../timeTrackingService';

suite('StatusBar Time Tracking Tests', () => {
    let context: vscode.ExtensionContext;
    let service: TimeTrackingService;
    let statusBar: StatusBarManager;

    setup(() => {
        const globalState = new Map<string, unknown>();
        context = {
            globalState: {
                get: <T>(key: string): T | undefined => globalState.get(key) as T | undefined,
                update: async (key: string, value: unknown) => {
                    globalState.set(key, value);
                }
            },
            subscriptions: []
        } as unknown as vscode.ExtensionContext;
        service = new TimeTrackingService(context);
        statusBar = new StatusBarManager(service);
    });

    teardown(() => {
        service.dispose();
        statusBar.dispose();
    });

    test('shows timer text when active session matches workspace', async () => {
        const workspacePath = path.normalize('/workspace/a');
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        await config.update('projects', [{
            id: 'proj-1',
            path: workspacePath,
            name: 'Test Project'
        }], vscode.ConfigurationTarget.Global);

        await service.startSession('proj-1', workspacePath, 'Test Task');

        // Mock workspace folders for the update call
        const originalFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [{ uri: vscode.Uri.file(workspacePath) }],
            configurable: true
        });

        try {
            statusBar.update();
            // Status bar text should contain the watch icon and project name
            const statusBarItem = (statusBar as unknown as { _statusBarItem: { text: string } })._statusBarItem;
            assert.ok(statusBarItem.text.includes('$(watch)'));
            assert.ok(statusBarItem.text.includes('Test Project'));
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalFolders,
                configurable: true
            });
        }
    });
});
