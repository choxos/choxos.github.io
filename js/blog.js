// Blog page functionality

document.addEventListener('DOMContentLoaded', function() {
    fetch('data/blog_posts.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const container = document.getElementById('blog-posts-container');
            if (!container) {
                console.error('Blog posts container not found');
                return;
            }

            container.innerHTML = ''; // Clear existing content

            data.forEach(post => {
                const postElement = document.createElement('div');
                postElement.className = 'bg-white rounded-lg shadow-md overflow-hidden';
                
                postElement.innerHTML = `
                    <div class="p-6">
                        <h3 class="text-xl font-bold text-gray-800 mb-2">
                            <a href="${post.url}" target="_blank" rel="noopener noreferrer" class="hover:underline">${post.title}</a>
                        </h3>
                    </div>
                `;
                container.appendChild(postElement);
            });
        })
        .catch(error => {
            console.error('Error fetching or processing blog posts:', error);
            const container = document.getElementById('blog-posts-container');
            if (container) {
                container.innerHTML = '<p class="text-red-500 text-center">Could not load blog posts. Please try again later.</p>';
            }
        });
});

// Additional blog interactions
document.addEventListener('DOMContentLoaded', function() {
    // Add reading progress indicator
    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.style.cssText = `
        position: fixed;
        top: 70px;
        left: 0;
        width: 0%;
        height: 3px;
        background-color: var(--secondary-color);
        z-index: 999;
        transition: width 0.3s ease;
    `;
    document.body.appendChild(progressBar);
    
    // Update progress on scroll
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        
        progressBar.style.width = scrollPercent + '%';
    });
    
    // Add smooth scrolling for internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}); 