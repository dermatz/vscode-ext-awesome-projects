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

    try {
        // Sanitize and normalize the path
        const sanitizedPath = sanitizePath(filePath);
        const normalizedPath = path.normalize(sanitizedPath);

        // Validate the path exists
        const stats = await fs.stat(normalizedPath);
        if (!stats.isDirectory() && !stats.isFile()) {
            throw new Error('Invalid path');
        }

        const platform = process.platform;

        switch (platform) {
            case 'win32':
                await openInWindows(normalizedPath);
                break;
            case 'darwin':
                await openInMacOS(normalizedPath);
                break;
            case 'linux':
                if (normalizedPath.startsWith('/mnt/')) {
                    await openInWSL(normalizedPath);
                } else {
                    await openInLinux(normalizedPath);
                }
                break;
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    } catch (error) {
        handleError(error);
    }
}
