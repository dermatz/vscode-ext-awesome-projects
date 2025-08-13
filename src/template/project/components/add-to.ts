import * as vscode from "vscode";

export async function getAddToHtml(): Promise<string> {
    return `
        <div style="display: flex; gap: 1rem; justify-content: space-between; align-items: center; flex-wrap: wrap;">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button class="button" onclick="addProject()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke="none" d="M0 0h24v24H0z"/>
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Add Project
                </button>
                <button class="button secondary" onclick="scanProjects()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke="none" d="M0 0h24v24H0z"/>
                        <path d="M11.5 16H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6.5M7 20h4m-2-4v4m6-2a3 3 0 1 0 6 0 3 3 0 1 0-6 0m5.2 2.2L22 22"/>
                    </svg>
                    Scan for Projects
                </button>
            </div>
            <div>
                <button id="sort-button" class="button secondary" onclick="toggleSort()" title="Projekte sortieren">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M3 6h18M7 12h10m-7 6h4"/>
                    </svg>
                    <span id="sort-direction">A-Z</span>
                </button>
            </div>
        </div>
        <script>
            if (!window.vscodeApi) {
                window.vscodeApi = acquireVsCodeApi();
            }
            // Restore persisted sort state (survives refresh via webview state)
            const __savedState = (typeof window.vscodeApi.getState === 'function' ? (window.vscodeApi.getState() || {}) : {});
            let currentSortOrder = __savedState.currentSortOrder || 'desc'; // 'desc' -> A-Z, 'asc' -> Z-A

            // Ensure button label reflects current state on load
            const __dirLabelEl = document.getElementById('sort-direction');
            if (__dirLabelEl) {
                __dirLabelEl.textContent = currentSortOrder === 'desc' ? 'A-Z' : 'Z-A';
            }

            function addProject() {
                window.vscodeApi.postMessage({
                    command: 'addProject'
                });
            }

            function scanProjects() {
                window.vscodeApi.postMessage({
                    command: 'scanProjects'
                });
            }

            function toggleSort() {
                console.log('toggleSort called');
                const projectsList = document.getElementById('projects-list');
                const projectItems = Array.from(projectsList.querySelectorAll('.project-item-wrapper'));
                const sortButton = document.getElementById('sort-direction');

                // Toggle sort order
                currentSortOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
                console.log('New sort order:', currentSortOrder);

                // Update button text
                sortButton.textContent = currentSortOrder === 'desc' ? 'A-Z' : 'Z-A';

                // Sort project items by name
                projectItems.sort((a, b) => {
                    const nameA = a.querySelector('.project-name').textContent.toLowerCase();
                    const nameB = b.querySelector('.project-name').textContent.toLowerCase();

                    if (currentSortOrder === 'desc') {
                        return nameA.localeCompare(nameB);
                    } else {
                        return nameB.localeCompare(nameA);
                    }
                });

                // Extract project IDs in the new order
                const sortedProjectIds = projectItems.map(item => item.getAttribute('data-project-id'));
                console.log('Sorted project IDs:', sortedProjectIds);

                // Update data-index attributes and reorder in DOM
                projectItems.forEach((item, index) => {
                    item.setAttribute('data-index', index.toString());
                    projectsList.appendChild(item);
                });

                // Send sorted project IDs to backend
                console.log('Sending sortProjects message to backend');
                window.vscodeApi.postMessage({
                    command: 'sortProjects',
                    sortedProjectIds: sortedProjectIds
                });

                // Persist the new sort order so a single click always flips between the actual states after refresh
                if (typeof window.vscodeApi.setState === 'function') {
                    window.vscodeApi.setState({ ...(__savedState || {}), currentSortOrder });
                }
            }
        </script>
    `;
}



