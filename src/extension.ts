import * as vscode from 'vscode';
import { ProjectsWebviewProvider } from './webviewProvider';
import { Project } from './types';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';

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

function showInFileManager(filePath: string) {
    if (!filePath) {
        vscode.window.showErrorMessage('No file path provided');
        return;
    }

    console.log(`showInFileManager called with filePath: ${filePath}`);
    const platform = process.platform;
    
    try {
        if (platform === 'linux' && filePath.startsWith('/mnt/')) {
            // WSL Umgebung - verwendet Windows Explorer
            const driveLetter = filePath.charAt(5).toUpperCase();
            const windowsPath = `${driveLetter}:${filePath.slice(6).replace(/\//g, '\\')}`;
            
            console.log('Converting WSL path to Windows path:', windowsPath);
            
            // Direkter Explorer-Aufruf ohne PowerShell
            const explorerCommand = `explorer.exe "${windowsPath}"`;
            console.log('Executing command:', explorerCommand);
            
            // Führe den Befehl aus und zeige etwaige Fehler an
            const result = child_process.execSync(explorerCommand, { 
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            console.log('Command executed successfully:', result);
            
        } else if (platform === 'win32') {
            // Windows - verwendet Explorer
            const normalizedPath = filePath.replace(/\//g, '\\');
            const explorerCommand = `explorer.exe "${normalizedPath}"`;
            
            child_process.execSync(explorerCommand, {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
        } else if (platform === 'darwin') {
            // macOS - verwendet Finder
            child_process.exec(`open -R "${filePath}"`, (error) => {
                if (error) {
                    console.error('Failed to open Finder:', error);
                    vscode.window.showErrorMessage(`Failed to open Finder: ${error.message}`);
                }
            });
        } else {
            // Linux - verwendet den Standard-Dateimanager
            child_process.exec(`xdg-open "${path.dirname(filePath)}"`, (error) => {
                if (error) {
                    console.error('Failed to open file manager:', error);
                    vscode.window.showErrorMessage(`Failed to open file manager: ${error.message}`);
                }
            });
        }
    } catch (error) {
        console.error('Error showing file in file manager:', error);
        if (error instanceof Error) {
            const errorMessage = error.message;
            if (errorMessage.includes('ENOENT')) {
                vscode.window.showErrorMessage('Failed to open file manager: Explorer.exe not found');
            } else {
                vscode.window.showErrorMessage(`Failed to open file manager: ${errorMessage}`);
            }
        }
    }
}

export function deactivate() {}
