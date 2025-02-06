# Awesome-Projects 🤩 A Visual Studio Code Extension

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/aa3fe284550449ec9088834773d3b1fb)](https://app.codacy.com/gh/dermatz/vscode-ext-awesome-projects/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)

![Awesome Projects](resources/image.png)

## Description

The "awesome-projects" extension for Visual Studio Code revolutionizes project management with an intuitive, feature-rich interface. Designed for developers who juggle multiple projects, it provides seamless organization and quick access to all your development environments.

## Key Features

### Project Management
- 📂 Advanced project organization with drag & drop functionality
- 🎨 Customizable project colors with random color generator
- 🏷️ Project categorization and tagging system
- 📝 Project notes and documentation support
- 🔄 Multi-workspace support

### Git Integration
- 🔗 Automatic Git repository detection
- 📦 Git submodules support
- 🔍 Repository URL detection and conversion (SSH/HTTPS)
- 🌐 Integration with major Git platforms (GitHub, GitLab, Bitbucket)

### Environment Management
- 🌍 Multiple environment URL management (Production, Staging, Development)
- 🛠️ Project management tool integration
- 🖼️ Automatic favicon detection for quick visual recognition
- 📱 Responsive webview design

### System Integration
- 🪟 Cross-platform file manager integration (Windows, macOS, Linux)
- 🔒 Secure data storage
- ⚡ Performance-optimized for large project collections
- 🎯 Quick access through keyboard shortcuts

## Requirements

- Visual Studio Code version 1.96.0 or higher
- Git (optional, for repository features)

## Installation & Setup

1. Install from VS Code Marketplace
2. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Search for "Awesome Projects"
4. Click the "+" button to add your first project

## Configuration

The extension can be customized through VS Code settings:

```json
{
    "awesomeProjects.projects": [
        {
            "path": "/path/to/project",
            "name": "Project Name",
            "color": "#ff0000",
            "productionUrl": "https://prod.example.com",
            "stagingUrl": "https://staging.example.com",
            "devUrl": "http://localhost:3000",
            "managementUrl": "https://jira.example.com"
        }
    ],
    "awesomeProjects.useFavicons": true,
    "awesomeProjects.showGitInfo": true
}
```

### Settings Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `awesomeProjects.useFavicons` | boolean | `true` | Enable/disable favicon display |
| `awesomeProjects.showGitInfo` | boolean | `true` | Show Git repository information |
| `awesomeProjects.projects` | array | `[]` | List of configured projects |

## Keyboard Shortcuts

| Command | Windows/Linux | macOS | Description |
|---------|--------------|-------|-------------|
| Add Project | `Ctrl+Alt+P` | `Cmd+Alt+P` | Open add project dialog |
| Refresh Projects | `Ctrl+Alt+R` | `Cmd+Alt+R` | Refresh project list |
| Toggle Sidebar | `Ctrl+Alt+B` | `Cmd+Alt+B` | Toggle projects sidebar |

## Contributing

Contributions are welcome! Please check our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

This extension is released under the [MIT License](LICENSE).

## Acknowledgments

- Icons provided by [Tabler Icons](https://tabler.io) under the [MIT License](https://tabler.io/license)
- Color picker implementation inspired by VS Code's built-in color picker
