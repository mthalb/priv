// api/search.js
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.xvideos.com';

export default async function handler(req, res) {
  // Allow CORS for frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    // ✅ Use the correct search URL: ?k=query
    const searchUrl = `${BASE_URL}/?k=${encodeURIComponent(q)}`;
    
    const { data } = await axios.get(searchUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000 // Increased timeout to 15s
    });

    const $ = cheerio.load(data);
    const videoLinks = [];

    // Parse search results based on the HTML structure of the search page
    $('.thumb-box').each((i, el) => {
      const title = $(el).find('.title a').text().trim();
      // Get thumbnail image (lazy loading uses data-src)
      const thumb = $(el).find('.thumb img').attr('data-src') || $(el).find('.thumb img').attr('src');
      const link = $(el).find('.title a').attr('href');
      const duration = $(el).find('.thumb-overlay .duration').text().trim();
      
      if (link && !link.includes('ads')) {
        videoLinks.push({
          title,
          thumb: thumb || '/placeholder.jpg',
          duration,
          url: link.startsWith('http') ? link : `${BASE_URL}${link}`
        });
      }
    });

    // Fetch video pages in parallel to extract the actual video source
    const promises = videoLinks.map(async (video) => {
      try {
        const { data: videoHtml } = await axios.get(video.url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 5000
        });
        const $video = cheerio.load(videoHtml);
        
        let videoUrl = null;
        
        // Try HLS (m3u8) first
        const hlsSource = $video('video source').filter(function() {
           return $(this).attr('src') && $(this).attr('src').includes('.m3u8');
        }).attr('src');

        if (hlsSource) {
          videoUrl = hlsSource.startsWith('http') ? hlsSource : `${BASE_URL}${hlsSource}`;
        } else {
          // Try MP4
          const mp4Source = $video('video source').filter(function() {
             return $(this).attr('src') && !$(this).attr('src').includes('.m3u8');
          }).attr('src');
          
          if (mp4Source) {
            videoUrl = mp4Source.startsWith('http') ? mp4Source : `${BASE_URL}${mp4Source}`;
          }
        }

        if (videoUrl) {
          return {
            title: video.title,
            url: videoUrl,
            thumb: video.thumb,
            duration: video.duration,
            type: hlsSource ? 'hls' : 'mp4',
            externalLink: video.url
          };
        }
      } catch (err) {
        // Silently fail for individual videos
      }
      return null;
    });

    const results = (await Promise.all(promises)).filter(Boolean);
    res.json({ videos: results });

  } catch (error) {
    console.error('Search Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to search', 
      details: error.message,
      url: `${BASE_URL}/?k=${encodeURIComponent(q)}`
    });
  }
}
