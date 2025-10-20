import * as assert from 'assert';
import * as vscode from 'vscode';
import { Project } from '../extension';
import { getProjectId } from '../template/project/utils/project-id';

/**
 * Test Suite für Cache-Invalidierung bei Projekt-Operationen
 *
 * Diese Tests überprüfen, dass das Caching-System korrekt funktioniert
 * und gelöschte Projekte nicht wieder auftauchen.
 */
suite('Project Cache Invalidation Test Suite', () => {
    const extensionId = 'MathiasElle.awesome-projects';

    // Mock webview functionality before tests
    const mockWebview = {
        html: '',
        options: {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(__dirname)]
        }
    };

    suiteSetup(() => {
        // Mock createWebviewPanel to avoid actual webview creation
        vscode.window.createWebviewPanel = (viewType: string, title: string, showOptions: any, options?: any) => {
            return {
                webview: mockWebview,
                title,
                dispose: () => {}
            } as any;
        };
    });

    test('Should prevent deleted projects from reappearing after multiple deletions', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            // Create multiple test projects
            const testProjects: Project[] = [
                {
                    id: 'cache-test-project-1',
                    name: 'Cache Test Project 1',
                    path: '/cache/test/1',
                    color: '#ff6b6b'
                },
                {
                    id: 'cache-test-project-2',
                    name: 'Cache Test Project 2',
                    path: '/cache/test/2',
                    color: '#4ecdc4'
                },
                {
                    id: 'cache-test-project-3',
                    name: 'Cache Test Project 3',
                    path: '/cache/test/3',
                    color: '#45b7d1'
                }
            ];

            // Add all test projects
            await config.update('projects', [...initialProjects, ...testProjects], vscode.ConfigurationTarget.Global);

            // Force configuration reload
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify all projects were added
            let currentConfig = vscode.workspace.getConfiguration('awesomeProjects');
            let currentProjects = currentConfig.get<Project[]>('projects') || [];
            assert.strictEqual(currentProjects.length, initialProjects.length + 3, 'All test projects should be added');

            // Mock user confirmation to always return 'Yes'
            const originalShowWarningMessage = vscode.window.showWarningMessage;
            vscode.window.showWarningMessage = async (message: string, options?: any, ...items: string[]) => {
                return 'Yes'; // Always confirm deletion
            };

            // Delete first project
            await vscode.commands.executeCommand('awesome-projects.deleteProject', {
                projectId: 'cache-test-project-1'
            });

            // Verify first project is deleted
            currentConfig = vscode.workspace.getConfiguration('awesomeProjects');
            currentProjects = currentConfig.get<Project[]>('projects') || [];
            let project1 = currentProjects.find(p => p.id === 'cache-test-project-1');
            let project2 = currentProjects.find(p => p.id === 'cache-test-project-2');
            let project3 = currentProjects.find(p => p.id === 'cache-test-project-3');

            assert.strictEqual(project1, undefined, 'First project should be deleted');
            assert.ok(project2, 'Second project should still exist');
            assert.ok(project3, 'Third project should still exist');
            assert.strictEqual(currentProjects.length, initialProjects.length + 2, 'Should have 2 test projects remaining');

            // Delete second project
            await vscode.commands.executeCommand('awesome-projects.deleteProject', {
                projectId: 'cache-test-project-2'
            });

            // Critical test: Verify that the first project doesn't reappear
            currentConfig = vscode.workspace.getConfiguration('awesomeProjects');
            currentProjects = currentConfig.get<Project[]>('projects') || [];
            project1 = currentProjects.find(p => p.id === 'cache-test-project-1');
            project2 = currentProjects.find(p => p.id === 'cache-test-project-2');
            project3 = currentProjects.find(p => p.id === 'cache-test-project-3');

            assert.strictEqual(project1, undefined, 'First project should STILL be deleted (not reappeared)');
            assert.strictEqual(project2, undefined, 'Second project should now be deleted');
            assert.ok(project3, 'Third project should still exist');
            assert.strictEqual(currentProjects.length, initialProjects.length + 1, 'Should have 1 test project remaining');

            // Delete third project
            await vscode.commands.executeCommand('awesome-projects.deleteProject', {
                projectId: 'cache-test-project-3'
            });

            // Final verification: No test projects should exist
            currentConfig = vscode.workspace.getConfiguration('awesomeProjects');
            currentProjects = currentConfig.get<Project[]>('projects') || [];
            project1 = currentProjects.find(p => p.id === 'cache-test-project-1');
            project2 = currentProjects.find(p => p.id === 'cache-test-project-2');
            project3 = currentProjects.find(p => p.id === 'cache-test-project-3');

            assert.strictEqual(project1, undefined, 'First project should remain deleted');
            assert.strictEqual(project2, undefined, 'Second project should remain deleted');
            assert.strictEqual(project3, undefined, 'Third project should now be deleted');
            assert.strictEqual(currentProjects.length, initialProjects.length, 'Should have no test projects remaining');

            // Restore original function
            vscode.window.showWarningMessage = originalShowWarningMessage;

        } finally {
            // Cleanup - restore original projects
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });

    test('Should maintain cache consistency after mixed operations', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            // Create test projects
            const testProjects: Project[] = [
                {
                    id: 'mixed-ops-project-1',
                    name: 'Mixed Ops Project 1',
                    path: '/mixed/ops/1'
                },
                {
                    id: 'mixed-ops-project-2',
                    name: 'Mixed Ops Project 2',
                    path: '/mixed/ops/2'
                }
            ];

            await config.update('projects', [...initialProjects, ...testProjects], vscode.ConfigurationTarget.Global);
            await new Promise(resolve => setTimeout(resolve, 100));

            // Mock confirmation
            const originalShowWarningMessage = vscode.window.showWarningMessage;
            vscode.window.showWarningMessage = async () => 'Yes';

            // Delete first project
            await vscode.commands.executeCommand('awesome-projects.deleteProject', {
                projectId: 'mixed-ops-project-1'
            });

            // Update second project
            await vscode.commands.executeCommand('awesome-projects.updateProject', {
                projectId: 'mixed-ops-project-2',
                updates: { name: 'Updated Mixed Ops Project 2' }
            });

            // Verify state consistency (without adding new project to avoid timeout)
            const currentConfig = vscode.workspace.getConfiguration('awesomeProjects');
            const currentProjects = currentConfig.get<Project[]>('projects') || [];

            const project1 = currentProjects.find(p => p.id === 'mixed-ops-project-1');
            const project2 = currentProjects.find(p => p.id === 'mixed-ops-project-2');

            assert.strictEqual(project1, undefined, 'Deleted project should not reappear after mixed operations');
            assert.ok(project2, 'Updated project should still exist');
            assert.strictEqual(project2?.name, 'Updated Mixed Ops Project 2', 'Project update should be preserved');

            // Restore original function
            vscode.window.showWarningMessage = originalShowWarningMessage;
        } finally {
            // Cleanup
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });

    test('Should invalidate cache correctly on configuration changes', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            const testProject: Project = {
                id: 'cache-invalidation-test',
                name: 'Cache Invalidation Test',
                path: '/cache/invalidation/test',
                color: '#9c88ff'
            };

            // Add project through configuration update (simulating external change)
            await config.update('projects', [...initialProjects, testProject], vscode.ConfigurationTarget.Global);

            // Give time for configuration change event to fire
            await new Promise(resolve => setTimeout(resolve, 150));

            // Verify project exists
            let currentConfig = vscode.workspace.getConfiguration('awesomeProjects');
            let currentProjects = currentConfig.get<Project[]>('projects') || [];
            let project = currentProjects.find(p => p.id === testProject.id);
            assert.ok(project, 'Project should exist after configuration update');

            // Delete project through command (this should invalidate cache)
            const originalShowWarningMessage = vscode.window.showWarningMessage;
            vscode.window.showWarningMessage = async () => 'Yes';

            await vscode.commands.executeCommand('awesome-projects.deleteProject', {
                projectId: testProject.id
            });

            // Verify project is deleted and cache is properly invalidated
            currentConfig = vscode.workspace.getConfiguration('awesomeProjects');
            currentProjects = currentConfig.get<Project[]>('projects') || [];
            project = currentProjects.find(p => p.id === testProject.id);
            assert.strictEqual(project, undefined, 'Project should be deleted and not cached');

            // Restore original function
            vscode.window.showWarningMessage = originalShowWarningMessage;

        } finally {
            // Cleanup
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });
});
