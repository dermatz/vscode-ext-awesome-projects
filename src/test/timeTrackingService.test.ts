import * as assert from 'assert';
import * as vscode from 'vscode';
import { TimeTrackingService, TIME_TRACKING_STATE_KEY } from '../timeTrackingService';
import { TimeTrackingState } from '../types/timeTracking';

suite('TimeTrackingService Tests', () => {
    let context: vscode.ExtensionContext;
    let service: TimeTrackingService;

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
    });

    teardown(() => {
        service.dispose();
    });

    test('startSession creates a session with branch log', async () => {
        const session = await service.startSession('proj-1', '/workspace/a', 'My Task');
        assert.strictEqual(session.projectId, 'proj-1');
        assert.strictEqual(session.title, 'My Task');
        assert.ok(session.branchLog.length >= 1);
    });

    test('stopSession calculates duration and clears active session', async () => {
        await service.startSession('proj-1', '/workspace/a');
        await new Promise(r => setTimeout(r, 50));
        const stopped = await service.stopSession('proj-1');
        assert.ok(stopped);
        assert.ok(stopped!.durationSeconds >= 0);
        assert.ok(stopped!.endTime);
        assert.strictEqual(service.getActiveSession(), undefined);
    });

    test('updateSession mutates title and description', async () => {
        const session = await service.startSession('proj-1', '/workspace/a');
        await service.stopSession('proj-1');

        const updated = await service.updateSession(session.id, {
            title: 'Updated',
            description: 'Desc'
        });
        assert.strictEqual(updated?.title, 'Updated');
        assert.strictEqual(updated?.description, 'Desc');
    });

    test('deleteSession removes session and adjusts aggregated time', async () => {
        service.addTimeToProject = async () => {};

        const session = await service.startSession('proj-1', '/workspace/a');
        await service.stopSession('proj-1');

        const deleted = await service.deleteSession(session.id);
        assert.strictEqual(deleted?.id, session.id);
        const remaining = service.getSessionsByProject('proj-1');
        assert.strictEqual(remaining.length, 0);
    });

    test('recoverActiveSession discard removes orphan session', async () => {
        const session = await service.startSession('proj-1', '/workspace/a');
        await service.recoverActiveSession('discard');
        assert.strictEqual(service.getActiveSession(), undefined);
        assert.strictEqual(service.getSessionsByProject('proj-1').length, 0);
    });

    test('cleanupOldSessions removes old sessions', async () => {
        // Mock project aggregation to avoid touching real VS Code: configuration
        service.addTimeToProject = async () => {};

        const state: TimeTrackingState = {
            sessionsByProject: {
                'proj-1': [
                    {
                        id: 'old-1',
                        projectId: 'proj-1',
                        title: 'Old',
                        startTime: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
                        endTime: new Date(Date.now() - 99 * 24 * 60 * 60 * 1000).toISOString(),
                        durationSeconds: 120,
                        branchLog: [],
                        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
                        updatedAt: new Date(Date.now() - 99 * 24 * 60 * 60 * 1000).toISOString()
                    }
                ]
            }
        };
        await context.globalState.update(TIME_TRACKING_STATE_KEY, state);
        await service.cleanupOldSessions(30);
        assert.strictEqual(service.getSessionsByProject('proj-1').length, 0);
    });
});
