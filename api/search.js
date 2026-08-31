// api/search.js
const axios = require('axios');
const cheerio = require('cheerio');

// XVideos is relatively easy to scrape and allows direct video links
const BASE_URL = 'https://www.xvideos.com';

export default async function handler(req, res) {
  // Enable CORS for your frontend
  res.setHeader('Access-Control-Allow-Cors', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    // 1. Fetch the search page HTML
    const { data } = await axios.get(`${BASE_URL}/search/${encodeURIComponent(q)}/all/0`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(data);
    const videos = [];

    // 2. Iterate through search results
    $('.thumb-box').each((i, el) => {
      const title = $(el).find('.title a').text().trim();
      const thumb = $(el).find('.thumb img').attr('data-src') || $(el).find('.thumb img').attr('src');
      const link = $(el).find('.title a').attr('href');
      const duration = $(el).find('.thumb-overlay .duration').text().trim();

      // 3. Get the video page to find the direct URL
      // We do this here for simplicity. For high scale, you'd fetch the video page separately.
      const videoPageUrl = link.startsWith('http') ? link : `${BASE_URL}${link}`;

      (async () => {
        try {
          const { data: videoHtml } = await axios.get(videoPageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          const $video = cheerio.load(videoHtml);
          
          // Extract HLS (.m3u8) or Direct MP4
          // XVideos uses HLS for HD/4K
          const hlsUrl = $video('video source').filter(function() {
             return $(this).attr('src') && $(this).attr('src').includes('.m3u8');
          }).attr('src');

          const mp4Url = $video('video source').filter(function() {
             return $(this).attr('src') && !$(this).attr('src').includes('.m3u8');
          }).attr('src');

          // Clean URLs
          const cleanUrl = hlsUrl || mp4Url;
          if (cleanUrl) {
            videos.push({
              title,
              url: cleanUrl.startsWith('http') ? cleanUrl : `${BASE_URL}${cleanUrl}`,
              thumb: thumb,
              duration,
              type: hlsUrl ? 'hls' : 'mp4',
              externalLink: videoPageUrl
            });
          }
        } catch (err) {
          console.error(`Error fetching ${videoPageUrl}:`, err.message);
        }
      })();
    });

    // Wait a bit for async scraping to finish (simple approach for serverless)
    // For better performance, use Promise.all with a concurrency limit
    setTimeout(() => {
      res.json({ videos });
    }, 1000);

  } catch (error) {
    console.error('Search Error:', error.message);
    res.status(500).json({ error: 'Failed to search' });
  }
}
