export const getDropdownToggleScript = (): string => {
    return `
        function toggleDropdown(event, targetId, type) {
            if (type === 'info' && event.target.closest('.project-settings')) {
                return;
            }

            event.stopPropagation();

            const projectWrapper = document.querySelector('[data-project-id="' + targetId + '"]');
            const projectItem = projectWrapper ? projectWrapper.querySelector('.project-item') : null;

            // Get the target dropdown and its state
            const targetDropdown = type === 'settings'
                ? document.querySelector('[data-settings-id="' + targetId + '"]')
                : document.getElementById('info-' + targetId);
            const isTargetOpen = targetDropdown?.classList.contains('show');

            // Close ALL dropdowns first (both types)
            document.querySelectorAll('.settings-dropdown.show, .project-info-dropdown.show').forEach(el => {
                el.classList.remove('show');
                const dropdownProjectId = el.classList.contains('settings-dropdown')
                    ? el.getAttribute('data-settings-id')
                    : el.id.replace('info-', '');

                const relatedWrapper = document.querySelector('[data-project-id="' + dropdownProjectId + '"]');
                if (relatedWrapper) {
                    const relatedItem = relatedWrapper.querySelector('.project-item');
                    if (relatedItem) {
                        relatedItem.classList.remove('active');
                    }
                }
            });

            // Only open the target dropdown if it wasn't already open
            if (!isTargetOpen && targetDropdown && projectItem) {
                targetDropdown.classList.add('show');
                projectItem.classList.add('active');
            }
        }
    `;
};
