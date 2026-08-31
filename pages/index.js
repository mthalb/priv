import { useState } from 'react';
import Head from 'next/head';
import axios from 'axios';

// Styles can be in a separate CSS file, but keeping it inline for simplicity in this single file
// For a repo, move the CSS below to pages/globals.css and import it here.

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#121212',
    color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  header: {
    position: 'sticky',
    top: 0,
    backgroundColor: '#2c2c2c',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
    zIndex: 1000,
  },
  input: {
    padding: '10px',
    fontSize: '16px',
    border: '1px solid #444',
    borderRadius: '4px',
    backgroundColor: '#333',
    color: 'white',
    width: '300px',
    marginRight: '10px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#bb86fc',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#000',
    fontWeight: 'bold',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '15px',
    padding: '20px',
  },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative',
    transition: 'transform 0.2s',
    aspectRatio: '1 / 1',
    cursor: 'pointer',
  },
  cardHover: {
    transform: 'scale(1.03)',
    zIndex: 10,
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  loader: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    fontSize: '20px',
    color: '#bb86fc',
  },
  error: {
    textAlign: 'center',
    color: '#ff6b6b',
    padding: '20px',
  },
};

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hoveredId, setHoveredId] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResults([]);

    try {
      // Call the internal API route
      const response = await axios.post('/api/search', { query });
      
      // Filter out invalid items
      const validItems = response.data.items.filter(item => 
        item.links || item.content
      );

      setResults(validItems);
    } catch (err) {
      setError('Failed to fetch results. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (url) => {
    window.open(url, '_blank');
  };

  return (
    <div style={styles.container}>
      <Head>
        <title>NSFW Aggregator</title>
        <meta name="description" content="Search and view NSFW content" />
      </Head>

      <header style={styles.header}>
        <form onSubmit={handleSearch} style={{ display: 'flex' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search NSFW (e.g., nsfw, anime, etc.)"
            style={styles.input}
          />
          <button type="submit" style={styles.button}>
            Search
          </button>
        </form>
      </header>

      {loading && <div style={styles.loader}>Loading...</div>}
      
      {error && <div style={styles.error}>{error}</div>}

      {!loading && results.length > 0 && (
        <div style={styles.grid}>
          {results.map((item, index) => {
            // Helper to extract media URL
            let mediaUrl = null;
            let mediaType = 'image'; // default

            // Check links for image/video
            if (item.links) {
              const imgLink = item.links.find(l => 
                l.href && /\.(jpg|jpeg|png|gif|webp)$/i.test(l.href)
              );
              const videoLink = item.links.find(l => 
                l.href && /\.(mp4|webm|mov)$/i.test(l.href)
              );

              if (videoLink) {
                mediaUrl = videoLink.href;
                mediaType = 'video';
              } else if (imgLink) {
                mediaUrl = imgLink.href;
                mediaType = 'image';
              }
            }

            // Fallback: Try to extract image from content (HTML string)
            if (!mediaUrl && item.content) {
              try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(item.content, 'text/html');
                const img = doc.querySelector('img');
                if (img) {
                  mediaUrl = img.src || img.dataset.src;
                  mediaType = 'image';
                }
              } catch (e) {
                // ignore parse errors
              }
            }

            // Skip items with no media
            if (!mediaUrl) return null;

            const cardStyle = {
              ...styles.card,
              ...(hoveredId === index ? styles.cardHover : {}),
            };

            return (
              <div
                key={index}
                style={cardStyle}
                onClick={() => handleCardClick(item.url || item.link)}
                onMouseEnter={() => setHoveredId(index)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {mediaType === 'image' ? (
                  <img 
                    src={mediaUrl} 
                    alt={item.title || 'Content'} 
                    style={styles.img}
                    loading="lazy"
                  />
                ) : (
                  <video
                    src={mediaUrl}
                    muted
                    loop
                    autoPlay
                    playsInline
                    style={styles.img}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && results.length === 0 && !error && query && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
          No results found.
        </div>
      )}
    </div>
  );
}
