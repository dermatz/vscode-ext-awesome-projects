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

function getChangeTypeClass(type: string): string {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('feature')) { return 'type-feature'; }
    if (lowerType.includes('bug') || lowerType.includes('fix')) { return 'type-bugfix'; }
    if (lowerType.includes('refactor')) { return 'type-refactor'; }
    if (lowerType.includes('maintenance') || lowerType.includes('chore')) { return 'type-maintenance'; }
    if (lowerType.includes('documentation') || lowerType.includes('docs')) { return 'type-docs'; }
    return 'type-other';
}

async function getHtmlForPanel(context: vscode.ExtensionContext, webview: vscode.Webview): Promise<string> {
    const packageJson = await readPackageJson(context);
    const versionChanges = getChangesSinceLastTag(context);
    const latestVersion = versionChanges[0]?.version || packageJson.version;

    const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources', 'logo.png'));
    let baseCss = '';
    try {
        baseCss = await loadResourceFile(context, 'dist/css/webview.css');
    } catch {
        baseCss = await loadResourceFile(context, 'src/css/webview.css').catch(() => '');
    }

    const versionSections = versionChanges.map((version, index) => {
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
                    ${typeSections}
                </div>
            </article>
        `;
    }).join('');

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
        <style>
            ${baseCss}

            :root {
                --whats-new-max-width: 720px;
            }

            body.whats-new-page {
                display: flex;
                flex-direction: column;
                align-items: center;
                min-height: 100vh;
                padding: 2rem 1rem 4rem;
                background:
                    radial-gradient(ellipse 120% 60% at 50% -10%, rgba(65, 88, 208, 0.22) 0%, transparent 55%),
                    radial-gradient(ellipse 90% 45% at 85% 0%, rgba(200, 80, 192, 0.12) 0%, transparent 45%),
                    radial-gradient(ellipse 70% 35% at 15% 0%, rgba(255, 204, 112, 0.08) 0%, transparent 40%),
                    var(--vscode-editor-background);
                color: var(--vscode-foreground);
                font-family: var(--vscode-font-family);
                line-height: 1.6;
            }

            .whats-new-container {
                width: 100%;
                max-width: var(--whats-new-max-width);
            }

            .whats-new-hero {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                margin-bottom: 2.5rem;
            }

            .whats-new-logo {
                width: 96px;
                height: 96px;
                margin-bottom: 1.25rem;
                filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.25));
            }

            .whats-new-release-badge {
                display: inline-flex;
                align-items: center;
                gap: 0.4rem;
                padding: 0.35rem 0.9rem;
                border-radius: 999px;
                font-size: 0.7rem;
                font-weight: 800;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: #FFCC70;
                background: rgba(255, 204, 112, 0.1);
                border: 1px solid rgba(255, 204, 112, 0.25);
                box-shadow: 0 2px 8px rgba(255, 204, 112, 0.08);
                margin-bottom: 1rem;
            }

            .whats-new-release-badge svg {
                width: 0.85rem;
                height: 0.85rem;
            }

            .whats-new-title {
                margin: 0 0 0.6rem;
                font-size: 1.75rem;
                font-weight: 800;
                letter-spacing: -0.02em;
                color: var(--vscode-foreground);
            }

            .whats-new-subtitle {
                margin: 0 0 1.5rem;
                font-size: 0.9rem;
                color: var(--vscode-foreground);
                opacity: 0.65;
                max-width: 480px;
            }

            .whats-new-actions {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 0.625rem;
            }

            .whats-new-actions .button {
                padding: 0.55rem 1rem;
                font-size: 0.85rem;
            }

            .whats-new-actions .button.sponsor {
                background: linear-gradient(135deg, #FF6B9D 0%, #C850C0 50%, #FFCC70 100%);
                background-size: 200% 200%;
                color: #ffffff;
                border-color: transparent;
                box-shadow: 0 2px 8px rgba(200, 80, 192, 0.35);
                animation: shimmerGradient 5s ease infinite;
            }

            .whats-new-actions .button.sponsor:hover {
                background: linear-gradient(135deg, #FF8FB0 0%, #D060D0 50%, #FFD98C 100%);
                background-size: 200% 200%;
                box-shadow: 0 5px 16px rgba(200, 80, 192, 0.45);
            }

            .whats-new-intro {
                padding: 1rem 1.25rem;
                margin-bottom: 1.5rem;
                border-radius: var(--border-radius-large);
                background: color-mix(in srgb, var(--vscode-menu-background) 65%, transparent);
                border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 35%, transparent);
                font-size: 0.85rem;
                color: var(--vscode-foreground);
                opacity: 0.9;
            }

            .whats-new-intro a {
                color: var(--vscode-textLink-foreground);
                text-decoration: none;
            }

            .whats-new-intro a:hover {
                text-decoration: underline;
            }

            .whats-new-version {
                margin-bottom: 1rem;
                border-radius: var(--border-radius-large);
                background: color-mix(in srgb, var(--vscode-menu-background) 72%, transparent);
                border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 32%, transparent);
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                overflow: hidden;
                backdrop-filter: blur(8px);
            }

            .whats-new-version-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                padding: 1rem 1.25rem;
                border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 30%, transparent);
                background: color-mix(in srgb, var(--vscode-panel-background) 50%, transparent);
            }

            .whats-new-version-title {
                margin: 0;
                font-size: 1.15rem;
                font-weight: 700;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .whats-new-version-date {
                font-size: 0.8rem;
                font-weight: 500;
                opacity: 0.6;
            }

            .whats-new-latest-badge {
                padding: 0.2rem 0.55rem;
                border-radius: 999px;
                font-size: 0.6rem;
                font-weight: 800;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                color: #4C0519;
                background: var(--gradient-brand);
                box-shadow: 0 2px 6px rgba(200, 80, 192, 0.3);
            }

            .whats-new-version-body {
                padding: 1rem 1.25rem;
            }

            .whats-new-type {
                margin-bottom: 1.25rem;
            }

            .whats-new-type:last-child {
                margin-bottom: 0;
            }

            .whats-new-type-title {
                display: flex;
                align-items: center;
                gap: 0.4rem;
                margin: 0 0 0.5rem;
                font-size: 0.7rem;
                font-weight: 800;
                letter-spacing: 0.06em;
                text-transform: uppercase;
            }

            .whats-new-type-title svg {
                width: 1rem;
                height: 1rem;
            }

            .type-feature .whats-new-type-title { color: #10B981; }
            .type-bugfix .whats-new-type-title { color: #F87171; }
            .type-refactor .whats-new-type-title { color: #60A5FA; }
            .type-maintenance .whats-new-type-title { color: #A78BFA; }
            .type-docs .whats-new-type-title { color: #FBBF24; }
            .type-other .whats-new-type-title { color: var(--vscode-foreground); opacity: 0.8; }

            .whats-new-list {
                margin: 0;
                padding-left: 1.25rem;
                font-size: 0.85rem;
            }

            .whats-new-list li {
                margin-bottom: 0.35rem;
                line-height: 1.5;
            }

            .whats-new-list li:last-child {
                margin-bottom: 0;
            }

            .whats-new-list a {
                color: var(--vscode-textLink-foreground);
                text-decoration: none;
                font-weight: 500;
            }

            .whats-new-list a:hover {
                text-decoration: underline;
            }

            .whats-new-list code {
                padding: 0.1rem 0.3rem;
                border-radius: 3px;
                background: var(--vscode-textCodeBlock-background);
                font-family: var(--vscode-editor-font-family);
                font-size: 0.78rem;
            }

            .whats-new-footer {
                display: flex;
                justify-content: center;
                margin-top: 2rem;
                padding-top: 1.5rem;
                border-top: 1px solid color-mix(in srgb, var(--vscode-panel-border) 30%, transparent);
            }

            .whats-new-footer-actions {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 0.75rem;
            }

            .whats-new-footer-actions .support-link {
                display: inline-flex;
                align-items: center;
                gap: 0.4rem;
                padding: 0.45rem 0.75rem;
                border-radius: var(--border-radius);
                font-size: 0.8rem;
                color: var(--vscode-foreground);
                text-decoration: none;
                background: color-mix(in srgb, var(--vscode-button-secondaryBackground) 70%, transparent);
                border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 45%, transparent);
                transition: all var(--transition-fast);
            }

            .whats-new-footer-actions .support-link:hover {
                background: var(--vscode-button-secondaryHoverBackground);
                transform: translateY(-1px);
            }

            .whats-new-footer-actions .support-link svg {
                width: 1rem;
                height: 1rem;
            }

            @media screen and (max-width: 480px) {
                body.whats-new-page {
                    padding: 1.25rem 0.75rem 3rem;
                }

                .whats-new-title {
                    font-size: 1.4rem;
                }

                .whats-new-version-header {
                    padding: 0.875rem 1rem;
                }

                .whats-new-version-body {
                    padding: 0.875rem 1rem;
                }
            }
        </style>
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
                    <a class="button" href="${marketplaceUrl}" target="_blank">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 17.75l-6.172 -3.245l1.179 -6.873l5.993 -2.573l5.993 2.573l1.179 6.873z"/></svg>
                        Rate on Marketplace
                    </a>
                    <a class="button sponsor" href="https://github.com/sponsors/dermatz" target="_blank">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19.5 13.572l-7.5 7.428l-7.5 -7.428m0 0a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/></svg>
                        Sponsor this Project
                    </a>
                    <a class="button secondary" href="${changelogUrl}" target="_blank">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/><path d="M9 3h6a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v0a2 2 0 0 1 2 -2z"/><path d="M9 12l2 2l4 -4"/></svg>
                        Full Changelog
                    </a>
                    <a class="button secondary" href="${repoUrl}" target="_blank">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5"/></svg>
                        GitHub
                    </a>
                </div>
            </div>

            <div class="whats-new-intro">
                All changes to ${packageJson.displayName} are documented here. If you have questions, feature requests or problems with this extension, please create an <a href="${issuesUrl}" target="_blank">issue on GitHub</a>.
            </div>

            ${versionSections}

            <footer class="whats-new-footer">
                <div class="whats-new-footer-actions">
                    <a class="support-link" href="https://github.com/sponsors/dermatz" target="_blank">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19.5 13.572l-7.5 7.428l-7.5 -7.428m0 0a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/></svg>
                        Support this Project
                    </a>
                    <a class="support-link" href="${issuesUrl}" target="_blank">
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
