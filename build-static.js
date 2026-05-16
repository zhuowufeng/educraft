const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const VIEWS = path.join(__dirname, 'views');

const library = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'library.json'), 'utf-8'));

function render(page, data) {
    return new Promise((resolve, reject) => {
        ejs.renderFile(path.join(VIEWS, `${page}.ejs`), { ...data, body: '' }, { async: false }, (err, content) => {
            if (err) return reject(err);
            ejs.renderFile(path.join(VIEWS, 'layout.ejs'), { ...data, body: content }, { async: false }, (err2, html) => {
                if (err2) return reject(err2);
                resolve(html);
            });
        });
    });
}

function writeFile(relPath, content) {
    const fp = path.join(DIST, relPath);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, content);
}

function copyDir(srcRel, dstRel) {
    const src = path.join(__dirname, srcRel);
    if (!fs.existsSync(src)) return;
    function copyRec(dir, rel) {
        for (const entry of fs.readdirSync(dir)) {
            const fp = path.join(dir, entry);
            const r = rel ? `${rel}/${entry}` : entry;
            if (fs.statSync(fp).isDirectory()) {
                copyRec(fp, r);
            } else {
                writeFile(path.join(dstRel || srcRel, r), fs.readFileSync(fp));
            }
        }
    }
    copyRec(src, '');
}

async function build() {
    console.log('Building static site...');

    // 1. Homepage
    const indexHtml = await render('index', { library, page: 'home' });
    writeFile('index.html', indexHtml);
    console.log('  ✓ index.html');

    // 2. Library page — inject client-side filtering, fix form action
    const libraryHtml = await render('library', { library, page: 'library', subject: 'all', search: '' });
    const libraryWithFilter = libraryHtml
        // fix form action for static site
        .replace('action="/library"', 'action="/library.html"')
        // fix filter button hrefs
        .replace(/href="\/library\?subject=/g, 'href="?subject=')
        .replace('</body>', `
<script>
(function() {
    var cards = document.querySelectorAll('.courseware-card');
    var container = document.querySelector('.courseware-grid');
    var emptyState = document.querySelector('.empty-state');
    var filterBtns = document.querySelectorAll('.filter-btn');
    var searchInput = document.querySelector('.search-input');
    var searchForm = document.querySelector('.search-box');

    var allData = ${JSON.stringify(library.map(cw => ({ id: cw.id, subject: cw.subject, title: cw.title, description: cw.description, tags: cw.tags })))};

    function getSubjectFromHref(el) {
        var m = el.getAttribute('href').match(/subject=([^&]*)/);
        return m ? decodeURIComponent(m[1]) : 'all';
    }

    function render() {
        var subj = new URLSearchParams(location.search).get('subject') || 'all';
        var q = (new URLSearchParams(location.search).get('search') || '').toLowerCase();
        var filtered = allData;
        if (subj !== 'all') filtered = filtered.filter(function(c) { return c.subject === subj; });
        if (q) filtered = filtered.filter(function(c) {
            return c.title.toLowerCase().indexOf(q) !== -1
                || c.description.toLowerCase().indexOf(q) !== -1
                || c.tags.some(function(t) { return t.toLowerCase().indexOf(q) !== -1; });
        });

        filterBtns.forEach(function(b) {
            b.classList.toggle('active', getSubjectFromHref(b) === subj);
        });

        if (searchInput) searchInput.value = new URLSearchParams(location.search).get('search') || '';

        var ids = {};
        filtered.forEach(function(c) { ids[c.id] = true; });
        cards.forEach(function(c) {
            var id = c.getAttribute('href').split('/').pop();
            c.style.display = ids[id] ? '' : 'none';
        });

        if (emptyState) {
            container.style.display = filtered.length ? '' : 'none';
            emptyState.style.display = filtered.length ? 'none' : '';
        } else if (filtered.length === 0 && container) {
            var none = document.createElement('div');
            none.className = 'empty-state';
            none.innerHTML = '<div class="empty-icon">📭</div><h3>暂无课件</h3><p>没有找到匹配的课件，试试其他关键词</p><a href="?" class="btn btn-secondary">清除筛选</a>';
            none.querySelector('a').addEventListener('click', function(e) {
                e.preventDefault();
                history.pushState({}, '', location.pathname);
                render();
            });
            container.parentNode.insertBefore(none, container.nextSibling);
            container.style.display = 'none';
            emptyState = none;
        }
    }

    filterBtns.forEach(function(b) {
        b.addEventListener('click', function(e) {
            e.preventDefault();
            var s = getSubjectFromHref(b);
            var params = new URLSearchParams(location.search);
            if (s !== 'all') params.set('subject', s); else params.delete('subject');
            var qs = params.toString();
            history.pushState({}, '', location.pathname + (qs ? '?' + qs : ''));
            render();
        });
    });

    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            var v = searchInput.value.trim();
            var params = new URLSearchParams(location.search);
            if (v) params.set('search', v); else params.delete('search');
            var qs = params.toString();
            history.pushState({}, '', location.pathname + (qs ? '?' + qs : ''));
            render();
        });
    }

    window.addEventListener('popstate', render);
    render();
})();
</script>
</body>`);
    writeFile('library.html', libraryWithFilter);
    console.log('  ✓ library.html (with client-side filtering)');

    // 3. Generate page — replace API call with friendly message
    const generateHtml = await render('generate', { page: 'generate', result: null, error: null });
    const generateFixed = generateHtml.replace(
        /<script>[\s\S]*?<\/script>/,
        `<script>
document.getElementById('generateForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = document.getElementById('generateBtn');
    var result = document.getElementById('generateResult');
    result.style.display = 'block';
    result.className = 'generate-result error';
    result.innerHTML = '<div class="result-icon">🔌</div><h3>需要后端服务支持</h3><p>AI 课件生成功能需要运行 Express 后端服务（<code>node server.js</code>）才能使用。当前为静态演示版本，您可以通过以下方式体验完整功能：</p><ul style="text-align:left;margin-top:12px"><li>下载已有课件：前往 <a href="library.html">课件库</a> 浏览和下载现成的交互课件</li><li>本地运行：在项目目录执行 <code>node server.js</code> 启动完整版服务</li></ul>';
    btn.disabled = false;
    btn.innerHTML = '<span>✦ 开始生成</span>';
});
</script>`
    );
    writeFile('generate.html', generateFixed);
    console.log('  ✓ generate.html (static-friendly)');

    // 4. View pages — fix download links to point directly to courseware files
    for (const cw of library) {
        const html = await render('view', { courseware: cw, page: 'view' });
        const viewFixed = html
            .replace(new RegExp(`/download/${cw.id}`, 'g'), `/courseware/${cw.id}.html`)
            .replace(/href="\/courseware\/([^"]+\.html)"/g, 'href="/courseware/$1" download');
        writeFile(`view/${cw.id}.html`, viewFixed);
        console.log(`  ✓ view/${cw.id}.html`);
    }

    // 5. Error page
    const errorHtml = await render('error', { message: '页面未找到', page: '' });
    writeFile('404.html', errorHtml);
    console.log('  ✓ 404.html');

    // 6. Copy static assets
    copyDir('public', '.');
    copyDir('courseware');
    copyDir('data', 'data');
    console.log('  ✓ static assets copied');

    // 7. .nojekyll for GitHub Pages
    fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
    console.log('  ✓ .nojekyll');

    console.log('\nBuild complete! Output in dist/');
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
