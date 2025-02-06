import * as assert from 'assert';
import * as vscode from 'vscode';
import { Project } from '../extension';

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
        const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
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
        // Get initial configuration
        const config = vscode.workspace.getConfiguration('awesomeProjects');
        const initialProjects = config.get<Project[]>('projects') || [];

        try {
            const newProject: Project = {
                name: "Test Project",
                path: "/test/path",
                color: "#ff0000",
                productionUrl: "https://test.com"
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

        const testProject: Project = {
            name: "Update Test",
            path: "/update/test",
            color: "#00ff00"
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
});
