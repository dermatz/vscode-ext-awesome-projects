import * as vscode from 'vscode';
import { Project } from './extension';
import { showInFileManager } from './fileManager';

export async function handleAddProject(): Promise<void> {
    const folderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: false
    });

    if (!folderUri?.[0]) {return;}

    try {
        const projectPath = folderUri[0].fsPath;
        const defaultName = projectPath.split('/').pop() || '';
        const projectName = await vscode.window.showInputBox({
            prompt: 'Enter project name',
            value: defaultName
        }) || defaultName;

        await saveProject({ path: projectPath, name: projectName });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to add project: ${error}`);
    }
}

async function saveProject(newProject: Project): Promise<void> {
    const configuration = vscode.workspace.getConfiguration('awesomeProjects');
    const projects: Project[] = configuration.get('projects') || [];

    await configuration.update(
        'projects',
        [...projects, newProject],
        vscode.ConfigurationTarget.Global
    );
}

export function handleOpenProject(projectName: string): void {
    vscode.window.showInformationMessage(`Opening project: ${projectName}`);
}

export function handleShowInFileManager(project: Project): void {
    if (project?.path) {
        showInFileManager(project.path);
    } else {
        vscode.window.showErrorMessage('No valid project path provided');
    }
}
