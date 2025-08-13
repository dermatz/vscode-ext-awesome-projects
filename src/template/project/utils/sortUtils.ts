/**
 * Get the sort script for project sorting functionality
 */
export function getSortScript(): string {
    return `
        // Restore persisted sort state
        const __savedState = (typeof window.vscode !== 'undefined' && typeof window.vscode.getState === 'function') ? (window.vscode.getState() || {}) : {};
        let currentSortOrder = __savedState.currentSortOrder || 'desc'; // 'desc' for A-Z, 'asc' for Z-A

        function toggleSort() {
            console.log('toggleSort called');
            const projectsList = document.getElementById('projects-list');
            const projectItems = Array.from(projectsList.querySelectorAll('.project-item-wrapper'));
            const sortButton = document.getElementById('sort-direction');

            // Ensure label reflects current state before toggling
            if (sortButton && !sortButton.textContent) {
                sortButton.textContent = currentSortOrder === 'desc' ? 'A-Z' : 'Z-A';
            }

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
            if (typeof window.vscode !== 'undefined') {
                console.log('Sending sortProjects message to backend');
                window.vscode.postMessage({
                    command: 'sortProjects',
                    sortedProjectIds: sortedProjectIds
                });
                // Persist state
                if (typeof window.vscode.setState === 'function') {
                    window.vscode.setState({ ...(__savedState || {}), currentSortOrder });
                }
            } else {
                console.error('vscode API not available');
            }
        }
    `;
}
