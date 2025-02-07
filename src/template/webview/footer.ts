import * as vscode from "vscode";
import { getChangesSinceLastTag } from "../../utils/changelogParser";

/**
 * Returns footer HTML for the webview.
 * @param context Includes all relevant elements for the project webview header.
 */

export async function getFooterHtml(context: vscode.ExtensionContext): Promise<string> {
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
    `).join('<hr>') + `
    <div class="changelog-link">
        <a id="changloglink" href="https://github.com/dermatz/vscode-ext-awesome-projects/blob/main/CHANGELOG.md" target="_blank">
            View full changelog on GitHub
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.5 2H2.5C1.67157 2 1 2.67157 1 3.5V13.5C1 14.3284 1.67157 15 2.5 15H12.5C13.3284 15 14 14.3284 14 13.5V7.5M14 1H10M14 1V5M14 1L7 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </a>
    </div>`;

    return `
      <footer>
      <section>
        <div class="support-box">
        <a href="https://github.com/dermatz/vscode-ext-awesome-projects/issues/new/choose" class="support-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path
              d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" />
          </svg>
          Report Issues & Feature requests
        </a>
        <a href="https://github.com/sponsors/dermatz" class="support-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M13 19l-1 1l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 0 1 8.785 4.444" />
            <path d="M21 15h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5" />
            <path d="M19 21v1m0 -8v1" />
          </svg>
          Support this Project
        </a>
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
          ${changesHtml}
          </div>
        </div>
        </div>
      </section>
      </footer>
      <script>
      const dropdown = document.querySelector('.whats-new-dropdown');
      const content = document.querySelector('.whats-new-content');
      const button = document.querySelector('.whats-new-button');
      const closeButton = document.querySelector('.whats-new-close');
      const changelogLink = document.getElementById('changloglink');

      // Toggle dropdown on button click
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
      });

      // Close dropdown when clicking close button
      closeButton.addEventListener('click', () => {
        content.style.display = 'none';
      });

      // Close dropdown when clicking outside, except changelog link
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== changelogLink) {
        content.style.display = 'none';
        }
      });

      // Prevent dropdown from closing when clicking inside content
      content.addEventListener('click', (e) => {
        if (e.target !== changelogLink) {
          e.stopPropagation();
        }
      });
      </script>
    `;
}
