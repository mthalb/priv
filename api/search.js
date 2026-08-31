// pages/api/search.js
import axios from 'axios';
import cheerio from 'cheerio';

const BASE_URL = 'https://www.xvideos.com';

// Tags to search for to ensure we get 20+ results
const SEARCH_TAGS = [
  'popular',      // Broad search
  'hot',          // Trending
  'best',         // Top rated
  'new',          // Newest
  'recent'        // Recently added
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  const query = q || 'popular';

  try {
    // 1. Fetch search results for multiple tags to ensure volume
    const searchPromises = SEARCH_TAGS.map(tag => 
      fetchSearchResults(`${query} ${tag}`)
    );
    
    const allResults = (await Promise.all(searchPromises)).flat();
    
    // 2. Deduplicate by URL
    const uniqueVideos = [...new Map(allResults.map(item => [item.url, item])).values()];
    
    // 3. Fetch actual video URLs from the video pages (up to 20)
    const enrichedVideos = [];
    for (const video of uniqueVideos) {
      if (enrichedVideos.length >= 20) break;
      
      try {
        const videoPageHtml = await fetchVideoPage(video.url);
        const videoUrl = extractVideoUrl(videoPageHtml);
        
        if (videoUrl) {
          enrichedVideos.push({
            ...video,
            videoUrl,
            thumb: video.thumb || `${BASE_URL}${extractThumbnailFromPage(videoPageHtml)}`
          });
        }
      } catch (err) {
        // Silently skip if a specific video page fails
      }
    }

    res.json({ videos: enrichedVideos });

  } catch (error) {
    console.error('Search Error:', error.message);
    res.status(500).json({ error: 'Failed to search', details: error.message });
  }
}

async function fetchSearchResults(query) {
  try {
    const searchUrl = `${BASE_URL}/?k=${encodeURIComponent(query)}`;
    const { data } = await axios.get(searchUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(data);
    const results = [];

    $('.thumb-box').each((i, el) => {
      const title = $(el).find('.title a').text().trim();
      const thumb = $(el).find('.thumb img').attr('data-src') || $(el).find('.thumb img').attr('src');
      const link = $(el).find('.title a').attr('href');
      const duration = $(el).find('.thumb-overlay .duration').text().trim();
      
      if (link && !link.includes('ads')) {
        results.push({
          title: title || 'Unknown',
          thumb: thumb || '',
          duration,
          url: link.startsWith('http') ? link : `${BASE_URL}${link}`
        });
      }
    });

    return results;
  } catch (err) {
    return [];
  }
}

async function fetchVideoPage(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    return data;
  } catch (err) {
    return '';
  }
}

function extractVideoUrl(html) {
  try {
    const $ = cheerio.load(html);
    
    // Try HLS first
    const hlsSource = $('video source').filter(function() {
       return $(this).attr('src') && $(this).attr('src').includes('.m3u8');
    }).attr('src');

    if (hlsSource) {
      return hlsSource.startsWith('http') ? hlsSource : `${BASE_URL}${hlsSource}`;
    }

    // Try MP4
    const mp4Source = $('video source').filter(function() {
       return $(this).attr('src') && !$(this).attr('src').includes('.m3u8');
    }).attr('src');
    
    if (mp4Source) {
      return mp4Source.startsWith('http') ? mp4Source : `${BASE_URL}${mp4Source}`;
    }

    return null;
  } catch (err) {
    return null;
  }
}

function extractThumbnailFromPage(html) {
  try {
    const $ = cheerio.load(html);
    const thumb = $('meta[property="og:image"]').attr('content') || 
                  $('video').attr('poster') || 
                  $('.bigThumb img').attr('data-src');
    return thumb || '';
  } catch (err) {
    return '';
  }
}
