import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { getTablerIconSvg, parseIconName } from '../template/project/utils/tablerIcons';

suite('Tabler Icons helper', () => {
    function createMockContext(outlineNodes: Record<string, unknown>, filledNodes: Record<string, unknown> = {}): vscode.ExtensionContext {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabler-test-'));
        fs.mkdirSync(path.join(tmpDir, 'dist'));
        fs.writeFileSync(path.join(tmpDir, 'dist', 'tabler-nodes-outline.json'), JSON.stringify(outlineNodes));
        fs.writeFileSync(path.join(tmpDir, 'dist', 'tabler-nodes-filled.json'), JSON.stringify(filledNodes));
        return { extensionPath: tmpDir } as vscode.ExtensionContext;
    }

    test('parseIconName normalizes names and detects filled variant', () => {
        assert.deepStrictEqual(parseIconName('brand-github'), { name: 'brand-github', variant: 'outline' });
        assert.deepStrictEqual(parseIconName('BrandGithub-filled'), { name: 'brand-github', variant: 'filled' });
        assert.deepStrictEqual(parseIconName('  icon-home  '), { name: 'home', variant: 'outline' });
        assert.deepStrictEqual(parseIconName('ti-flame'), { name: 'flame', variant: 'outline' });
        assert.deepStrictEqual(parseIconName('ti-flame-filled'), { name: 'flame', variant: 'filled' });
        assert.deepStrictEqual(parseIconName('heart_filled'), { name: 'heart', variant: 'filled' });
        assert.strictEqual(parseIconName('  '), null);
        assert.strictEqual(parseIconName('-filled'), null);
        assert.strictEqual(parseIconName('ti-'), null);
    });

    test('getTablerIconSvg renders outline SVG', () => {
        const context = createMockContext({
            'home': [['path', { d: 'M3 12l2-2v7h14v-7l2 2M5 10l7-7 7 7' }]]
        });
        const svg = getTablerIconSvg(context, 'home');
        assert.ok(svg);
        assert.ok(svg!.includes('stroke="currentColor"'));
        assert.ok(svg!.includes('fill="none"'));
        assert.ok(svg!.includes('stroke-width="2"'));
        assert.ok(svg!.includes('d="M3 12l2-2v7h14v-7l2 2M5 10l7-7 7 7"'));
        assert.ok(svg!.includes('class="tabler-icon tabler-icon-home"'));
    });

    test('getTablerIconSvg renders filled SVG', () => {
        const context = createMockContext(
            {},
            {
                'heart': [['path', { d: 'M12 21l-1-1H5L4 8h16l-1 12h-6l-1 1z' }]]
            }
        );
        const svg = getTablerIconSvg(context, 'heart-filled');
        assert.ok(svg);
        assert.ok(svg!.includes('fill="currentColor"'));
        assert.ok(svg!.includes('stroke="none"'));
        assert.ok(!svg!.includes('stroke-width="2"'));
    });

    test('getTablerIconSvg returns null for unknown icon', () => {
        const context = createMockContext({});
        const svg = getTablerIconSvg(context, 'nonexistent');
        assert.strictEqual(svg, null);
    });

    test('getTablerIconSvg escapes attribute values', () => {
        const context = createMockContext({
            'test': [['path', { d: 'M3 12" onclick="alert(1)' }]]
        });
        const svg = getTablerIconSvg(context, 'test');
        assert.ok(svg);
        assert.ok(!svg!.includes('d="M3 12" onclick="alert(1)"'));
        assert.ok(svg!.includes('&quot;'));
    });
});
