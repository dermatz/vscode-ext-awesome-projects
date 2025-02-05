import * as vscode from "vscode";

/**
 * Returns footer HTML for the webview.
 * @param context Includes all structured elements to render the project list.
 */

export async function getProjectListHtml(context: vscode.ExtensionContext): Promise<string> {
    return `

       *** Move Project List in projectlist.ts ***

       <script>
            /**
             * Toggles any dropdown (settings or info) for a project
             * @param {MouseEvent} event The click event
             * @param {string} targetId The ID of the project
             * @param {string} type The type of dropdown ('settings' or 'info')
             */
            function toggleDropdown(event, targetId, type) {
                if (type === 'info' && event.target.closest('.project-settings')) {
                    return;
                }

                event.stopPropagation();

                const projectWrapper = document.querySelector('[data-project-id="' + targetId + '"]');
                const projectItem = projectWrapper ? projectWrapper.querySelector('.project-item') : null;
                const dropdown = type === 'settings'
                    ? document.querySelector('[data-settings-id="' + targetId + '"]')
                    : document.getElementById('info-' + targetId);

                // Close all other dropdowns first
                document.querySelectorAll('.settings-dropdown.show, .project-info-dropdown.show').forEach(el => {
                    const isSettings = el.classList.contains('settings-dropdown');
                    const currentId = isSettings
                        ? el.getAttribute('data-settings-id')
                        : el.id.replace('info-', '');

                    if (currentId !== targetId) {
                        el.classList.remove('show');
                        const relatedWrapper = document.querySelector('[data-project-id="' + currentId + '"]');
                        if (relatedWrapper) {
                            const relatedItem = relatedWrapper.querySelector('.project-item');
                            if (relatedItem) {
                                relatedItem.classList.remove('active');
                            }
                        }
                    }
                });

                if (dropdown && projectItem) {
                    dropdown.classList.toggle('show');
                    projectItem.classList.toggle('active');
                }
            }
       </script>
    `;
}



