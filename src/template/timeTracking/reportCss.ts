export function getReportCssHtml(baseCss: string): string {
    return `<style>
        ${baseCss}

            * {
                box-sizing: border-box;
            }

            .time-tracking-report {
                padding: 32px;
                min-height: 100vh;
            }

            .report-page-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 24px;
                margin-bottom: 28px;
                flex-wrap: wrap;
            }

            .report-page-header h1 {
                margin: 0;
                font-size: 1.6rem;
                font-weight: 700;
                letter-spacing: -0.02em;
            }

            .report-header-actions {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-left: auto;
            }

            .report-header-stop {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 600;
            }

            .report-header-stop:hover {
                background: var(--vscode-button-hoverBackground);
            }

            .report-header-stop .live-dot {
                width: 8px;
                height: 8px;
                background: currentColor;
                border-radius: 50%;
                animation: pulse 1.5s infinite;
            }

            .report-period-tabs {
                display: flex;
                gap: 4px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                padding: 4px;
                border-radius: 10px;
            }

            .report-period-tabs button {
                background: transparent;
                border: none;
                color: var(--vscode-foreground);
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 500;
                transition: all 0.15s ease;
            }

            .report-period-tabs button:hover {
                background: var(--vscode-toolbar-hoverBackground);
            }

            .report-period-tabs button.active {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
            }

            .report-custom-range {
                display: flex;
                gap: 10px;
                align-items: center;
                padding: 14px 18px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 12px;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }

            .report-custom-range label {
                font-size: 0.85rem;
                opacity: 0.8;
                font-weight: 500;
            }

            .report-custom-range input {
                background: var(--vscode-editor-background);
                color: var(--vscode-input-foreground);
                border: 2px solid var(--vscode-panel-border);
                border-radius: 8px;
                padding: 10px 14px;
                font-size: 0.9rem;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .report-custom-range input:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-focusBorder) 25%, transparent), inset 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .report-custom-range input.invalid {
                border-color: var(--vscode-errorForeground);
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-errorForeground) 25%, transparent), inset 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .report-custom-range .validation-message {
                color: var(--vscode-errorForeground);
                font-size: 0.85rem;
                width: 100%;
            }

            .report-active-banner {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 14px 18px;
                background: color-mix(in srgb, var(--vscode-button-background) 8%, var(--vscode-editor-inactiveSelectionBackground));
                border-radius: 12px;
                margin-bottom: 24px;
                border: 1px solid color-mix(in srgb, var(--vscode-button-background) 25%, transparent);
                border-left: 4px solid var(--vscode-button-background);
            }

            .report-pagination-notice {
                padding: 12px 16px;
                margin-bottom: 20px;
                background: color-mix(in srgb, var(--vscode-editorWarning-background, var(--vscode-editorWarning-border)) 15%, var(--vscode-editor-inactiveSelectionBackground));
                border: 1px solid var(--vscode-editorWarning-border, var(--vscode-foreground));
                border-radius: 10px;
                color: var(--vscode-editorWarning-foreground, var(--vscode-foreground));
                font-size: 0.9rem;
            }

            .report-active-indicator {
                width: 10px;
                height: 10px;
                background: var(--vscode-button-background);
                border-radius: 50%;
                animation: pulse 1.5s infinite;
                flex-shrink: 0;
            }

            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.4; }
                100% { opacity: 1; }
            }

            .report-active-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
            }

            .report-active-label {
                font-size: 0.7rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                opacity: 0.7;
            }

            .report-active-title {
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .report-active-time {
                font-variant-numeric: tabular-nums;
                font-weight: 700;
                margin-left: auto;
                font-size: 1.1rem;
            }

            .report-summary-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(140px, 1fr));
                gap: 16px;
                margin-bottom: 28px;
            }

            .report-summary-card {
                padding: 20px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .report-summary-label {
                font-size: 0.75rem;
                opacity: 0.65;
                text-transform: uppercase;
                letter-spacing: 0.07em;
                font-weight: 700;
            }

            .report-summary-value {
                font-size: 1.6rem;
                font-weight: 700;
            }

            .report-toolbar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                margin-bottom: 16px;
                flex-wrap: wrap;
            }

            .report-toolbar-group {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .report-toolbar .button {
                padding: 8px 16px;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 600;
                transition: all 0.15s ease;
            }

            .report-toolbar .button:hover {
                transform: translateY(-1px);
            }

            .report-toolbar .button.mini {
                padding: 6px 12px;
            }

            .report-toolbar .button.secondary {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }

            .report-toolbar .button.secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground);
            }

            .report-toolbar .button.danger {
                background: var(--vscode-inputValidation-errorBorder);
                color: #ffffff;
            }

            .report-toolbar .button.danger:hover {
                background: color-mix(in srgb, var(--vscode-inputValidation-errorBorder) 85%, #000);
            }

            .report-toggle {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 500;
                user-select: none;
            }

            .report-toggle input {
                width: 18px;
                height: 18px;
                accent-color: var(--vscode-button-background);
                cursor: pointer;
            }

            .report-grouping-bar {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 16px;
                padding: 10px 14px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 10px;
            }

            .report-grouping-bar label {
                font-size: 0.85rem;
                font-weight: 500;
                opacity: 0.8;
            }

            .report-grouping-bar select {
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 8px;
                padding: 8px 12px;
                font-family: inherit;
                font-size: 0.9rem;
                cursor: pointer;
                min-width: 160px;
            }

            .report-grouping-bar select:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
            }

            .report-branch-groups {
                display: flex;
                flex-direction: column;
                padding-bottom: 20px;
            }

            .report-branch-group {
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 60%, transparent);
                margin-bottom: 24px;
            }

            .report-branch-group:last-child {
                margin-bottom: 0;
            }

            .report-branch-group-header {
                background: color-mix(in srgb, var(--vscode-panel-border) 35%, transparent);
                padding: 14px 18px;
                font-weight: 700;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                user-select: none;
                position: sticky;
                top: 0;
                z-index: 1;
                border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 40%, transparent);
            }

            .report-branch-group-header:hover {
                background: color-mix(in srgb, var(--vscode-panel-border) 50%, transparent);
            }

            .report-branch-group-header .branch-group-color {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: var(--project-color, var(--vscode-foreground));
            }

            .report-branch-group-header .branch-group-duration {
                margin-left: auto;
                font-variant-numeric: tabular-nums;
                opacity: 0.9;
                font-weight: 700;
            }

            .report-branch-group-header .branch-group-count {
                opacity: 0.7;
                font-weight: 500;
                font-size: 0.8rem;
            }

            .report-branch-group-header .branch-group-toggle {
                transition: transform 0.2s ease;
                opacity: 0.6;
            }

            .report-branch-group.collapsed .branch-group-toggle {
                transform: rotate(-90deg);
            }

            .report-branch-group.collapsed .report-table-wrapper {
                display: none;
            }

            .report-branch-group .report-table-wrapper {
                background: transparent;
                border-radius: 0;
                padding: 0;
            }

            .report-branch-group .report-table th {
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 40%, transparent);
            }

            .report-branch-group .report-table tbody tr:last-child td {
                border-bottom: none;
            }

            .report-filter-bar {
                display: flex;
                gap: 12px;
                margin-bottom: 20px;
                align-items: center;
                flex-wrap: wrap;
                padding: 12px 16px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 12px;
            }

            .report-filter-bar input {
                flex: 1;
                min-width: 220px;
                background: var(--vscode-editor-background);
                color: var(--vscode-input-foreground);
                border: 2px solid var(--vscode-panel-border);
                border-radius: 10px;
                padding: 12px 16px;
                font-family: inherit;
                font-size: 0.95rem;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .report-filter-bar input::placeholder {
                color: var(--vscode-input-placeholderForeground, #9e9e9e);
            }

            .report-filter-bar input:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-focusBorder) 25%, transparent), inset 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .report-filter-pills {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .report-filter-pill {
                background: transparent;
                border: 1px solid var(--vscode-panel-border);
                color: var(--vscode-foreground);
                padding: 6px 12px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 0.8rem;
                transition: all 0.15s ease;
            }

            .report-filter-pill:hover {
                background: var(--vscode-toolbar-hoverBackground);
            }

            .report-filter-pill.active {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border-color: var(--vscode-button-background);
            }

            .report-filter-clear {
                background: transparent;
                border: none;
                color: var(--vscode-foreground);
                cursor: pointer;
                opacity: 0.7;
                font-size: 0.85rem;
                font-weight: 500;
            }

            .report-filter-clear:hover {
                opacity: 1;
            }

            .report-table-wrapper {
                overflow-x: auto;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 12px;
                padding: 4px;
            }

            .report-table {
                width: 100%;
                border-collapse: collapse;
            }

            .report-table th,
            .report-table td {
                text-align: left;
                padding: 14px 16px;
            }

            .report-table tbody tr {
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .report-table tbody tr:last-child {
                border-bottom: none;
            }

            .report-table th.actions-header,
            .report-table td.session-actions {
                width: 210px;
                min-width: 210px;
                max-width: 210px;
                white-space: nowrap;
            }

            .report-table th {
                font-weight: 700;
                opacity: 0.7;
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                white-space: nowrap;
            }

            .report-table th.sortable-header {
                cursor: pointer;
                user-select: none;
            }

            .report-table th.sortable-header:hover {
                opacity: 1;
                background: var(--vscode-toolbar-hoverBackground);
            }

            .report-table th.sortable-header::after {
                content: '↕';
                margin-left: 8px;
                opacity: 0.35;
                font-size: 0.7rem;
            }

            .report-table th.sortable-header.sort-asc::after {
                content: '↑';
                opacity: 1;
            }

            .report-table th.sortable-header.sort-desc::after {
                content: '↓';
                opacity: 1;
            }

            .report-table tbody tr:hover {
                background: var(--vscode-toolbar-hoverBackground);
            }

            .report-table tbody tr {
                border-left: 3px solid transparent;
            }

            .report-table tbody tr.session-row-active {
                background: color-mix(in srgb, var(--vscode-button-background) 4%, transparent);
            }

            .report-table tbody tr[style*="--project-color"] {
                border-left-color: var(--project-color);
            }

            .report-table tbody tr.session-row-active[style*="--project-color"] {
                border-left-width: 4px;
            }

            .session-row-live-indicator {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                margin-right: 6px;
                font-size: 0.65rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.03em;
                color: var(--vscode-button-background);
                padding: 1px 0;
                line-height: 1;
                vertical-align: middle;
            }

            .session-row-live-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: var(--vscode-button-background);
                animation: session-row-live-pulse 1.5s ease-in-out infinite;
            }

            @keyframes session-row-live-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(0.85); }
            }

            .project-color-dot {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--project-color, transparent);
                margin-right: 8px;
                vertical-align: middle;
            }

            .branch-timeline {
                font-size: 0.85rem;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .branch-entry {
                display: flex;
                gap: 8px;
            }

            .session-date {
                display: inline;
            }

            .session-time {
                opacity: 0.65;
                margin-left: 8px;
                white-space: nowrap;
            }

            .session-actions {
                display: flex;
                justify-content: flex-end;
                align-items: center;
                gap: 6px;
            }

            .session-actions .button.mini {
                padding: 5px 10px;
                font-size: 0.8rem;
            }

            .report-project-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                margin-right: 8px;
                vertical-align: middle;
            }

            .report-project-icon img {
                width: 16px;
                height: 16px;
                object-fit: contain;
            }

            .report-project-icon svg {
                width: 16px;
                height: 16px;
            }

            .report-empty {
                text-align: center;
                padding: 72px 24px;
                opacity: 0.8;
            }

            .report-empty-icon {
                font-size: 3rem;
                margin-bottom: 16px;
            }

            .report-empty h3 {
                margin: 0 0 8px;
                font-size: 1.25rem;
            }

            .report-empty p {
                margin: 0 0 20px;
                opacity: 0.75;
            }

            .inline-edit {
                display: flex;
                flex-direction: column;
                gap: 16px;
                padding: 20px;
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 12px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            }

            .inline-edit input,
            .inline-edit textarea,
            .inline-edit select {
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 8px;
                padding: 10px 12px;
                font-family: inherit;
                font-size: 0.95rem;
                outline: none;
                width: 100%;
            }

            .inline-edit input:not(:focus),
            .inline-edit textarea:not(:focus),
            .inline-edit select:not(:focus) {
                border-color: var(--vscode-input-border, #6e6e6e);
            }

            .inline-edit input:focus,
            .inline-edit textarea:focus,
            .inline-edit select:focus {
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 0 2px var(--vscode-focusBorder);
            }

            .inline-edit textarea {
                min-height: 80px;
                resize: vertical;
            }

            .inline-edit-row {
                display: flex;
                gap: 16px;
                align-items: flex-end;
            }

            .inline-edit > .field,
            .inline-edit-row .field {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 8px;
                min-width: 0;
            }

            .inline-edit label {
                font-size: 0.8rem;
                font-weight: 700;
                opacity: 0.85;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }

            .inline-edit-actions {
                display: flex;
                gap: 10px;
                margin-top: 4px;
            }

            .add-session-edit select {
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
            }

            @media (max-width: 768px) {
                .time-tracking-report {
                    padding: 20px;
                }

                .report-page-header {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .report-summary-grid {
                    grid-template-columns: repeat(2, 1fr);
                }

                .report-toolbar {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .inline-edit-row {
                    flex-direction: column;
                    align-items: stretch;
                }
            }
        </style>`;
}
