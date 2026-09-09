import * as assert from 'assert';
import * as vscode from 'vscode';
import { getProjectItemHtml } from '../template/project/components/project-item';

suite('project-item – icon URL', () => {
    const mockContext = {
        extensionPath: __dirname,
        extensionUri: vscode.Uri.file(__dirname),
        subscriptions: [],
        globalState: {
            get: () => undefined,
            update: async () => {},
            setKeysForSync: () => {}
        },
        workspaceState: {
            get: () => undefined,
            update: async () => {}
        },
        secrets: {
            get: async () => undefined,
            store: async () => {},
            delete: async () => {}
        }
    } as unknown as vscode.ExtensionContext;

    test('uses iconUrl as direct image source when file extension is present', async () => {
        const html = await getProjectItemHtml(mockContext, {
            project: {
                id: 'test-iconurl',
                name: 'Test',
                path: '/tmp/test',
                productionUrl: 'https://production.com',
                iconUrl: 'https://cdn.example.com/icon.png'
            },
            index: 0,
            useFavicons: true,
            pathExists: true
        });

        assert.ok(html.includes('src="https://cdn.example.com/icon.png"'), 'should use iconUrl as direct image source');
        assert.ok(!html.includes('google.com/s2/favicons'), 'should not use Google favicon service');
    });

    test('uses Google favicon service when iconUrl is a bare domain', async () => {
        const html = await getProjectItemHtml(mockContext, {
            project: {
                id: 'test-iconurl-domain',
                name: 'Test',
                path: '/tmp/test',
                iconUrl: 'https://example.com'
            },
            index: 0,
            useFavicons: true,
            pathExists: true
        });

        assert.ok(html.includes('google.com/s2/favicons?domain=https://example.com'), 'should use Google favicon service with iconUrl domain');
    });

    test('falls back to productionUrl favicon when iconUrl is not set', async () => {
        const html = await getProjectItemHtml(mockContext, {
            project: {
                id: 'test-production',
                name: 'Test',
                path: '/tmp/test',
                productionUrl: 'https://production.com'
            },
            index: 0,
            useFavicons: true,
            pathExists: true
        });

        assert.ok(html.includes('google.com/s2/favicons?domain=https://production.com'), 'should use Google favicon from production URL');
    });

    test('ignores iconUrl when useFavicons is disabled', async () => {
        const html = await getProjectItemHtml(mockContext, {
            project: {
                id: 'test-nofavicon',
                name: 'Test',
                path: '/tmp/test',
                iconUrl: 'https://cdn.example.com/icon.png'
            },
            index: 0,
            useFavicons: false,
            pathExists: true
        });

        assert.ok(!html.includes('src="https://cdn.example.com/icon.png"'), 'should not use iconUrl as image source when favicons disabled');
        assert.ok(html.includes('📁'), 'should show folder emoji');
    });

    test('falls back to default emoji for invalid iconUrl', async () => {
        const html = await getProjectItemHtml(mockContext, {
            project: {
                id: 'test-invalid-iconurl',
                name: 'Test',
                path: '/tmp/test',
                iconUrl: 'javascript:alert(1)'
            },
            index: 0,
            useFavicons: true,
            pathExists: true
        });

        assert.ok(!html.includes('src="javascript:'), 'should not render invalid iconUrl as image source');
        assert.ok(html.includes('📁'), 'should show folder emoji');
    });
});
