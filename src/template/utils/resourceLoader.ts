import * as vscode from 'vscode';

export const loadResourceFile = async (context: vscode.ExtensionContext, relativePath: string): Promise<string> => {
    const diskPath = vscode.Uri.joinPath(context.extensionUri, relativePath);
    const uint8Array = await vscode.workspace.fs.readFile(diskPath);
    return Buffer.from(uint8Array).toString('utf-8');
};
