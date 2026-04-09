export const getDropdownToggleScript = (): string => {
    return `
        function closeAllQuickMenus() {
            document.querySelectorAll('.quick-menu.show').forEach(m => {
                m.classList.remove('show');
                const wrapper = m.closest('.project-settings');
                if (wrapper) { wrapper.classList.remove('menu-open'); }
            });
        }

        function toggleQuickMenu(event, projectId) {
            event.stopPropagation();
            const menu = document.getElementById('quick-menu-' + projectId);
            if (!menu) { return; }
            const isOpen = menu.classList.contains('show');
            closeAllQuickMenus();
            if (!isOpen) {
                menu.classList.add('show');
                const settings = menu.closest('.project-settings');
                if (settings) { settings.classList.add('menu-open'); }
            }
        }

        document.addEventListener('click', function(event) {
            closeAllQuickMenus();
            if (!event.target.closest('.project-info-dropdown') && !event.target.closest('.project-item')) {
                document.querySelectorAll('.project-info-dropdown.show').forEach(function(el) {
                    el.classList.remove('show');
                    const projectId = el.id.replace('info-', '');
                    const wrapper = document.querySelector('[data-project-id="' + projectId + '"]');
                    if (wrapper) {
                        const item = wrapper.querySelector('.project-item');
                        if (item) { item.classList.remove('active'); }
                    }
                });
            }
        });

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
