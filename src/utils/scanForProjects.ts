import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from '../extension';

export async function scanForGitProjects(startPath: string): Promise<string[]> {
    const gitProjects: string[] = [];

    async function scan(dir: string, depth: number = 0) {
        if (depth > 5) return; // Limit recursion depth

        try {
            const files = await fs.promises.readdir(dir);

            // Check if current directory is a git repo
            if (files.includes('.git')) {
                gitProjects.push(dir);
                return; // Don't scan deeper if we found a git repo
            }

            // Scan subdirectories
            for (const file of files) {
                const filePath = path.join(dir, file);
                try {
                    const stat = await fs.promises.stat(filePath);
                    if (stat.isDirectory() && !file.startsWith('.')) {
                        await scan(filePath, depth + 1);
                    }
                } catch (err) {
                    console.log(`Error accessing ${filePath}:`, err);
                }
            }
        } catch (err) {
            console.log(`Error scanning ${dir}:`, err);
        }
    }

    await scan(startPath);
    return gitProjects;
}

export async function addScannedProjects(projects: string[]): Promise<void> {
    const configuration = vscode.workspace.getConfiguration('awesomeProjects');
    const existingProjects: Project[] = configuration.get('projects') || [];

    // Filter out already existing projects
    const newProjects = projects.filter(path =>
        !existingProjects.some(p => p.path === path)
    );

    if (newProjects.length === 0) {
        vscode.window.showInformationMessage('No new projects found');
        return;
    }

    // Let user select which projects to add
    const selectedPaths = await vscode.window.showQuickPick(
        newProjects.map(path => ({
            label: path.split('/').pop() || path,
            description: path,
            path: path
        })),
        {
            canPickMany: true,
            placeHolder: 'Select projects to add'
        }
    );

    if (!selectedPaths || selectedPaths.length === 0) return;

    // Create new project entries
    const projectsToAdd: Project[] = selectedPaths.map(selection => ({
        name: selection.label,
        path: selection.path,
        color: null
    }));

    // Add to configuration
    await configuration.update(
        'projects',
        [...existingProjects, ...projectsToAdd],
        vscode.ConfigurationTarget.Global
    );

    vscode.window.showInformationMessage(`Added ${projectsToAdd.length} new projects`);
}
