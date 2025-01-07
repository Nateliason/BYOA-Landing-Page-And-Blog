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

// Special function to handle index.html
function processIndex(indexContent, template) {
    // Extract everything between <body> and </body> from index content
    const bodyMatch = indexContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const mainContent = bodyMatch ? bodyMatch[1].trim() : indexContent;
    
    // Extract title from index content
    const titleMatch = indexContent.match(/<title[^>]*>([\s\S]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Build Your Own Apps with AI';
    
    return applyTemplate(template, { title, content: mainContent });
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

    // Handle index.html specially
    if (fs.existsSync('src/index.html')) {
        const indexContent = fs.readFileSync('src/index.html', 'utf-8');
        const processedIndex = processIndex(indexContent, baseTemplate);
        fs.writeFileSync('dist/index.html', processedIndex);
    }

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
            if (dir === 'pages' && file === 'index.md') continue; // Skip index.md in pages
            
            const filePath = path.join(srcDir, file);
            const { content, title } = processMarkdown(filePath);
            
            const html = applyTemplate(baseTemplate, { title, content });
            
            const outFile = dir === 'pages' 
                ? path.join('dist', file.replace('.md', '.html'))
                : path.join(distDir, file.replace('.md', '.html'));
            fs.writeFileSync(outFile, html);
        }
    }

    console.log('Build completed successfully!');
}

build().catch(console.error); 