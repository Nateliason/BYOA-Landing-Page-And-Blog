const fs = require('fs-extra');
const path = require('path');
const marked = require('marked');
const frontMatter = require('front-matter');

// Configure marked for security
marked.setOptions({
    headerIds: false,
    mangle: false
});

// Create necessary directories
const dirs = ['dist', 'src/content', 'src/content/blog', 'src/content/pages'];
dirs.forEach(dir => fs.ensureDirSync(dir));

// Read base template
const baseTemplate = fs.readFileSync('src/templates/base.html', 'utf-8');

// Helper function to replace template variables
function applyTemplate(template, data) {
    return template
        .replace('{{title}}', data.title || 'Build Your Own Apps with AI')
        .replace('{{content}}', data.content);
}

// Process markdown files
function processMarkdown(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { attributes, body } = frontMatter(content);
    return {
        ...attributes,
        content: marked.parse(body)
    };
}

// Build pages
async function build() {
    // Copy static assets
    await fs.copy('src/css', 'dist/css');

    // Process content directories
    const contentDirs = ['pages', 'blog'];
    
    for (const dir of contentDirs) {
        const srcDir = path.join('src/content', dir);
        const distDir = path.join('dist', dir);
        
        // Ensure the directory exists
        if (!fs.existsSync(srcDir)) continue;
        fs.ensureDirSync(distDir);

        const files = fs.readdirSync(srcDir);
        
        for (const file of files) {
            if (!file.endsWith('.md')) continue;
            
            const filePath = path.join(srcDir, file);
            const { content, title } = processMarkdown(filePath);
            
            const html = applyTemplate(baseTemplate, { title, content });
            
            const outFile = dir === 'pages' 
                ? path.join('dist', file.replace('.md', '.html'))
                : path.join(distDir, file.replace('.md', '.html'));
            fs.writeFileSync(outFile, html);

            // If this is index.md in pages directory, also copy it to root dist
            if (dir === 'pages' && file === 'index.md') {
                fs.writeFileSync(path.join('dist', 'index.html'), html);
            }
        }
    }

    // Create a default index.html if one doesn't exist
    if (!fs.existsSync(path.join('dist', 'index.html'))) {
        const defaultContent = {
            title: 'Welcome',
            content: '<h1>Welcome to My Site</h1><p>This is the homepage of my static site.</p>'
        };
        const html = applyTemplate(baseTemplate, defaultContent);
        fs.writeFileSync(path.join('dist', 'index.html'), html);
    }

    console.log('Build completed successfully!');
}

build().catch(console.error); 