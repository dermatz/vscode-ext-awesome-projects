import * as assert from 'assert';
import * as vscode from 'vscode';
import { Project } from '../extension';
import { getProjectId } from '../template/project/utils/project-id';

const extensionId = 'MathiasElle.awesome-projects';

// Add test setup
suite('Awesome Projects Extension Test Suite', () => {
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

    vscode.window.showInformationMessage('Starting Awesome Projects tests.');

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

    test('Should have correct configuration settings', () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        assert.ok(config.has('projects'), "Projects setting is missing");
        assert.ok(config.has('useFavicons'), "useFavicons setting is missing");
    });

    test('Should be able to add a project', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            const projectData = {
                name: "Test Project",
                path: "/test/path",
                color: "#ff0000",
                productionUrl: "https://test.com"
            };

            const newProject: Project = {
                ...projectData,
                id: getProjectId({ ...projectData, id: '' } as Project)
            };

            // Ensure we're starting with a clean slate
            await config.update('projects', [], vscode.ConfigurationTarget.Global);

            // Add the new project
            await config.update('projects', [newProject], vscode.ConfigurationTarget.Global);

            // Force a configuration reload
            await new Promise(resolve => setTimeout(resolve, 100));

            // Get the updated configuration
            const updatedConfig = vscode.workspace.getConfiguration('awesomeProjects');
            const updatedProjects = updatedConfig.get<Project[]>('projects') || [];

            assert.strictEqual(updatedProjects.length, 1, "Project was not added");
            assert.deepStrictEqual(updatedProjects[0], newProject, "Added project does not match");
        } finally {
            // Clean up - restore original projects
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });

    test('Should create webview with correct properties', async () => {
        const webview = vscode.window.createWebviewPanel(
            'awesomeProjectsView',
            'Awesome Projects',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(__dirname)
                ]
            }
        );

        assert.ok(webview, "Webview was not created");
        assert.strictEqual(webview.title, 'Awesome Projects', "Webview has incorrect title");
        assert.ok(webview.webview.options.enableScripts, "Scripts should be enabled in webview");

        webview.dispose();
    });

    test('Should handle project updates', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        const projectData = {
            name: "Update Test",
            path: "/update/test",
            color: "#00ff00"
        };

        const testProject: Project = {
            ...projectData,
            id: getProjectId({ ...projectData, id: '' } as Project)
        };

        await config.update('projects', [...initialProjects, testProject], vscode.ConfigurationTarget.Global);

        const updatedProject = { ...testProject, name: "Updated Name" };
        const projects = config.get<Project[]>('projects') || [];
        const index = projects.findIndex(p => p.path === testProject.path);

        if (index !== -1) {
            projects[index] = updatedProject;
            await config.update('projects', projects, vscode.ConfigurationTarget.Global);

            const finalProjects = config.get<Project[]>('projects') || [];
            const updated = finalProjects.find(p => p.path === testProject.path);
            assert.strictEqual(updated?.name, "Updated Name", "Project was not updated correctly");
        }

        // Clean up
        await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
    });

    test('Should handle project deletion', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        const projectData = {
            name: "Delete Test",
            path: "/delete/test",
            color: "#00ff00"
        };

        const testProject: Project = {
            ...projectData,
            id: getProjectId({ ...projectData, id: '' } as Project)
        };

        // Add test project
        await config.update('projects', [...initialProjects, testProject], vscode.ConfigurationTarget.Global);

        // Delete test project
        const updatedProjects = initialProjects.filter(p => p.path !== testProject.path);
        await config.update('projects', updatedProjects, vscode.ConfigurationTarget.Global);

        // Verify deletion
        const finalProjects = config.get<Project[]>('projects') || [];
        const deletedProject = finalProjects.find(p => p.path === testProject.path);
        assert.strictEqual(deletedProject, undefined, "Project was not deleted");
    });

    test('Should update project fields and persist changes', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            const testProject = {
                id: 'test-id',
                name: 'Test Project',
                path: '/test/path',
                color: '#ff0000',
                productionUrl: 'https://prod.test.com',
                devUrl: 'https://dev.test.com',
                stagingUrl: 'https://staging.test.com',
                managementUrl: 'https://jira.test.com'
            };

            // Starte mit sauberem Zustand
            await config.update('projects', [testProject], vscode.ConfigurationTarget.Global);

            // Simuliere Änderungen an verschiedenen Feldern
            const updates = {
                name: 'Updated Project Name',
                productionUrl: 'https://new-prod.test.com',
                color: '#00ff00',
                devUrl: 'https://new-dev.test.com'
            };

            // Sende Update-Message (simuliert Save-Button-Klick)
            await vscode.commands.executeCommand('awesome-projects.updateProject', {
                projectId: testProject.id,
                updates: updates
            });

            // Prüfe ob die Änderungen persistiert wurden
            const updatedConfig = vscode.workspace.getConfiguration('awesomeProjects');
            const updatedProjects = updatedConfig.get<Project[]>('projects') || [];
            const updatedProject = updatedProjects.find(p => p.id === testProject.id);

            assert.ok(updatedProject, 'Updated project should exist');
            assert.strictEqual(updatedProject?.name, updates.name, 'Project name should be updated');
            assert.strictEqual(updatedProject?.productionUrl, updates.productionUrl, 'Production URL should be updated');
            assert.strictEqual(updatedProject?.color, updates.color, 'Color should be updated');
            assert.strictEqual(updatedProject?.devUrl, updates.devUrl, 'Dev URL should be updated');
            assert.strictEqual(updatedProject?.path, testProject.path, 'Path should remain unchanged');

        } finally {
            // Cleanup - restore original projects
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });

    test('Should handle empty and null values in project updates', async () => {
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            const testProject = {
                id: 'test-id',
                name: 'Test Project',
                path: '/test/path',
                productionUrl: 'https://test.com',
                color: '#ff0000'
            };

            await config.update('projects', [testProject], vscode.ConfigurationTarget.Global);

            // Teste Aktualisierung mit leeren Werten
            const updates = {
                productionUrl: '',
                color: null
            };

            await vscode.commands.executeCommand('awesome-projects.updateProject', {
                projectId: testProject.id,
                updates: updates
            });

            const updatedConfig = vscode.workspace.getConfiguration('awesomeProjects');
            const updatedProjects = updatedConfig.get<Project[]>('projects') || [];
            const updatedProject = updatedProjects.find(p => p.id === testProject.id);

            assert.ok(updatedProject, 'Project should still exist');
            assert.strictEqual(updatedProject?.productionUrl, '', 'Production URL should be empty string');
            assert.strictEqual(updatedProject?.color, null, 'Color should be null');
            assert.strictEqual(updatedProject?.name, testProject.name, 'Name should remain unchanged');

        } finally {
            // Cleanup
            await config.update('projects', initialProjects, vscode.ConfigurationTarget.Global);
        }
    });
});
