// Projects page functionality

document.addEventListener('DOMContentLoaded', function() {
    fetch('data/projects.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const container = document.getElementById('projects-container');
            if (!container) {
                console.error('Projects container not found');
                return;
            }

            container.innerHTML = ''; // Clear existing content

            data.forEach(project => {
                const projectElement = document.createElement('div');
                projectElement.className = 'bg-white rounded-lg shadow-md p-6 flex flex-col justify-between';
                
                const lang = project.language || 'N/A';

                projectElement.innerHTML = `
                    <div>
                        <h3 class="text-xl font-bold text-gray-800 mb-2">${project.name}</h3>
                        <p class="text-gray-600 mb-4">${project.description}</p>
                    </div>
                    <div>
                        <div class="flex items-center justify-between text-sm text-gray-500 mb-4">
                            <span>${lang}</span>
                            <div class="flex items-center">
                                <span class="mr-4"><i class="fas fa-star mr-1"></i>${project.stars}</span>
                                <span><i class="fas fa-code-branch mr-1"></i>${project.forks}</span>
                            </div>
                        </div>
                        <a href="${project.url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">View on GitHub</a>
                    </div>
                `;
                container.appendChild(projectElement);
            });
        })
        .catch(error => {
            console.error('Error fetching or processing projects:', error);
            const container = document.getElementById('projects-container');
            if (container) {
                container.innerHTML = '<p class="text-red-500 text-center">Could not load projects. Please try again later.</p>';
            }
        });
});

// Add some additional project interactions
document.addEventListener('DOMContentLoaded', function() {
    // Add tooltip functionality for tech tags
    const techTags = document.querySelectorAll('.tech-tag');
    
    techTags.forEach(tag => {
        tag.addEventListener('mouseenter', function() {
            // Create tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'tech-tooltip';
            tooltip.textContent = `Click to highlight projects using ${this.textContent}`;
            tooltip.style.cssText = `
                position: absolute;
                background: var(--primary-color);
                color: white;
                padding: 0.5rem;
                border-radius: 4px;
                font-size: 0.8rem;
                z-index: 1000;
                pointer-events: none;
                white-space: nowrap;
            `;
            
            document.body.appendChild(tooltip);
            
            // Position tooltip
            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + 'px';
            tooltip.style.top = (rect.top - tooltip.offsetHeight - 10) + 'px';
            
            // Store tooltip reference
            this.tooltip = tooltip;
        });
        
        tag.addEventListener('mouseleave', function() {
            if (this.tooltip) {
                document.body.removeChild(this.tooltip);
                this.tooltip = null;
            }
        });
    });
}); 