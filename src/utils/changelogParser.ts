import * as fs from 'fs';
import * as path from 'path';

interface VersionChanges {
    version: string;
    date: string;
    changes: {
        [type: string]: string[];
    };
}

function convertMarkdownLinksToHtml(text: string): string {
    // Convert issue/PR links: [#30](url) -> <a href="url">#$1</a>
    text = text.replace(/\[#(\d+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2">#$1</a>');

    // Convert user mentions: [@username](url) -> <a href="url">@username</a>
    text = text.replace(/\[@([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2">@$1</a>');

    // Convert regular markdown links: [text](url) -> <a href="url">$1</a>
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2">$1</a>');

    // Convert inline code blocks: `code` -> <code>code</code>
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    return text;
}

export function getChangesSinceLastTag(context: any): VersionChanges[] {
    const changelogPath = path.join(context.extensionPath, 'CHANGELOG.md');
    const content = fs.readFileSync(changelogPath, 'utf8');
    const versions: VersionChanges[] = [];
    let tagsFound = 0;

    // Split content by version sections
    const versionSections = content.split(/## \[/);

    for (const section of versionSections) {
        if (!section.includes(']')) { continue; }

        const versionMatch = section.match(/^([\d.]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?\n/);
        if (!versionMatch) { continue; }

        const version = versionMatch[1];
        const date = versionMatch[2] || '';
        const changes: { [type: string]: string[] } = {};

        // Parse section content
        const lines = section.split('\n');
        let currentType = '';

        for (const line of lines) {
            if (line.startsWith('### ')) {
                currentType = line.replace('### ', '').trim();
                changes[currentType] = [];
            } else if (line.trim().startsWith('- ') && currentType) {
                const changeText = line.trim().substring(2);
                changes[currentType].push(convertMarkdownLinksToHtml(changeText));
            }
        }

        versions.push({ version, date, changes });
        tagsFound++;

        // Stop after finding two tags
        if (tagsFound >= 6) {
            break;
        }
    }

    return versions;
}
