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

export async function openProjectInNewWindow(projectPath: string, forceNewWindow: boolean = false): Promise<void> {
    try {
        const normalizedPath = normalizePath(projectPath);
        await validatePath(normalizedPath);
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(normalizedPath), forceNewWindow);
    } catch (error) {
        console.error('Error opening project:', error);
        vscode.window.showErrorMessage(`Failed to open project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function openUrl(url: string): Promise<void> {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            vscode.window.showErrorMessage(`Cannot open URL: only http and https are allowed.`);
            return;
        }
    } catch {
        vscode.window.showErrorMessage(`Cannot open URL: invalid URL.`);
        return;
    }
    await vscode.env.openExternal(vscode.Uri.parse(url));
}

export async function openRemoteProject(remoteUrl: string, forceNewWindow: boolean = false): Promise<void> {
    try {
        // Prefer the Remote Repositories / GitHub Repositories extension workflow.
        // These commands open the repository without cloning it locally.
        // The optional second argument hints whether a new window is desired.
        const remoteCommands = ['remoteHub.openRepository', 'github.openRepository'];
        for (const command of remoteCommands) {
            const available = await vscode.commands.getCommands(true).then(cmds => cmds.includes(command));
            if (available) {
                await vscode.commands.executeCommand(command, remoteUrl, { newWindow: forceNewWindow });
                return;
            }
        }

        // Fallback: try the generic "open remote repository" URI handler.
        // For "Open" we prefer to reuse the current window; for "New Window" we
        // request a new window explicitly.
        const scheme = forceNewWindow ? 'vscode://ms-vscode.remote-repositories/openInNewWindow' : 'vscode://ms-vscode.remote-repositories/open';
        const didOpen = await vscode.env.openExternal(vscode.Uri.parse(`${scheme}?url=${encodeURIComponent(remoteUrl)}`));
        if (!didOpen) {
            throw new Error('No Remote Repositories extension found and the URI handler could not be opened.');
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const openInBrowser = 'Open in Browser';
        const choice = await vscode.window.showErrorMessage(
            `Failed to open remote repository: ${message}`,
            openInBrowser
        );
        if (choice === openInBrowser) {
            await openUrl(remoteUrl);
        }
    }
}
