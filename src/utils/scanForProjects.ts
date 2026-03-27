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

export interface ScannedProject {
    path: string;
    /** Relative path from the scan root to the project's parent folder.
     * Empty string means the project is directly inside the scan root. */
    group: string;
}

export async function scanForGitProjects(startPath: string): Promise<ScannedProject[]> {
    const gitProjects: ScannedProject[] = [];

    async function scan(dir: string, depth: number = 0) {
        if (depth > 5) {
            return;
        } // Limit recursion depth

        try {
            const files = await fs.promises.readdir(dir);

            // Check if current directory is a git repo
            if (files.includes('.git')) {
                const parentRelative = path.relative(startPath, path.dirname(dir));
                // Normalise to forward slashes for cross-platform consistency
                const group = parentRelative.split(path.sep).join('/');
                gitProjects.push({ path: dir, group });
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

export async function addScannedProjects(scannedProjects: ScannedProject[]): Promise<void> {
    const configuration = getCachedConfiguration();
    const existingProjects: Project[] = configuration.get('projects') || [];

    // Filter out already existing projects (by exact path or by same name in same group)
    const newProjects = scannedProjects.filter(sp => {
        if (existingProjects.some(p => p.path === sp.path)) {
            return false; // exact path duplicate
        }
        const spName = (sp.path.split('/').pop() || sp.path).toLowerCase();
        const spGroup = sp.group || '';
        if (existingProjects.some(p => p.name.toLowerCase() === spName && (p.group || '') === spGroup)) {
            return false; // same name in same group
        }
        return true;
    });

    if (newProjects.length === 0) {
        vscode.window.showInformationMessage('No new projects found');
        return;
    }

    // Mark entries whose name already exists in a different location/group
    const quickPickItems = newProjects.map(sp => {
        const label = sp.path.split('/').pop() || sp.path;
        const spName = label.toLowerCase();
        const nameExistsElsewhere = existingProjects.some(
            p => p.name.toLowerCase() === spName
        );
        return {
            label: nameExistsElsewhere ? `$(warning) ${label}` : label,
            description: sp.group ? `${sp.group}  ·  ${sp.path}` : sp.path,
            detail: nameExistsElsewhere ? 'A project with this name already exists at a different path' : undefined,
            scanned: sp
        };
    });

    // Let user select which projects to add
    const selectedPaths = await vscode.window.showQuickPick(
        quickPickItems,
        {
            canPickMany: true,
            placeHolder: 'Select projects to add'
        }
    );

    if (!selectedPaths || selectedPaths.length === 0) { return; }

    // Create new project entries (strip any warning icon prefix from the label)
    const projectsToAdd: Project[] = selectedPaths.map(selection => {
        const cleanName = selection.label.replace(/^\$\(warning\) /, '');
        return {
            id: getProjectId({ path: selection.scanned.path, name: cleanName, color: null } as Project),
            name: cleanName,
            path: selection.scanned.path,
            color: null,
            group: selection.scanned.group || undefined
        };
    });

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
