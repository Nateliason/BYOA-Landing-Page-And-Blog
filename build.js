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

// Read templates and partials
const baseTemplate = fs.readFileSync('src/templates/base.html', 'utf-8');
const blogTemplate = fs.readFileSync('src/templates/blog.html', 'utf-8');
const blogIndexTemplate = fs.readFileSync('src/templates/blog-index.html', 'utf-8');
const headerPartial = fs.readFileSync('src/templates/partials/header.html', 'utf-8');
const footerPartial = fs.readFileSync('src/templates/partials/footer.html', 'utf-8');

// Helper function to replace template variables
function applyTemplate(template, data) {
    let result = template;
    
    // Insert partials
    result = result.replace('{{header}}', headerPartial);
    result = result.replace('{{footer}}', footerPartial);
    
    // Handle arrays (for blog index)
    if (data.posts) {
        const postsRegex = /{{#each posts}}([\s\S]*?){{\/each}}/;
        const match = result.match(postsRegex);
        if (match) {
            const postTemplate = match[1];
            const renderedPosts = data.posts.map(post => {
                let postHtml = postTemplate;
                Object.entries(post).forEach(([key, value]) => {
                    const regex = new RegExp(`{{${key}}}`, 'g');
                    postHtml = postHtml.replace(regex, value || '');
                });
                return postHtml;
            }).join('');
            result = result.replace(match[0], renderedPosts);
        }
    }
    
    // Replace all template variables
    Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'string') {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value || '');
        }
    });
    
    // Set default title if not provided
    if (!data.title) {
        result = result.replace(/{{title}}/g, 'Build Your Own Apps with AI');
    }
    
    return result;
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
    const htmlContent = marked.parse(body);
    
    // Create excerpt from the first paragraph
    const excerptMatch = body.match(/^(.*?)\n\n/);
    const excerpt = excerptMatch 
        ? marked.parse(excerptMatch[1]).replace(/<\/?p>/g, '')
        : '';
    
    return {
        ...attributes,
        content: htmlContent,
        excerpt,
        slug: path.basename(filePath, '.md')
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
    const blogPosts = [];
    
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
            const processedContent = processMarkdown(filePath);
            
            // Store blog post data for the index
            if (dir === 'blog') {
                blogPosts.push({
                    title: processedContent.title,
                    date: processedContent.date,
                    excerpt: processedContent.excerpt,
                    slug: processedContent.slug
                });
            }
            
            // Use blog template for blog posts, base template for pages
            const template = dir === 'blog' ? blogTemplate : baseTemplate;
            const html = applyTemplate(template, processedContent);
            
            const outFile = dir === 'pages' 
                ? path.join('dist', file.replace('.md', '.html'))
                : path.join(distDir, file.replace('.md', '.html'));
            fs.writeFileSync(outFile, html);
        }
    }

    // Generate blog index page
    if (blogPosts.length > 0) {
        // Sort posts by date, newest first
        blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const blogIndexHtml = applyTemplate(blogIndexTemplate, {
            title: 'Blog',
            posts: blogPosts
        });
        
        fs.ensureDirSync('dist/blog');
        fs.writeFileSync('dist/blog/index.html', blogIndexHtml);
    }

    console.log('Build completed successfully!');
}

build().catch(console.error); 