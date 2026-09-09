import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { getTimeTrackingReportHtml } from '../template/timeTracking/report';
import { TimeTrackingService, TIME_TRACKING_STATE_KEY } from '../timeTrackingService';

suite('Time Tracking Report Template Tests', () => {
    let context: vscode.ExtensionContext;
    let service: TimeTrackingService;
    let webview: vscode.Webview;

    setup(() => {
        const globalState = new Map<string, unknown>();
        context = {
            globalState: {
                get: <T>(key: string): T | undefined => globalState.get(key) as T | undefined,
                update: async (key: string, value: unknown) => {
                    globalState.set(key, value);
                }
            },
            subscriptions: [],
            extensionUri: vscode.Uri.file(path.join(__dirname, '../../..')),
            extensionPath: path.join(__dirname, '../../..')
        } as unknown as vscode.ExtensionContext;
        service = new TimeTrackingService(context);
        webview = {
            asWebviewUri: (uri: vscode.Uri) => uri
        } as unknown as vscode.Webview;
    });

    teardown(() => {
        service.dispose();
    });

    test('renders empty state with CTA', async () => {
        const html = await getTimeTrackingReportHtml(context, webview, service, 'week');
        assert.ok(html.includes('No sessions for this period'));
        assert.ok(html.includes('Start tracking time from a project in the sidebar'));
    });

    test('renders sessions and total time', async () => {
        const state = {
            sessionsByProject: {
                'proj-1': [
                    {
                        id: 's-1',
                        projectId: 'proj-1',
                        title: 'Feature work',
                        startTime: new Date().toISOString(),
                        endTime: new Date().toISOString(),
                        durationSeconds: 3600,
                        branchLog: [{ branch: 'feature/123', changedAt: new Date().toISOString() }],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ]
            }
        };
        await context.globalState.update(TIME_TRACKING_STATE_KEY, state);

        const html = await getTimeTrackingReportHtml(context, webview, service, 'week');
        assert.ok(html.includes('Feature work'));
        assert.ok(html.includes('1h 00m 00s'));
        assert.ok(html.includes('feature/123'));
    });

    test('renders export button when sessions exist', async () => {
        const state = {
            sessionsByProject: {
                'proj-1': [
                    {
                        id: 's-1',
                        projectId: 'proj-1',
                        title: 'Feature work',
                        startTime: new Date().toISOString(),
                        endTime: new Date().toISOString(),
                        durationSeconds: 3600,
                        branchLog: [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ]
            }
        };
        await context.globalState.update(TIME_TRACKING_STATE_KEY, state);

        const html = await getTimeTrackingReportHtml(context, webview, service, 'week');
        assert.ok(html.includes('Export CSV'));
    });

    test('active session is shown regardless of period start boundary', async () => {
        const activeSession = {
            id: 'active-1',
            projectId: 'proj-1',
            title: 'Overnight work',
            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            durationSeconds: 300,
            branchLog: [{ branch: 'main', changedAt: new Date().toISOString() }],
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString()
        };
        await context.globalState.update(TIME_TRACKING_STATE_KEY, {
            sessionsByProject: { 'proj-1': [activeSession] },
            activeSession: {
                sessionId: activeSession.id,
                projectId: activeSession.projectId,
                workspaceFolderPath: '/workspace/a',
                lastBranch: 'main',
                lastTickAt: Date.now(),
                accumulatedSeconds: activeSession.durationSeconds,
                accumulatedMs: activeSession.durationSeconds * 1000
            }
        });

        const html = await getTimeTrackingReportHtml(context, webview, service, 'today');
        assert.ok(html.includes('Overnight work'));
        assert.ok(html.includes('Timer running'));
    });

    test('renders branch fallback message when git is unavailable', async () => {
        const state = {
            sessionsByProject: {
                'proj-1': [
                    {
                        id: 's-2',
                        projectId: 'proj-1',
                        title: 'Work without branch',
                        startTime: new Date().toISOString(),
                        endTime: new Date().toISOString(),
                        durationSeconds: 600,
                        branchLog: [{ branch: 'Unknown, no GIT branch found', changedAt: new Date().toISOString() }],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ]
            }
        };
        await context.globalState.update(TIME_TRACKING_STATE_KEY, state);

        const html = await getTimeTrackingReportHtml(context, webview, service, 'week');
        assert.ok(html.includes('Unknown, no GIT branch found'));
    });
});
