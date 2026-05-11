import * as assert from 'assert';
import { getProjectInfoDropdownHtml } from '../template/project/components/dropdowns/dropdownProjectInfo';

suite('dropdownProjectInfo – URL escaping', () => {
    const gitReposModule = require('../template/project/utils/getGitRepositories');
    let originalGetGitRepositoriesHtml: unknown;

    setup(() => {
        originalGetGitRepositoriesHtml = gitReposModule.getGitRepositoriesHtml;
        gitReposModule.getGitRepositoriesHtml = async () => '';
    });

    teardown(() => {
        gitReposModule.getGitRepositoriesHtml = originalGetGitRepositoriesHtml;
    });

    test('productionUrl with & is correctly escaped in href and link text', async () => {
        const html = await getProjectInfoDropdownHtml({
            id: 'test-id',
            name: 'Test',
            path: '/tmp/test',
            productionUrl: 'https://example.com?foo=1&bar=2'
        });

        // href-Attribut: & muss als &amp; stehen (Attributkontext)
        assert.ok(
            html.includes('href="https://example.com?foo=1&amp;bar=2"'),
            'href sollte & als &amp; enthalten'
        );

        // Linktext: & wird als &amp; gerendert (valides HTML, Browser zeigt &)
        assert.ok(
            html.includes('>example.com?foo=1&amp;bar=2<'),
            'Linktext sollte &amp; als valides HTML enthalten'
        );

        // Kein doppelt-escaped &amp;amp;
        assert.ok(
            !html.includes('&amp;amp;'),
            'Linktext darf nicht doppelt-escaped sein'
        );
    });


});
