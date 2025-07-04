import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectsWebviewProvider } from '../../webviewProvider';

// This test specifically focuses on the CSS caching functionality
suite('WebviewProvider CSS Caching Tests', () => {
    test('Should cache CSS and not reload it on refresh', async () => {
        // Mock the loadResourceFile function to track CSS loading
        let cssLoadCount = 0;
        let headerLoadCount = 0;
        let footerLoadCount = 0;

        // Mock the resource loader module
        const resourceLoaderModule = require('../../template/utils/resourceLoader');
        const originalLoadResourceFile = resourceLoaderModule.loadResourceFile;
        
        // Mock the header module
        const headerModule = require('../../template/webview/header');
        const originalGetHeaderHtml = headerModule.getHeaderHtml;
        
        // Mock the footer module
        const footerModule = require('../../template/webview/footer');
        const originalGetFooterHtml = footerModule.getFooterHtml;

        resourceLoaderModule.loadResourceFile = async (context: any, resourcePath: string) => {
            console.log('Mock loadResourceFile called with:', resourcePath);
            if (resourcePath.includes('webview.css')) {
                cssLoadCount++;
                console.log('CSS load count incremented to:', cssLoadCount);
                return '.mock-css { color: red; }';
            }
            return originalLoadResourceFile(context, resourcePath);
        };

        headerModule.getHeaderHtml = async () => {
            console.log('Mock getHeaderHtml called');
            headerLoadCount++;
            return '<header>Mock Header</header>';
        };

        footerModule.getFooterHtml = async () => {
            console.log('Mock getFooterHtml called');
            footerLoadCount++;
            return '<footer>Mock Footer</footer>';
        };

        // We need to mock the project list module since it's used during refresh
        const projectListModule = require('../../template/project/projectlist');
        const originalGetProjectListHtml = projectListModule.getProjectListHtml;
        projectListModule.getProjectListHtml = async () => '<div>Mock Project List</div>';

        try {
            // Create a mock extension context
            const mockContext: vscode.ExtensionContext = {
                extensionUri: vscode.Uri.file(path.join(__dirname, '../../..')),
                subscriptions: [],
                workspaceState: {
                    get: () => undefined,
                    update: () => Promise.resolve()
                } as any,
                globalState: {
                    get: () => undefined,
                    update: () => Promise.resolve()
                } as any,
                extensionPath: path.join(__dirname, '../../..'),
                asAbsolutePath: (relativePath: string) => {
                    return path.join(__dirname, '../../../', relativePath);
                },
                storagePath: __dirname,
                globalStoragePath: __dirname,
                logPath: __dirname,
            } as any;

            // Create a provider instance
            const provider = new ProjectsWebviewProvider(mockContext.extensionUri, mockContext);

            // Create a mock webview view
            const mockWebviewView: vscode.WebviewView = {
                webview: {
                    html: '',
                    options: {},
                    onDidReceiveMessage: () => ({ dispose: () => {} }),
                    postMessage: () => Promise.resolve(true)
                } as any,
                onDidChangeVisibility: () => ({ dispose: () => {} }),
                onDidDispose: () => ({ dispose: () => {} }),
                title: 'Test View',
                description: 'Test',
                visible: true,
            } as any;

            // Initialize the provider - this should load CSS once
            await provider.resolveWebviewView(mockWebviewView, { state: undefined } as any, {} as any);

            // Check that CSS was loaded exactly once during initialization
            assert.strictEqual(cssLoadCount, 1, 'CSS should be loaded exactly once during initialization');

            // Save the initial count
            const initialCssLoadCount = cssLoadCount;

            // Refresh the provider multiple times
            await provider.refresh();
            await provider.refresh();

            // Check that the CSS wasn't loaded again during refreshes
            assert.strictEqual(cssLoadCount, initialCssLoadCount, 'CSS should not be loaded again during refresh operations');

        } finally {
            // Restore the original functions
            resourceLoaderModule.loadResourceFile = originalLoadResourceFile;
            headerModule.getHeaderHtml = originalGetHeaderHtml;
            footerModule.getFooterHtml = originalGetFooterHtml;
            projectListModule.getProjectListHtml = originalGetProjectListHtml;
        }
    });
});
