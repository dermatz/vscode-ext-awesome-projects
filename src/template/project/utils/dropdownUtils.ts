export const getDropdownToggleScript = (): string => {
    return `
        (function() {
            let activeQuickMenu = null;

            function closeQuickMenu() {
                if (!activeQuickMenu) { return; }
                activeQuickMenu.classList.remove('show');
                const wrapper = activeQuickMenu.closest('.project-settings');
                if (wrapper) { wrapper.classList.remove('menu-open'); }
                activeQuickMenu = null;
            }

            function openQuickMenu(menu) {
                closeQuickMenu();
                menu.classList.add('show');
                const wrapper = menu.closest('.project-settings');
                if (wrapper) { wrapper.classList.add('menu-open'); }
                activeQuickMenu = menu;
            }

            window.toggleQuickMenu = function(event, projectId) {
                event.preventDefault();
                event.stopPropagation();

                const menu = document.getElementById('quick-menu-' + projectId);
                if (!menu) { return; }

                const isSameMenu = activeQuickMenu === menu;
                closeQuickMenu();
                if (!isSameMenu) {
                    openQuickMenu(menu);
                }
            };

            document.addEventListener('click', function(event) {
                const clickedToggle = event.target.closest('.quick-menu-toggle');
                const clickedMenu = event.target.closest('.quick-menu');
                if (!clickedToggle && !clickedMenu) {
                    closeQuickMenu();
                }
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
        })();

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
