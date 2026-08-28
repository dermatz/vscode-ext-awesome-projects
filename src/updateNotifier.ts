import * as vscode from 'vscode';
import { showWhatsNewPanel } from './whatsNewPanel';

export async function showUpdateNotification(context: vscode.ExtensionContext) {
    const extension = vscode.extensions.getExtension('MathiasElle.awesome-projects');
    if (!extension) {
        return;
    }

    const currentVersion = extension.packageJSON.version;
    const lastVersion = context.globalState.get<string>('lastVersion');

    if (lastVersion !== currentVersion) {
        await showWhatsNewPanel(context);

        const action = await vscode.window.showInformationMessage(
            `Awesome Projects was updated to Version ${currentVersion} ✨!`,
            '❤️ Support this Project',
            'Full Changelog',
            'GitHub'
        );

        if (action === 'GitHub') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/dermatz/vscode-ext-awesome-projects'));
        } else if (action === 'Full Changelog') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/dermatz/vscode-ext-awesome-projects/blob/main/CHANGELOG.md'));
        } else if (action === '❤️ Support this Project') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/dermatz'));
        }

        await context.globalState.update('lastVersion', currentVersion);
    }
}
