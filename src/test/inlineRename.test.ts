import * as assert from 'assert';
import * as vscode from 'vscode';
import { getSaveFunctionsScript } from '../template/project/utils/save-functions';
import { Project } from '../extension';

suite('Inline Rename Test Suite', () => {

    // ──────────────────────────────────────────────
    // Unit: Client-side script
    // ──────────────────────────────────────────────

    test('getSaveFunctionsScript should define startInlineRename', () => {
        const script = getSaveFunctionsScript();
        assert.ok(
            script.includes('function startInlineRename('),
            'startInlineRename function should be defined in the script'
        );
    });

    test('startInlineRename should send an updateProject message', () => {
        const script = getSaveFunctionsScript();
        assert.ok(
            script.includes("command: 'updateProject'"),
            'startInlineRename should post an updateProject message'
        );
        assert.ok(
            script.includes("updates: { name: newName }"),
            'startInlineRename should include the new name in updates'
        );
    });

    test('startInlineRename should only save when name is non-empty and changed', () => {
        const script = getSaveFunctionsScript();
        assert.ok(
            script.includes('newName && newName !== currentName'),
            'startInlineRename should guard against empty or unchanged names'
        );
    });

    test('startInlineRename should stop event propagation', () => {
        const script = getSaveFunctionsScript();
        assert.ok(
            script.includes('event.stopPropagation()'),
            'startInlineRename should stop event propagation to prevent dropdown toggle'
        );
    });

    test('startInlineRename should handle Escape to cancel rename', () => {
        const script = getSaveFunctionsScript();
        assert.ok(
            script.includes("e.key === 'Escape'"),
            'startInlineRename should cancel on Escape key'
        );
        assert.ok(
            script.includes('cancel()'),
            'startInlineRename should call cancel() on Escape'
        );
    });

    test('startInlineRename should commit on Enter', () => {
        const script = getSaveFunctionsScript();
        assert.ok(
            script.includes("e.key === 'Enter'"),
            'startInlineRename should commit on Enter key'
        );
    });

    test('startInlineRename should not open multiple inputs (guard check)', () => {
        const script = getSaveFunctionsScript();
        assert.ok(
            script.includes("nameEl.querySelector('input')"),
            'startInlineRename should bail out if an input already exists'
        );
    });

    // ──────────────────────────────────────────────
    // Integration: updateProject command with name
    // ──────────────────────────────────────────────

    test('updateProject command should rename a project', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        const testProject: Project = {
            id: 'inline-rename-test',
            name: 'Original Name',
            path: '/test/inline-rename'
        };

        try {
            await config.update('projects', [...initialProjects, testProject], vscode.ConfigurationTarget.Global);
            await new Promise(resolve => setTimeout(resolve, 100));

            await vscode.commands.executeCommand('awesome-projects.updateProject', {
                command: 'updateProject',
                projectId: 'inline-rename-test',
                updates: { name: 'Renamed Project' }
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            const updated = vscode.workspace.getConfiguration('awesomeProjects')
                .get<Project[]>('projects')
                ?.find(p => p.id === 'inline-rename-test');

            assert.ok(updated, 'Project should still exist after rename');
            assert.strictEqual(updated?.name, 'Renamed Project', 'Project name should be updated');
        } finally {
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });

    test('updateProject command should not affect other projects when renaming', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        const projectA: Project = { id: 'rename-proj-a', name: 'Project A', path: '/test/rename-a' };
        const projectB: Project = { id: 'rename-proj-b', name: 'Project B', path: '/test/rename-b' };

        try {
            await config.update('projects', [...initialProjects, projectA, projectB], vscode.ConfigurationTarget.Global);
            await new Promise(resolve => setTimeout(resolve, 100));

            await vscode.commands.executeCommand('awesome-projects.updateProject', {
                command: 'updateProject',
                projectId: 'rename-proj-a',
                updates: { name: 'Project A – Renamed' }
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            const projects = vscode.workspace.getConfiguration('awesomeProjects').get<Project[]>('projects') || [];
            const a = projects.find(p => p.id === 'rename-proj-a');
            const b = projects.find(p => p.id === 'rename-proj-b');

            assert.strictEqual(a?.name, 'Project A – Renamed', 'Project A should be renamed');
            assert.strictEqual(b?.name, 'Project B', 'Project B should remain unchanged');
        } finally {
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });

    test('updateProject command should handle non-existent projectId gracefully', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            await vscode.commands.executeCommand('awesome-projects.updateProject', {
                command: 'updateProject',
                projectId: 'does-not-exist',
                updates: { name: 'Ghost Name' }
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            const projects = vscode.workspace.getConfiguration('awesomeProjects').get<Project[]>('projects') || [];
            assert.strictEqual(
                projects.length,
                initialProjects.length,
                'Project list should be unchanged when projectId does not exist'
            );
        } finally {
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });
});
