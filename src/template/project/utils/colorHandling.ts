export function getColorHandlingScript(): string {
    return `
        function generateGradient(baseColor) {
            const hex = baseColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);

            const darkerR = Math.max(0, r - 40);
            const darkerG = Math.max(0, g - 40);
            const darkerB = Math.max(0, b - 40);

            return '#' +
                darkerR.toString(16).padStart(2, '0') +
                darkerG.toString(16).padStart(2, '0') +
                darkerB.toString(16).padStart(2, '0');
        }

        function getContrastColor(hexcolor) {
            const r = parseInt(hexcolor.slice(1,3),16);
            const g = parseInt(hexcolor.slice(3,5),16);
            const b = parseInt(hexcolor.slice(5,7),16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness > 128 ? '#000000' : '#ffffff';
        }

        function setRandomColor(event, projectPath) {
            event.preventDefault();
            event.stopPropagation();

            const button = event.target.closest('.random-color');
            const colorInput = button.closest('.color-container').querySelector('input[type="color"]');
            const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            colorInput.value = randomColor;

            const projectItem = button.closest('.project-item-wrapper').querySelector('.project-item');
            const gradientColor = generateGradient(randomColor);
            const textColor = getContrastColor(randomColor);

            projectItem.style.setProperty('--bg-color', randomColor);
            projectItem.style.setProperty('--bg-gradient', gradientColor);
            projectItem.querySelector('.project-name').style.color = textColor;

            if (!pendingChanges[projectPath]) {
                pendingChanges[projectPath] = {};
            }
            pendingChanges[projectPath]['color'] = randomColor;

            const saveButton = document.getElementById('save-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-'));
            if (saveButton) {
                saveButton.classList.add('show');
            }
        }

        function handleColorChange(event, projectPath) {
            const value = event.target.value;
            const projectItem = event.target.closest('.project-item-wrapper').querySelector('.project-item');
            const textColor = getContrastColor(value);

            projectItem.style.setProperty('--bg-color', value);
            projectItem.style.setProperty('--bg-gradient', generateGradient(value));
            projectItem.querySelector('.project-name').style.color = textColor;

            if (!pendingChanges[projectPath]) {
                pendingChanges[projectPath] = {};
            }
            pendingChanges[projectPath]['color'] = value;

            const saveButton = document.getElementById('save-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-'));
            if (saveButton) {
                saveButton.classList.add('show');
            }
        }
    `;
}
