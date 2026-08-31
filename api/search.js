// api/search.js
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.xvideos.com';

export default async function handler(req, res) {
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
    // 1. Fetch search results page
    const { data } = await axios.get(`${BASE_URL}/search/${encodeURIComponent(q)}/all/0`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(data);
    const videoLinks = [];

    // Collect all video page URLs first
    $('.thumb-box').each((i, el) => {
      const title = $(el).find('.title a').text().trim();
      const thumb = $(el).find('.thumb img').attr('data-src') || $(el).find('.thumb img').attr('src');
      const link = $(el).find('.title a').attr('href');
      const duration = $(el).find('.thumb-overlay .duration').text().trim();
      
      if (link) {
        videoLinks.push({
          title,
          thumb,
          duration,
          url: link.startsWith('http') ? link : `${BASE_URL}${link}`
        });
      }
    });

    // 2. Fetch each video page in parallel for speed
    const promises = videoLinks.map(async (video) => {
      try {
        const { data: videoHtml } = await axios.get(video.url, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $video = cheerio.load(videoHtml);
        
        // Look for HLS (m3u8) or Direct MP4
        const hlsSource = $video('video source').filter(function() {
           return $(this).attr('src') && $(this).attr('src').includes('.m3u8');
        }).attr('src');

        const mp4Source = $video('video source').filter(function() {
           return $(this).attr('src') && !$(this).attr('src').includes('.m3u8');
        }).attr('src');

        const cleanUrl = hlsSource || mp4Source;
        
        if (cleanUrl) {
          return {
            title: video.title,
            url: cleanUrl.startsWith('http') ? cleanUrl : `${BASE_URL}${cleanUrl}`,
            thumb: video.thumb,
            duration: video.duration,
            type: hlsSource ? 'hls' : 'mp4',
            externalLink: video.url
          };
        }
      } catch (err) {
        console.error(`Failed to fetch ${video.url}:`, err.message);
      }
      return null;
    });

    const results = (await Promise.all(promises)).filter(Boolean);
    res.json({ videos: results });

  } catch (error) {
    console.error('Main Search Error:', error.message);
    res.status(500).json({ error: 'Failed to search', details: error.message });
  }
}
