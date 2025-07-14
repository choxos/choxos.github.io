document.addEventListener('DOMContentLoaded', function() {
    // Fetch Scholar Stats
    fetch('data/scholar_stats.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(stats => {
            const statsContainer = document.getElementById('scholar-stats');
            if (statsContainer) {
                statsContainer.innerHTML = `
                    <div class="text-center">
                        <p class="text-2xl font-bold">${stats.total_citations || 'N/A'}</p>
                        <p class="text-gray-600">Total Citations</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold">${stats.hindex}</p>
                        <p class="text-gray-600">h-index</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold">${stats.i10index}</p>
                        <p class="text-gray-600">i10-index</p>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error fetching scholar stats:', error);
        });

    // Fetch Publications
    fetch('data/publications.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const container = document.getElementById('publications-container');
            if (!container) {
                console.error('Publications container not found');
                return;
            }

            // Clear any existing content
            container.innerHTML = '';

            data.forEach(pub => {
                const pubElement = document.createElement('div');
                pubElement.className = 'bg-white rounded-lg shadow-md p-6';

                const title = pub.title || 'No title';
                const authors = pub.authors || 'No authors listed';
                const journal = pub.journal || 'Journal not specified';
                const year = pub.year || 'Year not specified';
                const url = pub.url || '#';
                const abstract = pub.abstract || 'Abstract not available.';
                const citations = pub.citations || 0;

                // Generate citation text
                const citationText = generateCitation(pub);

                pubElement.innerHTML = `
                    <h3 class="text-xl font-bold text-gray-800 mb-2">${title}</h3>
                    <p class="text-gray-700 mb-2"><strong>Authors:</strong> ${authors}</p>
                    <div class="flex items-center justify-between mb-4">
                        <p class="text-gray-600 italic">${journal}, ${year}</p>
                        <div class="flex items-center space-x-4">
                            <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                <i class="fas fa-quote-left mr-1"></i>${citations} citations
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4 mb-4">
                        <a href="${url}" target="_blank" rel="noopener noreferrer" class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors">
                            Read Paper <i class="fas fa-external-link-alt ml-2"></i>
                        </a>
                        <button class="btn-abstract text-blue-500 hover:underline">View Abstract</button>
                        <button class="btn-citation text-green-500 hover:underline">Show Citation</button>
                    </div>
                    <div class="abstract-content mt-4 text-gray-600 border-t pt-4" style="display: none;">
                        <p>${abstract}</p>
                    </div>
                    <div class="citation-content mt-4 text-gray-600 border-t pt-4" style="display: none;">
                        <div class="bg-gray-50 p-3 rounded border">
                            <p class="text-sm mb-2"><strong>APA Citation:</strong></p>
                            <p class="text-sm font-mono bg-white p-2 rounded border citation-text">${citationText}</p>
                            <button class="copy-citation bg-green-500 text-white px-3 py-1 rounded text-sm mt-2 hover:bg-green-600 transition-colors">
                                <i class="fas fa-copy mr-1"></i>Copy Citation
                            </button>
                        </div>
                    </div>
                `;
                container.appendChild(pubElement);
            });

            // Add event listeners for interactions
            container.addEventListener('click', function(e) {
                if (e.target.classList.contains('btn-abstract')) {
                    const abstractContent = e.target.closest('.p-6').querySelector('.abstract-content');
                    if (abstractContent) {
                        if (abstractContent.style.display === 'none') {
                            abstractContent.style.display = 'block';
                            e.target.textContent = 'Hide Abstract';
                        } else {
                            abstractContent.style.display = 'none';
                            e.target.textContent = 'View Abstract';
                        }
                    }
                }
                
                if (e.target.classList.contains('btn-citation')) {
                    const citationContent = e.target.closest('.p-6').querySelector('.citation-content');
                    if (citationContent) {
                        if (citationContent.style.display === 'none') {
                            citationContent.style.display = 'block';
                            e.target.textContent = 'Hide Citation';
                        } else {
                            citationContent.style.display = 'none';
                            e.target.textContent = 'Show Citation';
                        }
                    }
                }
                
                if (e.target.classList.contains('copy-citation')) {
                    const citationText = e.target.closest('.citation-content').querySelector('.citation-text').textContent;
                    navigator.clipboard.writeText(citationText).then(function() {
                        // Show success feedback
                        const originalText = e.target.innerHTML;
                        e.target.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
                        e.target.classList.remove('bg-green-500', 'hover:bg-green-600');
                        e.target.classList.add('bg-green-600');
                        
                        setTimeout(function() {
                            e.target.innerHTML = originalText;
                            e.target.classList.remove('bg-green-600');
                            e.target.classList.add('bg-green-500', 'hover:bg-green-600');
                        }, 2000);
                    }).catch(function(err) {
                        console.error('Failed to copy citation: ', err);
                        alert('Failed to copy citation. Please select and copy manually.');
                    });
                }
            });
        })
        .catch(error => {
            console.error('Error fetching or processing publications:', error);
            const container = document.getElementById('publications-container');
            if (container) {
                container.innerHTML = '<p class="text-red-500 text-center">Could not load publications. Please try again later.</p>';
            }
        });
});

// Function to generate APA citation
function generateCitation(pub) {
    const authors = pub.authors || 'Unknown authors';
    const year = pub.year || 'n.d.';
    const title = pub.title || 'Untitled';
    const journal = pub.journal || 'Unknown journal';
    
    // Format authors for APA style (simplified)
    let formattedAuthors = authors;
    if (authors.includes(' and ')) {
        const authorList = authors.split(' and ');
        if (authorList.length > 7) {
            formattedAuthors = authorList.slice(0, 6).join(', ') + ', ... ' + authorList[authorList.length - 1];
        } else {
            formattedAuthors = authorList.join(', ');
        }
    }
    
    return `${formattedAuthors} (${year}). ${title}. ${journal}.`;
} 