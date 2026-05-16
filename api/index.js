const express = require('express');
const path = require('path');
const fs = require('fs');
const expressLayouts = require('express-ejs-layouts');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/courseware', express.static(path.join(__dirname, '..', 'courseware')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

function loadLibrary() {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'library.json'), 'utf-8');
    return JSON.parse(raw);
}

app.get(['/', '/library', '/generate', '/view/:id', '/download/:id', '/api/courseware'], (req, res) => {
    const pathname = req.path;
    if (pathname === '/') {
        res.render('index', { library: loadLibrary(), page: 'home' });
    } else if (pathname === '/library') {
        const library = loadLibrary();
        const subject = req.query.subject || 'all';
        const search = req.query.search || '';
        let filtered = library;
        if (subject !== 'all') filtered = filtered.filter(c => c.subject === subject);
        if (search) filtered = filtered.filter(c => c.title.includes(search) || c.description.includes(search) || c.tags.some(t => t.includes(search)));
        res.render('library', { library: filtered, subject, search, page: 'library' });
    } else {
        res.status(404).render('error', { message: '页面未找到' });
    }
});

app.get('/generate', (req, res) => {
    res.render('generate', { page: 'generate', result: null, error: null });
});

app.post('/api/generate', (req, res) => {
    const { prompt, grade, subject } = req.body;
    if (!prompt || prompt.trim().length < 5) {
        return res.status(400).json({ error: '请详细描述您需要的课件内容' });
    }
    const request = { id: Date.now().toString(), prompt: prompt.trim(), grade: grade || '初中', subject: subject || '数学', status: 'pending', createdAt: new Date().toISOString() };
    const requestsDir = path.join(__dirname, '..', 'data', 'requests');
    if (!fs.existsSync(requestsDir)) fs.mkdirSync(requestsDir, { recursive: true });
    fs.writeFileSync(path.join(requestsDir, `${request.id}.json`), JSON.stringify(request, null, 2));
    res.json({ success: true, message: '您的课件生成请求已提交！', requestId: request.id });
});

app.get('/view/:id', (req, res) => {
    const library = loadLibrary();
    const courseware = library.find(c => c.id === req.params.id);
    if (!courseware) return res.status(404).render('error', { message: '课件未找到' });
    res.render('view', { courseware, page: 'view' });
});

app.get('/download/:id', (req, res) => {
    const library = loadLibrary();
    const courseware = library.find(c => c.id === req.params.id);
    if (!courseware) return res.status(404).json({ error: '课件未找到' });
    const filePath = path.join(__dirname, '..', courseware.file);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件未找到' });
    res.download(filePath, `${courseware.title}.html`);
});

app.get('/api/courseware', (req, res) => {
    res.json(loadLibrary());
});

module.exports = app;
