export function getSaveFunctionsScript(): string {
    return `
        function updateSaveButtonState(projectPath, projectId) {
            const saveButton = document.getElementById('save-' + projectId);
            if (saveButton) {
                const hasChanges = pendingChanges[projectPath] && Object.keys(pendingChanges[projectPath]).length > 0;
                saveButton.classList.toggle('show', hasChanges);
                saveButton.disabled = !hasChanges;
            }
        }

        function showSaveButton(projectPath, projectId) {
            const saveButton = document.getElementById('save-' + projectId);
            if (saveButton) {
                saveButton.classList.add('show');
            }
        }
    `;
}
