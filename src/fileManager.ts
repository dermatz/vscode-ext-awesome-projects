import * as vscode from 'vscode';
import { spawn, SpawnOptions } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

function sanitizePath(inputPath: string): string {
    return inputPath.replace(/[;&|`$()]/g, '');
}

export function showInFileManager(filePath: string) {
    if (!filePath) {
        vscode.window.showErrorMessage('No file path provided');
        return;
    }

    const sanitizedPath = sanitizePath(filePath);

    try {
        validatePath(sanitizedPath);
        openInFileManager(sanitizedPath);
    } catch (error) {
        handleError(error);
    }
}

function validatePath(path: string): void {
    const stats = fs.statSync(path);
    if (!stats.isDirectory() && !stats.isFile()) {
        throw new Error('Invalid path');
    }
}

function openInFileManager(sanitizedPath: string): void {
    const platform = process.platform;
    const options: SpawnOptions = { stdio: 'inherit', shell: false };

    switch (platform) {
        case 'linux':
            if (sanitizedPath.startsWith('/mnt/')) {
                const windowsPath = convertWslPath(sanitizedPath);
                spawn('explorer.exe', [windowsPath], options);
            } else {
                spawn('xdg-open', [path.dirname(sanitizedPath)], options);
            }
            break;
        case 'win32':
            spawn('explorer.exe', [sanitizedPath.replace(/\//g, '\\')], options);
            break;
        case 'darwin':
            spawn('open', ['-R', sanitizedPath], options);
            break;
    }
}

function convertWslPath(wslPath: string): string {
    const driveLetter = wslPath.charAt(5).toUpperCase();
    return `${driveLetter}:${wslPath.slice(6).replace(/\//g, '\\')}`;
}

function handleError(error: unknown): void {
    console.error('Error showing file in file manager:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to open file manager: ${message}`);
}
