import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from '../extension';
import { getProjectId } from '../template/project/utils/project-id';

// Cache for configuration to avoid repeated calls
let _cachedConfiguration: vscode.WorkspaceConfiguration | undefined;
let _configurationLoaded = false;

function getCachedConfiguration(): vscode.WorkspaceConfiguration {
    if (!_configurationLoaded || !_cachedConfiguration) {
        _cachedConfiguration = vscode.workspace.getConfiguration('awesomeProjects');
        _configurationLoaded = true;
    }
    return _cachedConfiguration;
}

export async function scanForGitProjects(startPath: string): Promise<string[]> {
    const gitProjects: string[] = [];

    async function scan(dir: string, depth: number = 0) {
        if (depth > 5) {
            return;
        } // Limit recursion depth

        try {
            const files = await fs.promises.readdir(dir);

            // Check if current directory is a git repo
            if (files.includes('.git')) {
                gitProjects.push(dir);
                return; // Don't scan deeper if we found a git repo
            }

            // Scan subdirectories with parallel stat operations
            const statPromises = files.map(async (file) => {
                const filePath = path.join(dir, file);
                try {
                    const stat = await fs.promises.stat(filePath);
                    return { file, filePath, stat, isValid: stat.isDirectory() && !file.startsWith('.') };
                } catch (err) {
                    console.log(`Error accessing ${filePath}:`, err);
                    return { file, filePath, stat: null, isValid: false };
                }
            });

            const statResults = await Promise.all(statPromises);

            // Process directories in parallel (but limit concurrency to avoid overwhelming the system)
            const validDirectories = statResults.filter(result => result.isValid);
            const batchSize = 10; // Process max 10 directories at once

            for (let i = 0; i < validDirectories.length; i += batchSize) {
                const batch = validDirectories.slice(i, i + batchSize);
                await Promise.all(batch.map(result => scan(result.filePath, depth + 1)));
            }
        } catch (err) {
            console.log(`Error scanning ${dir}:`, err);
        }
    }

    await scan(startPath);
    return gitProjects;
}

export async function addScannedProjects(projects: string[]): Promise<void> {
    const configuration = getCachedConfiguration();
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

    if (!selectedPaths || selectedPaths.length === 0) { return; }

    // Create new project entries
    const projectsToAdd: Project[] = selectedPaths.map(selection => ({
        id: getProjectId({ path: selection.path, name: selection.label, color: null } as Project),
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

    // Invalidate cache after update
    _configurationLoaded = false;
    _cachedConfiguration = undefined;

    vscode.window.showInformationMessage(`Added ${projectsToAdd.length} new projects`);
}
