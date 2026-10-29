// Civic Resolve AI: Official Civic Knowledge Base & Citations API
// Enforces PRD Section 4: Verified statutory grounding, zero hallucination, explicit fallback.

const express = require('express');
const router = express.Router();
const db = require('../db');

// List of common search stop words to filter out
const STOP_WORDS = new Set([
  'what', 'is', 'the', 'a', 'an', 'and', 'or', 'how', 'to', 'for', 'of', 'in', 'on', 'at', 'by',
  'with', 'about', 'can', 'i', 'do', 'does', 'my', 'me', 'we', 'our', 'you', 'your', 'it', 'its'
]);

function tokenizeQuery(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

// --------------------------------------------------------------------------
// 1. GET /api/knowledge (Search and list verified articles)
// --------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;

    let query = `
      SELECT id, title, category, content, official_source, last_verified, created_at
      FROM knowledge_articles
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== 'all') {
      query += ` AND LOWER(category) LIKE ? `;
      params.push(`%${category.toLowerCase().trim()}%`);
    }

    if (search && search.trim()) {
      const term = `%${search.toLowerCase().trim()}%`;
      query += ` AND (LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(official_source) LIKE ?) `;
      params.push(term, term, term);
    }

    query += ` ORDER BY id ASC `;

    const articles = await db.all(query, params);

    res.json({
      governance: 'PRD Section 4 Verified Municipal Knowledge — Zero Simulated Citations',
      total: articles.length,
      articles
    });
  } catch (err) {
    console.error('[Knowledge Error]', err);
    res.status(500).json({ error: 'Failed to retrieve civic knowledge articles.' });
  }
});

// --------------------------------------------------------------------------
// 2. POST /api/knowledge/ask (Grounded statutory Q&A with mandatory fallback)
// --------------------------------------------------------------------------
router.post('/ask', async (req, res) => {
  try {
    const { query } = req.body;

    // Strict input validation
    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return res.status(400).json({
        error: 'A valid question or search query is required (minimum 3 characters).'
      });
    }

    const cleanQuery = query.trim();
    const queryLower = cleanQuery.toLowerCase();
    const tokens = tokenizeQuery(cleanQuery);

    const allArticles = await db.all(`
      SELECT id, title, category, content, official_source, last_verified
      FROM knowledge_articles
    `);

    // Score articles against search tokens
    let bestArticle = null;
    let highestScore = 0;

    for (const art of allArticles) {
      let score = 0;
      const titleLower = art.title.toLowerCase();
      const contentLower = art.content.toLowerCase();
      const catLower = art.category.toLowerCase();

      // Exact substring match in title or category (high signal)
      if (titleLower.includes(queryLower)) score += 50;
      if (catLower.includes(queryLower)) score += 35;
      if (contentLower.includes(queryLower)) score += 25;

      // Token matches
      for (const tok of tokens) {
        if (titleLower.includes(tok)) score += 15;
        if (catLower.includes(tok)) score += 10;
        if (contentLower.includes(tok)) score += 5;
      }

      if (score > highestScore) {
        highestScore = score;
        bestArticle = art;
      }
    }

    // PRD Section 4 Mandatory Rule:
    // If no article matches with sufficient confidence (score < 15),
    // NEVER hallucinate or fabricate civic advice! Return explicit fallback.
    if (!bestArticle || highestScore < 15) {
      return res.json({
        answered: false,
        query: cleanQuery,
        message: 'No verified municipal citation found for this query.',
        officialHelpline: '040-21111111',
        officialRecourse: 'Please contact your local Ward Secretariat or dial the central municipal helpline. In compliance with Civic Resolve AI data governance, our system refuses to fabricate civic advice when no official municipal statute, act, or circular can be cited.',
        matchedArticles: []
      });
    }

    return res.json({
      answered: true,
      query: cleanQuery,
      relevanceScore: highestScore,
      title: bestArticle.title,
      category: bestArticle.category,
      answer: bestArticle.content,
      citation: {
        officialSource: bestArticle.official_source,
        lastVerified: bestArticle.last_verified,
        authority: 'Municipal Statutory Secretariat'
      },
      matchedArticles: [
        {
          id: bestArticle.id,
          title: bestArticle.title,
          category: bestArticle.category,
          officialSource: bestArticle.official_source
        }
      ]
    });
  } catch (err) {
    console.error('[Knowledge Ask Error]', err);
    res.status(500).json({ error: 'Failed to process knowledge inquiry.' });
  }
});

module.exports = router;
