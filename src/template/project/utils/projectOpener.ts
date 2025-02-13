import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

function sanitizePath(inputPath: string): string {
    return inputPath.replace(/[;&|`$()]/g, '');
}

function normalizePath(inputPath: string): string {
    try {
        const sanitizedPath = sanitizePath(inputPath);
        if (process.platform === 'win32') {
            let normalizedPath = sanitizedPath;
            // Handle double backslashes from settings.json
            normalizedPath = normalizedPath.replace(/\\\\/g, '\\');
            // Ensure single forward slashes are converted
            normalizedPath = normalizedPath.replace(/\//g, '\\');
            // Correct Windows drive paths (e.g., "e:sample" to "e:\sample")
            if (normalizedPath.match(/^[a-zA-Z]:(?![\\])/)) {
                normalizedPath = normalizedPath.replace(/^([a-zA-Z]:)/, '$1\\');
            }
            return normalizedPath;
        }
        return path.normalize(sanitizedPath);
    } catch (error) {
        console.error('Path normalization error:', error);
        throw error;
    }
}

async function validatePath(inputPath: string): Promise<void> {
    try {
        const stats = await fs.promises.stat(inputPath);
        if (!stats.isDirectory() && !stats.isFile()) {
            throw new Error('Path is neither a file nor a directory');
        }
    } catch (error) {
        console.error('Path validation error:', error);
        throw new Error(`Invalid path specified: ${inputPath}`);
    }
}

export async function openProjectInNewWindow(projectPath: string): Promise<void> {
    try {
        const normalizedPath = normalizePath(projectPath);
        await validatePath(normalizedPath);
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(normalizedPath));
    } catch (error) {
        console.error('Error opening project:', error);
        vscode.window.showErrorMessage(`Failed to open project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function openUrl(url: string): Promise<void> {
    await vscode.env.openExternal(vscode.Uri.parse(url));
}
