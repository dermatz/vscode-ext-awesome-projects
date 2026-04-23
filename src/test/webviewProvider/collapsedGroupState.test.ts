import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectsWebviewProvider } from '../../webviewProvider';
import * as projectListModule from '../../template/project/projectlist';

type ProjectListHtmlFn = typeof projectListModule.getProjectListHtml;

const ASYNC_HANDLER_TIMEOUT_MS = 50;

suite('WebviewProvider Collapsed Group State Tests', () => {
    function makeMockContext(globalStateStore: Record<string, unknown> = {}): vscode.ExtensionContext {
        return {
            extensionUri: vscode.Uri.file(path.join(__dirname, '../../..')),
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve()
            } as unknown as vscode.Memento,
            globalState: {
                get: (key: string, defaultValue?: unknown) => {
                    return key in globalStateStore ? globalStateStore[key] : defaultValue;
                },
                update: (key: string, value: unknown) => {
                    globalStateStore[key] = value;
                    return Promise.resolve();
                },
                setKeysForSync: () => {}
            } as unknown as vscode.ExtensionContext['globalState'],
            extensionPath: path.join(__dirname, '../../..'),
            asAbsolutePath: (relativePath: string) => path.join(__dirname, '../../../', relativePath),
            storagePath: __dirname,
            globalStoragePath: __dirname,
            logPath: __dirname,
        } as unknown as vscode.ExtensionContext;
    }

    function makeMockWebviewView(): vscode.WebviewView {
        let messageHandler: ((message: unknown) => void) | undefined;
        return {
            webview: {
                html: '',
                options: {},
                onDidReceiveMessage: (handler: (message: unknown) => void) => {
                    messageHandler = handler;
                    return { dispose: () => {} };
                },
                postMessage: () => Promise.resolve(true),
                // Expose for test use
                _triggerMessage: (msg: unknown) => messageHandler && messageHandler(msg),
            } as unknown as vscode.Webview,
            onDidChangeVisibility: () => ({ dispose: () => {} }),
            onDidDispose: () => ({ dispose: () => {} }),
            title: 'Test View',
            description: 'Test',
            visible: true,
        } as unknown as vscode.WebviewView;
    }

    test('Should save collapsed state to globalState on toggleGroupCollapse message', async () => {
        const globalStateStore: Record<string, unknown> = {};
        const mockContext = makeMockContext(globalStateStore);
        const mockWebviewView = makeMockWebviewView();

        const provider = new ProjectsWebviewProvider(mockContext.extensionUri, mockContext);

        // Mock project list to avoid actual rendering
        const mutableProjectList1 = projectListModule as unknown as { getProjectListHtml: ProjectListHtmlFn };
        const originalGetProjectListHtml = mutableProjectList1.getProjectListHtml;
        mutableProjectList1.getProjectListHtml = async () => '<div>Mock Project List</div>';

        try {
            await provider.resolveWebviewView(mockWebviewView, { state: undefined } as unknown as vscode.WebviewViewResolveContext<undefined>, {} as unknown as vscode.CancellationToken);

            // Simulate toggleGroupCollapse message from webview
            (mockWebviewView.webview as unknown as { _triggerMessage: (msg: unknown) => void })._triggerMessage({
                command: 'toggleGroupCollapse',
                groupName: 'MyGroup',
                isCollapsed: true
            });

            // Give async handlers time to run
            await new Promise(resolve => setTimeout(resolve, ASYNC_HANDLER_TIMEOUT_MS));

            const saved = globalStateStore['collapsedGroups'] as Record<string, boolean>;
            assert.ok(saved, 'collapsedGroups should be saved to globalState');
            assert.strictEqual(saved['MyGroup'], true, 'MyGroup should be marked as collapsed');
        } finally {
            mutableProjectList1.getProjectListHtml = originalGetProjectListHtml;
        }
    });

    test('Should remove group from globalState when it is expanded', async () => {
        const globalStateStore: Record<string, unknown> = {
            collapsedGroups: { MyGroup: true, OtherGroup: true }
        };
        const mockContext = makeMockContext(globalStateStore);
        const mockWebviewView = makeMockWebviewView();

        const provider = new ProjectsWebviewProvider(mockContext.extensionUri, mockContext);

        const mutableProjectList2 = projectListModule as unknown as { getProjectListHtml: ProjectListHtmlFn };
        const originalGetProjectListHtml = mutableProjectList2.getProjectListHtml;
        mutableProjectList2.getProjectListHtml = async () => '<div>Mock Project List</div>';

        try {
            await provider.resolveWebviewView(mockWebviewView, { state: undefined } as unknown as vscode.WebviewViewResolveContext<undefined>, {} as unknown as vscode.CancellationToken);

            // Simulate expanding MyGroup
            (mockWebviewView.webview as unknown as { _triggerMessage: (msg: unknown) => void })._triggerMessage({
                command: 'toggleGroupCollapse',
                groupName: 'MyGroup',
                isCollapsed: false
            });

            await new Promise(resolve => setTimeout(resolve, ASYNC_HANDLER_TIMEOUT_MS));

            const saved = globalStateStore['collapsedGroups'] as Record<string, boolean>;
            assert.ok(saved, 'collapsedGroups should still exist in globalState');
            assert.strictEqual(saved['MyGroup'], undefined, 'MyGroup should be removed when expanded');
            assert.strictEqual(saved['OtherGroup'], true, 'OtherGroup should remain collapsed');
        } finally {
            mutableProjectList2.getProjectListHtml = originalGetProjectListHtml;
        }
    });

    test('Should pass persisted collapsedGroups to getProjectListHtml on render', async () => {
        const globalStateStore: Record<string, unknown> = {
            collapsedGroups: { GitHub: true }
        };
        const mockContext = makeMockContext(globalStateStore);
        const mockWebviewView = makeMockWebviewView();

        let capturedCollapsedGroups: Record<string, boolean> | undefined;

        const mutableProjectList3 = projectListModule as unknown as { getProjectListHtml: ProjectListHtmlFn };
        const originalGetProjectListHtml = mutableProjectList3.getProjectListHtml;
        mutableProjectList3.getProjectListHtml = async (_ctx: vscode.ExtensionContext, _ws?: string, _cfg?: vscode.WorkspaceConfiguration, collapsedGroups: Record<string, boolean> = {}) => {
            capturedCollapsedGroups = collapsedGroups;
            return '<div>Mock Project List</div>';
        };

        try {
            const provider = new ProjectsWebviewProvider(mockContext.extensionUri, mockContext);
            await provider.resolveWebviewView(mockWebviewView, { state: undefined } as unknown as vscode.WebviewViewResolveContext<undefined>, {} as unknown as vscode.CancellationToken);

            // Wait for deferred initial render
            await new Promise(resolve => setTimeout(resolve, 200));

            assert.ok(capturedCollapsedGroups, 'collapsedGroups should be passed to getProjectListHtml');
            assert.strictEqual(capturedCollapsedGroups!['GitHub'], true, 'GitHub group should be marked as collapsed');
        } finally {
            mutableProjectList3.getProjectListHtml = originalGetProjectListHtml;
        }
    });
});
