import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { getChangesSinceLastTag } from './utils/changelogParser';
import { loadResourceFile } from './template/utils/resourceLoader';

interface PackageJson {
    version: string;
    displayName: string;
    publisher: string;
    name: string;
}

let cachedPanel: vscode.WebviewPanel | undefined;

async function readPackageJson(context: vscode.ExtensionContext): Promise<PackageJson> {
    const packageJsonPath = path.join(context.extensionPath, 'package.json');
    try {
        const data = await fsPromises.readFile(packageJsonPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading package.json:', error);
        return { version: 'unknown', displayName: 'Awesome Projects', publisher: 'MathiasElle', name: 'awesome-projects' };
    }
}

function getChangeTypeIcon(type: string): string {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('feature')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3l-4 7h8z"/><path d="M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M10 13.5v2.5"/><path d="M6 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/></svg>`;
    }
    if (lowerType.includes('bug') || lowerType.includes('fix')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 9v-1a3 3 0 0 1 6 0v1"/><path d="M8 9h8a6 6 0 0 1 1 3v3a5 5 0 0 1 -10 0v-3a6 6 0 0 1 1 -3"/><path d="M3 13l2.5 0"/><path d="M18.5 13l2.5 0"/><path d="M12 13v2.5"/><path d="M3 3l18 18"/></svg>`;
    }
    if (lowerType.includes('refactor')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>`;
    }
    if (lowerType.includes('maintenance') || lowerType.includes('chore')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/></svg>`;
    }
    if (lowerType.includes('documentation') || lowerType.includes('docs')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M9 9h1"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 8v8"/><path d="M12 12h6"/><path d="M12 12h-6"/></svg>`;
}

function getTimeTrackingHighlightHtml(): string {
    return `
        <div class="whats-new-highlight time-tracking-highlight">
            <div class="highlight-glow"></div>
            <div class="highlight-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 7v5l3 3"/>
                    <path d="M15 21h6v-6"/>
                    <path d="M15 17l2-2 1 1 2-2"/>
                </svg>
            </div>
            <div class="highlight-content">
                <span class="highlight-badge">New</span>
                <h4 class="highlight-title">Time Tracking is here</h4>
                <p class="highlight-description">
                    Track time per project, generate weekly reports, export CSV, and continue sessions with one click.
                </p>
                <ul class="highlight-features">
                    <li>Start / stop timers directly from each project</li>
                    <li>Detailed report with filtering and grouping</li>
                    <li>Auto-detect Git branches per session</li>
                    <li>Export your data as CSV</li>
                </ul>
            </div>
        </div>
    `;
}

function getChangeTypeClass(type: string): string {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('feature')) { return 'type-feature'; }
    if (lowerType.includes('bug') || lowerType.includes('fix')) { return 'type-bugfix'; }
    if (lowerType.includes('refactor')) { return 'type-refactor'; }
    if (lowerType.includes('maintenance') || lowerType.includes('chore')) { return 'type-maintenance'; }
    if (lowerType.includes('documentation') || lowerType.includes('docs')) { return 'type-docs'; }
    return 'type-other';
}

interface VersionChange {
    version: string;
    date?: string;
    changes: { [type: string]: string[] };
}

async function loadPanelCss(context: vscode.ExtensionContext, fileName: string): Promise<string> {
    try {
        return await loadResourceFile(context, `dist/css/${fileName}`);
    } catch {
        return await loadResourceFile(context, `src/css/${fileName}`).catch(() => '');
    }
}

function renderVersionSections(versionChanges: VersionChange[]): string {
    return versionChanges.map((version, index) => {
        const isLatest = index === 0;
        const typeSections = Object.entries(version.changes).map(([type, changes]) => `
            <div class="whats-new-type ${getChangeTypeClass(type)}">
                <h4 class="whats-new-type-title">
                    ${getChangeTypeIcon(type)}
                    ${type}
                </h4>
                <ul class="whats-new-list">
                    ${changes.map(change => `<li>${change}</li>`).join('')}
                </ul>
            </div>
        `).join('');

        const timeTrackingHighlight = isLatest && version.version === '0.31.0'
            ? getTimeTrackingHighlightHtml()
            : '';

        return `
            <article class="whats-new-version">
                <div class="whats-new-version-header">
                    <h3 class="whats-new-version-title">
                        ${version.version}
                        ${version.date ? `<span class="whats-new-version-date">(${version.date})</span>` : ''}
                    </h3>
                    ${isLatest ? '<span class="whats-new-latest-badge">Latest</span>' : ''}
                </div>
                <div class="whats-new-version-body">
                    ${timeTrackingHighlight}
                    ${typeSections}
                </div>
            </article>
        `;
    }).join('');
}

async function getHtmlForPanel(context: vscode.ExtensionContext, webview: vscode.Webview): Promise<string> {
    const packageJson = await readPackageJson(context);
    const versionChanges = getChangesSinceLastTag(context);
    const latestVersion = versionChanges[0]?.version || packageJson.version;

    const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources', 'logo.png'));
    const [baseCss, whatsNewCss] = await Promise.all([
        loadPanelCss(context, 'webview.css'),
        loadPanelCss(context, 'whatsNew.css')
    ]);

    const marketplaceUrl = `https://marketplace.visualstudio.com/items?itemName=${packageJson.publisher}.${packageJson.name}`;
    const changelogUrl = `https://github.com/dermatz/vscode-ext-awesome-projects/blob/main/CHANGELOG.md`;
    const repoUrl = 'https://github.com/dermatz/vscode-ext-awesome-projects';
    const issuesUrl = 'https://github.com/dermatz/vscode-ext-awesome-projects/issues/new/choose';

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>What's New in ${packageJson.displayName}</title>
        <style>${baseCss}</style>
        <style>${whatsNewCss}</style>
    </head>
    <body class="whats-new-page">
        <main class="whats-new-container">
            <div class="whats-new-hero">
                <img class="whats-new-logo" src="${logoUri}" alt="${packageJson.displayName} Logo">
                <span class="whats-new-release-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M11 15v2"/><path d="M11 7v2"/><path d="M11 11h2v2h-2z"/></svg>
                    New Extension Release ${latestVersion}
                </span>
                <h1 class="whats-new-title">What's new in ${packageJson.displayName}</h1>
                <p class="whats-new-subtitle">This update is for the VS Code: extension.</p>
                <div class="whats-new-actions">
                    <a class="button" href="${marketplaceUrl}" target="_blank" rel="noopener noreferrer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 17.75l-6.172 -3.245l1.179 -6.873l5.993 -2.573l5.993 2.573l1.179 6.873z"/></svg>
                        Rate on Marketplace
                    </a>
                    <a class="button sponsor" href="https://github.com/sponsors/dermatz" target="_blank" rel="noopener noreferrer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19.5 13.572l-7.5 7.428l-7.5 -7.428m0 0a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/></svg>
                        Sponsor this Project
                    </a>
                    <a class="button secondary" href="${changelogUrl}" target="_blank" rel="noopener noreferrer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/><path d="M9 3h6a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v0a2 2 0 0 1 2 -2z"/><path d="M9 12l2 2l4 -4"/></svg>
                        Full Changelog
                    </a>
                    <a class="button secondary" href="${repoUrl}" target="_blank" rel="noopener noreferrer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5"/></svg>
                        GitHub
                    </a>
                </div>
            </div>

            <div class="whats-new-intro">
                All changes to ${packageJson.displayName} are documented here. If you have questions, feature requests or problems with this extension, please create an <a href="${issuesUrl}" target="_blank" rel="noopener noreferrer">issue on GitHub</a>.
            </div>

            ${renderVersionSections(versionChanges)}

            <footer class="whats-new-footer">
                <div class="whats-new-footer-actions">
                    <a class="support-link" href="https://github.com/sponsors/dermatz" target="_blank" rel="noopener noreferrer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19.5 13.572l-7.5 7.428l-7.5 -7.428m0 0a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/></svg>
                        Support this Project
                    </a>
                    <a class="support-link" href="${issuesUrl}" target="_blank" rel="noopener noreferrer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9.5 11l5 0"/><path d="M9.5 15l3.5 0"/><path d="M9.5 7l5 0"/><path d="M4 20h12a4 4 0 0 0 4 -4v-9a4 4 0 0 0 -4 -4h-6.161a4 4 0 0 0 -3.233 1.64l-1.68 2.282a4 4 0 0 1 -3.233 1.64h-.663a2 2 0 0 0 -2 2v2.143a2 2 0 0 0 2 2z"/></svg>
                        Report an Issue
                    </a>
                </div>
            </footer>
        </main>
    </body>
    </html>`;
}

export async function showWhatsNewPanel(context: vscode.ExtensionContext): Promise<void> {
    const packageJson = await readPackageJson(context);
    const panelTitle = `What's New in ${packageJson.displayName}`;

    if (cachedPanel) {
        cachedPanel.reveal(vscode.ViewColumn.One);
        return;
    }

    const panel = vscode.window.createWebviewPanel(
        'awesomeProjectsWhatsNew',
        panelTitle,
        vscode.ViewColumn.One,
        {
            enableScripts: false,
            localResourceRoots: [context.extensionUri]
        }
    );

    cachedPanel = panel;
    panel.webview.html = await getHtmlForPanel(context, panel.webview);

    panel.onDidDispose(() => {
        cachedPanel = undefined;
    });
}
