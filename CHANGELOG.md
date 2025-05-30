# Change Log

## Unreleased

- feat: update depdencies
- feat: load static resources only once and cache them to increase performance
- fix: update project ID check to run immediately to increase performance
- fix: format code for better readability and consistency
---

## Latest Release

## [0.7.1] - 2025-04-07

### Bug Fixes

- Fixed an issue where the changelog was not displayed correctly

## [0.7.0] - 2025-04-07

### Changes

- feat: implement drag-and-drop functionality for project items
- feat: add update notification feature to inform users of new versions

## [0.6.8] - 2025-02-28

### Changes

- Updated changelog

## [0.6.7] - 2025-02-28

### Changes

- The number of recent changes displayed in the What's New overlay has been increased from 3 to 6.
- Improve Changelog styling and add user defined theme colors colors

### Bug Fixes

- Improved the initial loading of the extension

## [0.6.6] - 2025-02-27

### Bug Fixes

- Fixed code blocks in the What's New overlay. Code elements wrapped in backticks (`) are now properly highlighted, making them easier to read.

## [0.6.5] - 2025-02-18

### Bug Fixes

- Fixed an issue where the `+ Add Project` and `Scan for Project` buttons did not work correctly on the Windows platform.
- Fixed wording in Changelog

## [0.6.4] - 2025-02-16

### Bug Fixes

- QA: Fixed an issue where the path to open a project was not correctly assembled.

## [0.6.3] - 2025-02-14

### Refactoring

- Removed complexity that caused stored URLs to be unreachable in certain situations.

## [0.6.2] - 2025-02-14

### Bug Fixes

- Fixed an issue where the Open Folder and Save buttons did not function correctly in certain situations.
- Fixed an issue where the Color Picker value could not be saved.
- Fixed an issue where the vscode API was initialized too frequently, leading to performance degradation.
- Fixed an issue that prevented path normalization from working correctly on Windows platforms.
- Save functions have been completely overhauled and are now stored with unique project IDs instead of generated hashes.

### Removed

- The Open Folder button has been removed and will be reintroduced in a future update after a complete overhaul.

## [0.6.1] - 2025-02-13

### Bug Fixes

- Fixed an issue where links in the description text of the What's New overlay could not be opened in the browser.

## [0.6.0] - 2025-02-13

### Added Feature Request

- Added a quick jump button when hovering over a project, allowing users to quickly navigate to the project - thanks to [@Morgy93](https://github.com/Morgy93) for the suggestion.

## [0.5.2] - 2025-02-12

### Bug Fixes

- Improved changelog overlay performance.
- Resolved an issue where the "Remove Project" button did not work on the Windows platform (win32).

## [0.5.1] - 2025-02-10

### Bug Fixes

- Fixed changelog parser to render markdown links correctly in the "What's New" overlay.
- Resolved Windows (win32) path handling issue for the "Open Project" button. ([#30](https://github.com/dermatz/vscode-ext-awesome-projects/issues/30)) thanks to [@K-eL](https://github.com/K-eL).

## [0.5.0] - 2025-02-10

### Added

- Added "Scan for Projects" button to recursively scan a folder for projects.

## [0.4.0] - 2025-02-10

### Added

- Added project highlighting to display the currently opened project.

## [0.3.2] - 2025-02-07

### Changes

- Show latest 3 versions in changelog overlay.

### Bug Fixes

- Resolved hover styles issue in changelog overlay.
- Prevented link click propagation in changelog overlay.

## [0.3.1] - 2025-02-07

### Added

- Added a "What's New" overlay in footer links.
- Added a new readme video.

### Bug Fixes

- Fixed hover styles.

## [0.3.0] - 2025-02-06

### Added

- Added public beta version flag.
- Added Git Repository & Sub-Module detection in the product info dashboard.
- Added new header gradients.

### Changed

- Updated webview layout for better usability.

### Removed

- Removed project path on the project info dashboard.
- Removed preview flag.

### Bug Fixes

- Fixed integration tests for core features.

## [0.2.1] - 2025-02-06

### Changes

- Adjusted project icon background.

## [0.2.0] - 2025-02-06

### Added

- Implemented new webview design with improved UI/UX.
- Added new sidebar icon for better visibility.
- Enhanced drag & drop functionality for project cards.
- Added improved error handling system.
- Updated repository URL for better issue tracking.

### Refactoring

- Completed extension architecture overhaul.
- Optimized project card management.
- Improved state management system.
- Enhanced data persistence layer.

### Bug Fixes

- Resolved drag & drop edge cases.
- Corrected repository links in documentation.
- Improved error messages for better user feedback.

### Documentation

- Updated README with new features.
- Improved installation instructions.
- Added new screenshots of updated UI.

### Other Changes

- Updated dependencies to the latest versions.
- Optimized build process.
- Improved CSS organization.
- Updated color scheme for better contrast.

## [0.1.4] - 2025-01-16

### Changed

- Refactored the code base to improve maintainability and performance.

### Added

- Implemented automated tests to ensure the extension's quality and reliability.
- Enhanced the extension's code handling capabilities for a better user experience.

## [0.1.3] - 2025-01-13

### Fixed

- Improved the color picker functionality to ensure it displays the correct reset color, enhancing user experience by providing accurate color selection ([#4](https://github.com/dermatz/vscode-ext-awesome-projects/issues/4)).
- Introduced support for Windows, allowing users to easily show files in Explorer, thereby improving accessibility and convenience for Windows users ([#5](https://github.com/dermatz/vscode-ext-awesome-projects/issues/5)).

## [0.1.2] - 2025-01-11

### Fixed

- Fixed color picker fallback color ([#4](https://github.com/dermatz/vscode-ext-awesome-projects/issues/4)).

## [0.1.1] - 2025-01-10

### Fixed

- Fixed + button to add a new project.
- Added missing input placeholder for increased accessibility.

## [0.1.0] - 2025-01-10

### Added

- Added drag & drop for project cards to rearrange.

----

## [0.0.2] - [0.0.6] - 2025-01-09

### Added

- Marketplace categories and tags.

### Fixed

- Extension bundling.
- Extension assets calls.
- Security issues.
- Performance bottlenecks.
- CSS loading issues in the production build.

## [0.0.1] - 2025-01-09

- Initial release.
