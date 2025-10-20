import * as assert from 'assert';
import * as vscode from 'vscode';
import { Project } from '../extension';
import { getProjectId } from '../template/project/utils/project-id';

/**
 * Test Suite für die Projekt-Löschfunktionalität
 *
 * Diese Test-Suite überprüft verschiedene Aspekte des Löschens von Projekten:
 * - Erfolgreiche Löschung mit Benutzerbestätigung
 * - Abbruch der Löschung durch den Benutzer
 * - Behandlung von ungültigen oder fehlenden Projekt-IDs
 * - Korrekte Aktualisierung der Konfiguration
 */
suite('Project Deletion Test Suite', () => {
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

    test('Should successfully delete project with user confirmation', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            // Create test project
            const testProject: Project = {
                id: 'delete-test-project',
                name: 'Test Project für Löschung',
                path: '/test/deletion/path',
                color: '#ff6b6b',
                productionUrl: 'https://test-deletion.com',
                devUrl: 'https://dev.test-deletion.com'
            };

            // Add test project to configuration
            await config.update('projects', [...initialProjects, testProject], vscode.ConfigurationTarget.Global);

            // Force configuration reload
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify project was added
            let currentConfig = vscode.workspace.getConfiguration('awesomeProjects');
            let currentProjects = currentConfig.get<Project[]>('projects') || [];
            assert.ok(currentProjects.find(p => p.id === testProject.id), 'Test project should be added');

            // Mock user confirmation to 'Yes'
            const originalShowWarningMessage = vscode.window.showWarningMessage;
            let confirmationCalled = false;
            let confirmationMessage = '';

            vscode.window.showWarningMessage = async (message: string, options?: any, ...items: string[]) => {
                confirmationCalled = true;
                confirmationMessage = message;
                return 'Yes'; // User confirms deletion
            };

            // Execute deletion command
            const result = await vscode.commands.executeCommand('awesome-projects.deleteProject', {
                projectId: testProject.id
            });

            // Verify deletion was successful
            assert.strictEqual(result, true, 'Delete command should return true for successful deletion');
            assert.ok(confirmationCalled, 'Confirmation dialog should be displayed');
            assert.ok(confirmationMessage.includes(testProject.name), 'Confirmation should include project name');
            assert.ok(confirmationMessage.includes('Are you sure'), 'Confirmation should ask for user confirmation');

            // Verify project was removed from configuration
            currentConfig = vscode.workspace.getConfiguration('awesomeProjects');
            currentProjects = currentConfig.get<Project[]>('projects') || [];
            const deletedProject = currentProjects.find(p => p.id === testProject.id);
            assert.strictEqual(deletedProject, undefined, 'Project should be deleted from configuration');

            // Restore original function
            vscode.window.showWarningMessage = originalShowWarningMessage;

        } finally {
            // Cleanup - restore original configuration
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });

    test('Should cancel deletion when user clicks No', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            const testProject: Project = {
                id: 'cancel-delete-project',
                name: 'Projekt zum Abbrechen',
                path: '/test/cancel/path',
                color: '#4ecdc4'
            };

            // Add test project
            await config.update('projects', [...initialProjects, testProject], vscode.ConfigurationTarget.Global);

            // Force configuration reload
            await new Promise(resolve => setTimeout(resolve, 100));

            // Mock user cancellation
            const originalShowWarningMessage = vscode.window.showWarningMessage;
            vscode.window.showWarningMessage = async (message: string, options?: any, ...items: string[]) => {
                return 'No'; // User cancels deletion
            };

            // Execute deletion command
            const result = await vscode.commands.executeCommand('awesome-projects.deleteProject', {
                projectId: testProject.id
            });

            // Verify deletion was cancelled
            assert.strictEqual(result, false, 'Delete command should return false when cancelled');

            // Verify project still exists
            const currentConfig = vscode.workspace.getConfiguration('awesomeProjects');
            const currentProjects = currentConfig.get<Project[]>('projects') || [];
            const project = currentProjects.find(p => p.id === testProject.id);
            assert.ok(project, 'Project should still exist after cancellation');
            assert.strictEqual(project?.name, testProject.name, 'Project data should be unchanged');

            // Restore original function
            vscode.window.showWarningMessage = originalShowWarningMessage;

        } finally {
            // Cleanup
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });

    test('Should handle invalid project ID gracefully', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            // Mock confirmation dialog (should not be called)
            const originalShowWarningMessage = vscode.window.showWarningMessage;
            let confirmationCalled = false;
            vscode.window.showWarningMessage = async (message: string, options?: any, ...items: string[]) => {
                confirmationCalled = true;
                return 'Yes';
            };

            // Try to delete non-existent project
            const result = await vscode.commands.executeCommand('awesome-projects.deleteProject', {
                projectId: 'non-existent-project-12345'
            });

            // Verify proper handling
            assert.strictEqual(result, false, 'Delete command should return false for non-existent project');
            assert.strictEqual(confirmationCalled, false, 'Confirmation dialog should not be shown for non-existent project');

            // Verify configuration is unchanged
            const currentProjects = config.get<Project[]>('projects') || [];
            assert.strictEqual(currentProjects.length, initialProjects.length, 'Configuration should be unchanged');

            // Restore original function
            vscode.window.showWarningMessage = originalShowWarningMessage;

        } finally {
            // Cleanup
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });

    test('Should handle missing projectId parameter', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            // Mock confirmation dialog (should not be called)
            const originalShowWarningMessage = vscode.window.showWarningMessage;
            let confirmationCalled = false;
            vscode.window.showWarningMessage = async (message: string, options?: any, ...items: string[]) => {
                confirmationCalled = true;
                return 'Yes';
            };

            // Try to delete without projectId
            const result = await vscode.commands.executeCommand('awesome-projects.deleteProject', {});

            // Verify proper handling
            assert.strictEqual(result, false, 'Delete command should return false when projectId is missing');
            assert.strictEqual(confirmationCalled, false, 'Confirmation dialog should not be shown when projectId is missing');

            // Verify configuration is unchanged
            const currentProjects = config.get<Project[]>('projects') || [];
            assert.strictEqual(currentProjects.length, initialProjects.length, 'Configuration should be unchanged');

            // Restore original function
            vscode.window.showWarningMessage = originalShowWarningMessage;

        } finally {
            // Cleanup
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });

    test('Should delete only the specified project from multiple projects', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            // Create multiple test projects
            const testProjects: Project[] = [
                {
                    id: 'keep-project-1',
                    name: 'Behalte Projekt 1',
                    path: '/keep/1'
                },
                {
                    id: 'delete-this-project',
                    name: 'Lösche dieses Projekt',
                    path: '/delete/this',
                    color: '#ff4757'
                },
                {
                    id: 'keep-project-2',
                    name: 'Behalte Projekt 2',
                    path: '/keep/2',
                    productionUrl: 'https://keep2.com'
                }
            ];

            // Add all test projects
            await config.update('projects', [...initialProjects, ...testProjects], vscode.ConfigurationTarget.Global);

            // Force configuration reload
            await new Promise(resolve => setTimeout(resolve, 100));

            // Mock user confirmation
            const originalShowWarningMessage = vscode.window.showWarningMessage;
            vscode.window.showWarningMessage = async (message: string, options?: any, ...items: string[]) => {
                return 'Yes'; // Confirm deletion
            };

            // Delete the middle project
            const result = await vscode.commands.executeCommand('awesome-projects.deleteProject', {
                projectId: 'delete-this-project'
            });

            // Verify deletion was successful
            assert.strictEqual(result, true, 'Delete command should return true');

            // Verify only the specified project was deleted
            const currentConfig = vscode.workspace.getConfiguration('awesomeProjects');
            const currentProjects = currentConfig.get<Project[]>('projects') || [];

            const deletedProject = currentProjects.find(p => p.id === 'delete-this-project');
            const keptProject1 = currentProjects.find(p => p.id === 'keep-project-1');
            const keptProject2 = currentProjects.find(p => p.id === 'keep-project-2');

            assert.strictEqual(deletedProject, undefined, 'Specified project should be deleted');
            assert.ok(keptProject1, 'First project should be kept');
            assert.ok(keptProject2, 'Second project should be kept');
            assert.strictEqual(keptProject1?.name, 'Behalte Projekt 1', 'First project data should be intact');
            assert.strictEqual(keptProject2?.productionUrl, 'https://keep2.com', 'Second project data should be intact');

            // Restore original function
            vscode.window.showWarningMessage = originalShowWarningMessage;

        } finally {
            // Cleanup
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });

    test('Should handle project deletion with special characters in name', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            // Create project with special characters
            const testProject: Project = {
                id: 'special-chars-project',
                name: 'Projekt "mit" \'speziellen\' & Zeichen (Test) [2024]',
                path: '/special/chars/path with spaces & symbols',
                color: '#9c88ff'
            };

            await config.update('projects', [...initialProjects, testProject], vscode.ConfigurationTarget.Global);

            // Force configuration reload
            await new Promise(resolve => setTimeout(resolve, 100));

            // Mock user confirmation
            const originalShowWarningMessage = vscode.window.showWarningMessage;
            let confirmationMessage = '';
            vscode.window.showWarningMessage = async (message: string, options?: any, ...items: string[]) => {
                confirmationMessage = message;
                return 'Yes';
            };

            // Execute deletion
            const result = await vscode.commands.executeCommand('awesome-projects.deleteProject', {
                projectId: testProject.id
            });

            // Verify deletion was successful
            assert.strictEqual(result, true, 'Delete command should handle special characters');
            assert.ok(confirmationMessage.includes(testProject.name), 'Confirmation should display full project name with special characters');

            // Verify project was deleted
            const currentConfig = vscode.workspace.getConfiguration('awesomeProjects');
            const currentProjects = currentConfig.get<Project[]>('projects') || [];
            const deletedProject = currentProjects.find(p => p.id === testProject.id);
            assert.strictEqual(deletedProject, undefined, 'Project with special characters should be deleted');

            // Restore original function
            vscode.window.showWarningMessage = originalShowWarningMessage;

        } finally {
            // Cleanup
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });
});
