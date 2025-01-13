import * as vscode from 'vscode';
import { ProjectsWebviewProvider } from './webviewProvider';
import { Project } from './types';
import * as path from 'path';
import * as child_process from 'child_process';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "awesome-projects" is now active!');
    const disposable = vscode.commands.registerCommand('awesome-projects.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from vscode-ext-awesome-projects!');
    });
    context.subscriptions.push(disposable);

    const projectsProvider = new ProjectsWebviewProvider(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ProjectsWebviewProvider.viewType,
            projectsProvider
        ),
        projectsProvider // Add the provider to be disposed when deactivating
    );

    const addProjectCommand = vscode.commands.registerCommand('awesome-projects.addProject', () => {
        vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectMany: false
        }).then(async folderUri => {
            if (folderUri && folderUri[0]) {
                try {
                    const projectPath = folderUri[0].fsPath;
                    const configuration = vscode.workspace.getConfiguration('awesomeProjects');
                    const projects: Project[] = configuration.get('projects') || [];

                    const newProject: Project = {
                        path: projectPath,
                        name: await vscode.window.showInputBox({
                            prompt: 'Enter project name',
                            value: projectPath.split('/').pop()
                        }) || projectPath.split('/').pop() || ''
                    };

                    await configuration.update(
                        'projects',
                        [...projects, newProject],
                        vscode.ConfigurationTarget.Global
                    );

                    const updatedProjects = configuration.get<Project[]>('projects');
                    if (updatedProjects?.some(p => p.path === newProject.path)) {
                        projectsProvider.refresh();
                    } else {
                        throw new Error('Failed to save project to settings');
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to add project: ${error}`);
                }
            }
        });
    });

    const openProjectCommand = vscode.commands.registerCommand('awesome-projects.openProject', (projectName: string) => {
        vscode.window.showInformationMessage(`Opening project: ${projectName}`);
        // Add your logic to open the project here
    });

    // Add refresh command registration
    const refreshProjectsCommand = vscode.commands.registerCommand('awesome-projects.refreshProjects', () => {
        projectsProvider.refresh();
    });

    context.subscriptions.push(
        addProjectCommand,
        openProjectCommand,
        refreshProjectsCommand  // Add the new command to subscriptions
    );

    // Register the show in file manager command
    const showInFileManagerCommand = vscode.commands.registerCommand('awesome-projects.showInFileManager', (project: Project) => {
        console.log('Show in File Manager command called with project:', project);
        if (project && project.path) {
            showInFileManager(project.path);
        } else {
            vscode.window.showErrorMessage('No valid project path provided');
        }
    });

    context.subscriptions.push(showInFileManagerCommand);
}

function sanitizePath(inputPath: string): string {
    return inputPath.replace(/[;&|`$()]/g, '');
}

function showInFileManager(filePath: string) {
    if (!filePath) {
        vscode.window.showErrorMessage('No file path provided');
        return;
    }

    // Sanitize the file path
    const sanitizedPath = sanitizePath(filePath);

    // Validate the path exists
    try {
        const stats = fs.statSync(sanitizedPath);
        if (!stats.isDirectory() && !stats.isFile()) {
            throw new Error('Invalid path');
        }
    } catch (error) {
        vscode.window.showErrorMessage('Invalid path specified');
        return;
    }

    console.log(`showInFileManager called with filePath: ${sanitizedPath}`);
    const platform = process.platform;

    try {
        if (platform === 'linux' && sanitizedPath.startsWith('/mnt/')) {
            // WSL environment
            const driveLetter = sanitizedPath.charAt(5).toUpperCase();
            const windowsPath = `${driveLetter}:${sanitizedPath.slice(6).replace(/\//g, '\\')}`;

            console.log('Converting WSL path to Windows path:', windowsPath);

            // Use spawn instead of exec for better security
            child_process.spawn('explorer.exe', [windowsPath], {
                stdio: 'ignore',
                shell: false
            });

        } else if (platform === 'win32') {
            // Windows
            const normalizedPath = sanitizedPath.replace(/\//g, '\\');
            child_process.spawn('explorer.exe', [normalizedPath], {
                stdio: 'ignore',
                shell: false
            });
        } else if (platform === 'darwin') {
            // macOS
            child_process.spawn('open', ['-R', sanitizedPath], {
                stdio: 'ignore',
                shell: false
            });
        } else {
            // Linux
            child_process.spawn('xdg-open', [path.dirname(sanitizedPath)], {
                stdio: 'ignore',
                shell: false
            });
        }
    } catch (error) {
        console.error('Error showing file in file manager:', error);
        if (error instanceof Error) {
            const errorMessage = error.message;
            vscode.window.showErrorMessage(`Failed to open file manager: ${errorMessage}`);
        }
    }
}

export function deactivate() {}
