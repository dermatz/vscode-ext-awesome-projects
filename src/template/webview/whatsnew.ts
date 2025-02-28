import * as vscode from "vscode";
import { getChangesSinceLastTag } from "../../utils/changelogParser";

export function getWhatsNewHtml(context: vscode.ExtensionContext): string {
    const versionChanges = getChangesSinceLastTag(context);
    const latestVersion = versionChanges[0]?.version || '';

    const changesHtml = versionChanges.map(version => `
        <div class="version-section">
            <h3>Version ${version.version}${version.date ? ` (${version.date})` : ''}</h3>
            ${Object.entries(version.changes).map(([type, changes]) => `
                <div class="change-type">
                    <h4>${type}</h4>
                    <ul>
                        ${changes.map(change => `<li>${change}</li>`).join('\n')}
                    </ul>
                </div>
            `).join('\n')}
        </div>
    `).join('<hr>');

    const html = `
        <div class="whats-new-dropdown">
            <button class="whats-new-button support-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M8 4H6L3 14M16 4h2l3 10M10 16h4M21 16.5a3.5 3.5 0 0 1-7 0V14h7v2.5M10 16.5a3.5 3.5 0 0 1-7 0V14h7v2.5M4 14l4.5 4.5M15 14l4.5 4.5"/>
                </svg>
                What's New in v${latestVersion} ?
            </button>
            <div class="whats-new-content" id="whatsNewContent">
                <button class="whats-new-close" aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
                <div class="content">
                    ${changesHtml}
                </div>
                <div class="changelog-link">
                    <a class="button" id="changeloglink" href="https://github.com/dermatz/vscode-ext-awesome-projects/blob/main/CHANGELOG.md" target="_blank">
                        View full changelog on GitHub
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.5 2H2.5C1.67157 2 1 2.67157 1 3.5V13.5C1 14.3284 1.67157 15 2.5 15H12.5C13.3284 15 14 14.3284 14 13.5V7.5M14 1H10M14 1V5M14 1L7 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </a>
                </div>
            </div>
        </div>
        <script>
            (function() {
                const dropdown = document.querySelector('.whats-new-dropdown');
                const content = document.querySelector('.whats-new-content');
                const button = document.querySelector('.whats-new-button');
                const closeButton = document.querySelector('.whats-new-close');
                const changelogLink = document.getElementById('changeloglink');

                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    content.style.display = content.style.display === 'block' ? 'none' : 'block';
                });

                closeButton.addEventListener('click', () => {
                    content.style.display = 'none';
                });

                document.addEventListener('click', (e) => {
                    if (!dropdown.contains(e.target) && e.target !== changelogLink) {
                        content.style.display = 'none';
                    }
                });

                content.addEventListener('click', (e) => {
                    if (e.target !== changelogLink && !(e.target instanceof HTMLAnchorElement)) {
                        e.stopPropagation();
                    }
                });
            })();
        </script>
    `;

    return html;
}
