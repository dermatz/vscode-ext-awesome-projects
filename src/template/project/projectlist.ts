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
             * Toggles the project info dropdown.
             * @param {MouseEvent} event The click event.
             * @param {string} targetId The ID of the project to toggle.
             * @returns {void}
             * */

            function toggleSettings(event, targetId) {
                event.stopPropagation();

                const dropdown = document.querySelector('[data-settings-id="' + targetId + '"]');
                const projectWrapper = document.querySelector('[data-project-id="' + targetId + '"]');
                const projectItem = projectWrapper ? projectWrapper.querySelector('.project-item') : null;

                // Close all other dropdowns first
                document.querySelectorAll('.settings-dropdown.show, .project-info-dropdown.show').forEach(el => {
                    const isSettings = el.classList.contains('settings-dropdown');
                    const currentId = isSettings ? el.getAttribute('data-settings-id') : el.id;

                    if (currentId !== targetId) {
                        el.classList.remove('show');
                        const relatedWrapper = document.querySelector('[data-project-id="' + (isSettings ? el.getAttribute('data-settings-id') : el.id) + '"]');
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



