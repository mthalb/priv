// pages/index.js
import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import HLS from 'hls.js';

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const search = async () => {
    if (!searchTerm) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();
      setVideos(data.videos);
    } catch (error) {
      console.error('Search failed:', error);
    }
    setLoading(false);
  };

  const handlePlay = (video) => {
    setSelectedVideo(video);
    // Reset HLS instance if it exists
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }
    
    // Small delay to allow DOM to update
    setTimeout(() => {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      if (HLS.isSupported() && video.videoUrl.includes('.m3u8')) {
        const hls = new HLS();
        hls.loadSource(video.videoUrl);
        hls.attachMedia(videoElement);
        hls.on(HLS.Events.MANIFEST_PARSED, () => {
          videoElement.play();
        });
        hlsRef.current = hls;
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        videoElement.src = video.videoUrl;
        videoElement.addEventListener('loadedmetadata', () => {
          videoElement.play();
        });
      } else {
        // Fallback to direct MP4
        videoElement.src = video.videoUrl;
        videoElement.play();
      }
    }, 100);
  };

  const stopPlayer = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setSelectedVideo(null);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', color: '#fff', fontFamily: 'sans-serif' }}>
      <Head>
        <title>NSFW Video Aggregator</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#1e1e1e', padding: '1rem',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
      }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search NSFW videos..."
          style={{
            padding: '10px', fontSize: '16px', border: '1px solid #444',
            borderRadius: '4px', background: '#333', color: '#fff', width: '300px'
          }}
        />
        <button
          onClick={search}
          style={{
            padding: '10px 20px', fontSize: '16px', background: '#bb86fc',
            border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#000', fontWeight: 'bold'
          }}
        >
          Search
        </button>
      </header>

      {/* Video Player Modal */}
      {selectedVideo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ width: '90%', maxWidth: '800px', position: 'relative' }}>
            <button
              onClick={stopPlayer}
              style={{
                position: 'absolute', top: '-30px', right: '0',
                background: 'red', color: '#fff', border: 'none',
                padding: '5px 10px', cursor: 'pointer', borderRadius: '4px'
              }}
            >
              Close
            </button>
            <video
              ref={videoRef}
              controls
              autoPlay
              style={{ width: '100%', aspectRatio: '16/9', background: '#000' }}
            />
            <h3 style={{ marginTop: '10px', textAlign: 'center' }}>{selectedVideo.title}</h3>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main style={{ padding: '20px' }}>
        {loading && <p style={{ textAlign: 'center' }}>Loading videos...</p>}
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '15px'
        }}>
          {videos.map((video, index) => (
            <div
              key={`${video.url}-${index}`}
              onClick={() => handlePlay(video)}
              style={{
                position: 'relative', aspectRatio: '16/9',
                borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
                backgroundColor: '#1e1e1e', transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <img
                src={video.thumb}
                alt={video.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute', bottom: '5px', right: '5px',
                background: 'rgba(0,0,0,0.7)', color: '#fff',
                padding: '2px 5px', fontSize: '12px', borderRadius: '4px'
              }}>
                {video.duration}
              </div>
              <div style={{
                position: 'absolute', bottom: '0', left: '0', right: '0',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                padding: '20px 10px 10px', fontSize: '14px'
              }}>
                {video.title}
              </div>
            </div>
          ))}
        </div>

        {videos.length === 0 && !loading && (
          <p style={{ textAlign: 'center', color: '#666' }}>Search for a term to see videos.</p>
        )}
      </main>
    </div>
  );
}
