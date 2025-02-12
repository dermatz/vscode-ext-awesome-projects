# Change Log

All notable changes to the "awesome-projects" extension will be documented in this file.

## Unreleased
...

---
## Latest Release

## [0.5.2] - 2025-02-12

### Bug Fixes

- fix: improve changelog overlay performance
- fix: resolve an issue where the "Remove Project" button did not work on Windows Platform (win32)

## [0.5.1] - 2025-02-10

### Bug Fixes

- fix: changelog parser to render markdown links correctly in "What's New" overlay
- fix: resolve Windows (win32) path handling issue for "Open Project" button. ([#30](https://github.com/dermatz/vscode-ext-awesome-projects/issues/30)) thanks to [@K-eL](https://github.com/K-eL)

## [0.5.0] - 2025-02-10

### Added

- feat: add "Scan for Projects" button to recursively scan a folder for projects

## [0.4.0] - 2025-02-10

### Added

- feat: add project highlighting to display the currently opened project

## [0.3.2] - 2025-02-07

### Changes

- Show latest 3 Versions in changelog overlay

### Bug Fixes

- fix: resolve hover styles issue in changelog overlay
- fix: prevent link click propagation in changelog overlay

## [0.3.1] - 2025-02-07

### Added

- feat: add a whats new overlay in footer links
- add new readme video

### Bugfix

- style: fix hover styles

## [0.3.0] - 2025-02-06

### Added
- feat: add public beta version flag
- feat: add Git Repository & Sub-Modul detection in product info dashboard
- style: add new header gradiends

### Changed
- style: update webview layout for better usability

### Remove
- remove project path on project info dashboard
- remove preview flag

### Bug Fixed
- fix: integration tests for core features

## [0.2.1] - 2025-02-06

### Changes

- style: adjust project icon background

## [0.2.0] - 2025-02-06

### Added

- feat: implement new webview design with improved UI/UX
- feat: add new sidebar icon for better visibility
- feat: enhance drag & drop functionality for project cards
- feat: add improved error handling system
- feat: update repository URL for better issue tracking

### Refactoring

- refactor: complete extension architecture overhaul
- refactor: optimize project card management
- refactor: improve state management system
- refactor: enhance data persistence layer

### Bug Fixes

- fix: resolve drag & drop edge cases
- fix: correct repository links in documentation
- fix: improve error messages for better user feedback

### Documentation

- docs: update README with new features
- docs: improve installation instructions
- docs: add new screenshots of updated UI

### Other Changes

- chore: update dependencies to latest versions
- chore: optimize build process
- style: improve CSS organization
- style: update color scheme for better contrast


## [0.1.4] - 2025-01-16

### Changed

- Refactored the code base to improve maintainability and performance.

### Added

- Implemented automated tests to ensure the extension's quality and reliability.
- Enhanced the extension's code handling capabilities for better user experience.

## [0.1.3] - 2025-01-13

### Fixed

- Improved the color picker functionality to ensure it displays the correct reset color, enhancing user experience by providing accurate color selection [#4](https://github.com/dermatz/vscode-ext-awesome-projects/issues/4).
- Introduced support for Windows, allowing users to easily show files in Explorer, thereby improving accessibility and convenience for Windows users ([#5](https://github.com/dermatz/vscode-ext-awesome-projects/issues/5)).

## [0.1.2] - 2025-01-11

### Fixed

- Fixed color picker fallback color (#4)

## [0.1.1] - 2025-01-10

### Fixed

- Fixed + Button to add new Project
- Add missing Input-Placehoder for increased accessibility

## [0.1.0] - 2025-01-10

### Added

- added Drag&Drop for Project Cards to rearrange

----

## [0.0.2] - [0.0.6] - 2025-01-09

### Added

- Marketplace Categories and Tags

### Fixed

- Extension Bundeling
- Extension Assets calls
- Security Issues
- Performance Bottlenecks
- CSS loading issues in production build

## [0.0.1] - 2025-01-09

- Initial release
