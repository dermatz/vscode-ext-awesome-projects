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

        function updateSaveButtonState(projectPath, projectId) {
            const saveButton = document.getElementById('save-' + projectId);
            if (saveButton) {
                // Check if there are any changes
                const hasChanges = pendingChanges[projectPath] && Object.keys(pendingChanges[projectPath]).length > 0;
                saveButton.classList.toggle('show', hasChanges);
                saveButton.disabled = !hasChanges;
            }
        }

        function saveChanges(projectPath, projectId) {
            if (pendingChanges[projectPath]) {
                vscode.postMessage({
                    command: 'updateProject',
                    projectPath: projectPath,
                    projectId: projectId,
                    updates: pendingChanges[projectPath]
                });

                const settingsElement = document.getElementById('settings-' + projectId);

                if (settingsElement) {
                    Object.entries(pendingChanges[projectPath]).forEach(([field, value]) => {
                        const inputs = settingsElement.querySelectorAll('input');
                        inputs.forEach(input => {
                            const inputLabel = input.closest('.settings-item')?.querySelector('label')?.textContent.replace(':', '').trim();
                            const mappedField = Object.entries(labelMap).find(([key, val]) => val === field)?.[0];
                            if (inputLabel === mappedField) {
                                input.defaultValue = value ?? '';
                            }
                        });
                    });
                }

                delete pendingChanges[projectPath];
                updateSaveButtonState(projectPath, projectId);
            }
        }
    `;
}
