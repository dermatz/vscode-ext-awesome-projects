import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Sanitizes the input path by removing potentially dangerous characters.
 * @param {string} inputPath - The input path to sanitize.
 * @returns {string} - The sanitized path.
 */
export function sanitizePath(inputPath: string): string {
    return inputPath.replace(/[;&|`$()]/g, '');
}

/**
 * Opens the file manager in WSL environment.
 * @param {string} sanitizedPath - The sanitized file path.
 */
async function openInWSL(sanitizedPath: string): Promise<void> {
    const driveLetter = sanitizedPath.charAt(5).toUpperCase();
    const windowsPath = `${driveLetter}:${sanitizedPath.slice(6).replace(/\//g, '\\')}`;
    await childProcess.spawn('explorer.exe', [windowsPath], {
        stdio: 'ignore',
        shell: false
    });
}

/**
 * Opens the file manager in Windows environment.
 * @param {string} sanitizedPath - The sanitized file path.
 */
async function openInWindows(sanitizedPath: string): Promise<void> {
    const normalizedPath = sanitizedPath.replace(/\//g, '\\');
    await childProcess.spawn('explorer.exe', [normalizedPath], {
        stdio: 'ignore',
        shell: false
    });
}

/**
 * Opens the file manager in macOS environment.
 * @param {string} sanitizedPath - The sanitized file path.
 */
async function openInMacOS(sanitizedPath: string): Promise<void> {
    await childProcess.spawn('open', ['-R', sanitizedPath], {
        stdio: 'ignore',
        shell: false
    });
}

/**
 * Opens the file manager in Linux environment.
 * @param {string} sanitizedPath - The sanitized file path.
 */
async function openInLinux(sanitizedPath: string): Promise<void> {
    await childProcess.spawn('xdg-open', [path.dirname(sanitizedPath)], {
        stdio: 'ignore',
        shell: false
    });
}

/**
 * Handles errors by logging them and showing an error message in VSCode.
 * @param {unknown} error - The error to handle.
 */
function handleError(error: unknown) {
    console.error('Error showing file in file manager:', error);
    if (error instanceof Error) {
        vscode.window.showErrorMessage(`Failed to open file manager: ${error.message}`);
    }
}

/**
 * Shows the file in the file manager based on the platform.
 * @param {string} filePath - The file path to show in the file manager.
 */
export async function showInFileManager(filePath: string): Promise<void> {
    if (!filePath) {
        vscode.window.showErrorMessage('No file path provided');
        return;
    }

    // Sanitize the file path
    const sanitizedPath = sanitizePath(filePath);

    // Validate the path exists
    try {
        const stats = await fs.stat(sanitizedPath);
        if (!stats.isDirectory() && !stats.isFile()) {
            throw new Error('Invalid path');
        }
    } catch (error) {
        vscode.window.showErrorMessage('Invalid path specified');
        return;
    }

    const platform = process.platform;

    try {
        if (platform === 'linux' && sanitizedPath.startsWith('/mnt/')) {
            await openInWSL(sanitizedPath);
        } else if (platform === 'win32') {
            await openInWindows(sanitizedPath);
        } else if (platform === 'darwin') {
            await openInMacOS(sanitizedPath);
        } else {
            await openInLinux(sanitizedPath);
        }
    } catch (error) {
        handleError(error);
    }
}
