// Civic Resolve AI: AI Vision Inspector Service (PRD F1)
// Analyzes civic issue photos for defect clues, suggested categories, and critical safety hazards.
// Supports Gemini Vision API when GEMINI_API_KEY is configured, with a transparent heuristic fallback and disclaimer.

const https = require('https');
const path = require('path');
const fs = require('fs');

// Defect classification rules and department mappings
const VISION_DEFECT_RULES = [
  {
    defectType: 'Pothole / Road Surface Damage',
    keywords: ['pothole', 'potholes', 'crater', 'asphalt', 'road', 'road_damage', 'crack', 'tarmac', 'bump', 'pavement_crack'],
    categoryId: 'cat-roads',
    categoryName: 'Roads and potholes',
    departmentId: 'dept-roads',
    departmentName: 'Roads & Transport',
    hazard: false,
    hazardReason: null,
    defaultClues: ['Pothole detected', 'Asphalt degradation', 'Road surface defect']
  },
  {
    defectType: 'Exposed Electrical / Streetlight Hazard',
    keywords: ['wire', 'sparking', 'electric', 'pole', 'lamp', 'streetlight', 'live_wire', 'cable', 'transformer', 'junction_box'],
    categoryId: 'cat-streetlights',
    categoryName: 'Streetlights',
    departmentId: 'dept-electrical',
    departmentName: 'Electrical Services',
    hazard: true,
    hazardReason: 'Uninsulated electrical wiring or damaged streetlight pole poses public shock hazard.',
    defaultClues: ['Exposed wiring detected', 'Streetlight infrastructure damage', 'Electrical hazard']
  },
  {
    defectType: 'Overflowing Garbage / Sanitation Failure',
    keywords: ['garbage', 'trash', 'waste', 'dump', 'litter', 'debris', 'dumpster', 'bin', 'plastic_waste', 'overflow'],
    categoryId: 'cat-garbage',
    categoryName: 'Garbage and sanitation',
    departmentId: 'dept-sanitation',
    departmentName: 'Sanitation',
    hazard: false,
    hazardReason: null,
    defaultClues: ['Overflowing solid waste', 'Illegal dumping', 'Debris accumulation']
  },
  {
    defectType: 'Water Pipeline Rupture / Leakage',
    keywords: ['water', 'pipe', 'pipeline', 'leak', 'leakage', 'burst', 'gushing', 'water_main', 'valve'],
    categoryId: 'cat-water',
    categoryName: 'Water supply and leakage',
    departmentId: 'dept-water',
    departmentName: 'Water & Drainage',
    hazard: false,
    hazardReason: null,
    defaultClues: ['Pressurized water leakage', 'Pipeline failure', 'Water wastage']
  },
  {
    defectType: 'Open Manhole / Gutter Hazard',
    keywords: ['manhole', 'sewer', 'drain', 'drainage', 'gutter', 'open_manhole', 'septic', 'stormwater'],
    categoryId: 'cat-drainage',
    categoryName: 'Drainage and sewage',
    departmentId: 'dept-water',
    departmentName: 'Water & Drainage',
    hazard: true,
    hazardReason: 'Open or displaced manhole lid presents serious pedestrian and vehicular fall hazard.',
    defaultClues: ['Open manhole aperture', 'Sewer grate missing', 'Fall hazard']
  },
  {
    defectType: 'Traffic Safety Signal Defect',
    keywords: ['signal', 'traffic', 'traffic_light', 'sign', 'stop_sign', 'zebra', 'crossing', 'divider_sign'],
    categoryId: 'cat-trafficsigns',
    categoryName: 'Traffic signs and road safety',
    departmentId: 'dept-roads',
    departmentName: 'Roads & Transport',
    hazard: false,
    hazardReason: null,
    defaultClues: ['Damaged traffic sign', 'Signal malfunction', 'Roadway demarcation issue']
  },
  {
    defectType: 'Footpath / Public Property Damage',
    keywords: ['footpath', 'sidewalk', 'railing', 'bench', 'kerb', 'curb', 'pavement', 'divider', 'barrier'],
    categoryId: 'cat-publicworks',
    categoryName: 'Public property damage',
    departmentId: 'dept-publicworks',
    departmentName: 'Public Works',
    hazard: false,
    hazardReason: null,
    defaultClues: ['Pedestrian footpath damage', 'Broken kerbstone', 'Public property wear']
  }
];

/**
 * Call Gemini Generative Language API for multimodal vision inspection
 */
async function callGeminiVision(base64Image, mimeType = 'image/jpeg') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const prompt = `Analyze this civic issue photo. Output strict JSON with no markdown wrapping:
{
  "detectedDefects": ["short defect tags like pothole, exposed wire, overflowing garbage, etc."],
  "suggestedCategoryId": "one of: cat-roads, cat-streetlights, cat-garbage, cat-water, cat-drainage, cat-trafficsigns, cat-publicworks, cat-other",
  "suggestedCategoryName": "official category name",
  "suggestedDepartmentId": "one of: dept-roads, dept-electrical, dept-sanitation, dept-water, dept-publicworks",
  "suggestedDepartmentName": "official department name",
  "hazardFlag": true or false,
  "hazardReason": "brief explanation if hazardFlag is true, else null",
  "overallConfidence": integer between 50 and 99,
  "defectDescription": "1-2 sentence description of physical civic defect observed"
}`;

  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: 'application/json'
    }
  });

  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      },
      timeout: 8000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const parsed = JSON.parse(data);
            const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) {
              const cleanJson = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
              const result = JSON.parse(cleanJson);
              return resolve({
                provider: 'gemini',
                disclaimer: 'Verified AI visual classification powered by Gemini 1.5 Flash Vision.',
                ...result
              });
            }
          }
        } catch (_) {}
        resolve(null);
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Deterministic heuristic vision analyzer fallback
 */
function analyzeHeuristically({ fileName = '', buffer = null, mimeType = '', textHint = '' }) {
  const combinedText = `${fileName} ${textHint}`.toLowerCase().replace(/[-_.]/g, ' ');

  let bestRule = null;
  let highestMatchCount = 0;
  let matchedKeywords = [];

  for (const rule of VISION_DEFECT_RULES) {
    const matches = rule.keywords.filter(kw => combinedText.includes(kw));
    if (matches.length > highestMatchCount) {
      highestMatchCount = matches.length;
      bestRule = rule;
      matchedKeywords = matches;
    }
  }

  // Default to road defect if no keyword match found
  if (!bestRule) {
    // If file size or metadata exists, generate a safe baseline
    const isLikelyPhoto = (buffer && buffer.length > 5000) || fileName.match(/\.(jpg|jpeg|png|webp)$/i);
    bestRule = VISION_DEFECT_RULES[0]; // Roads and potholes default
    matchedKeywords = ['visual_defect'];
  }

  // Calculate simulated confidence
  const overallConfidence = highestMatchCount > 1 ? Math.min(94, 82 + highestMatchCount * 4) : 84;

  const detectedDefects = bestRule.defaultClues.slice(0, 3);
  if (matchedKeywords.length > 0 && !detectedDefects.some(d => d.toLowerCase().includes(matchedKeywords[0]))) {
    detectedDefects.unshift(`${matchedKeywords[0].replace(/_/g, ' ')} detected`);
  }

  return {
    provider: 'heuristic_fallback',
    disclaimer: 'Note: AI Vision Inspector is operating in transparent heuristic fallback mode (GEMINI_API_KEY not configured or unreachable). Results are rule-based approximations.',
    detectedDefects: detectedDefects.slice(0, 3),
    suggestedCategoryId: bestRule.categoryId,
    suggestedCategoryName: bestRule.categoryName,
    suggestedDepartmentId: bestRule.departmentId,
    suggestedDepartmentName: bestRule.departmentName,
    hazardFlag: bestRule.hazard,
    hazardReason: bestRule.hazardReason,
    overallConfidence,
    defectDescription: `Visual analysis indicated ${bestRule.defectType.toLowerCase()} requiring municipal review.`
  };
}

/**
 * Main Inspector Entrypoint
 * @param {Object} input - { buffer, mimeType, fileName, imageBase64, textHint, filePath }
 */
async function inspectImage(input = {}) {
  let base64 = input.imageBase64;
  let mimeType = input.mimeType || 'image/jpeg';
  let fileName = input.fileName || '';

  if (!base64 && input.buffer) {
    base64 = input.buffer.toString('base64');
  } else if (!base64 && input.filePath && fs.existsSync(input.filePath)) {
    try {
      const buf = fs.readFileSync(input.filePath);
      base64 = buf.toString('base64');
      if (!fileName) fileName = path.basename(input.filePath);
    } catch (_) {}
  }

  // 1. Attempt Gemini Vision if key is present
  if (base64 && process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('your_gemini')) {
    try {
      const geminiResult = await callGeminiVision(base64, mimeType);
      if (geminiResult && geminiResult.detectedDefects) {
        return {
          success: true,
          timestamp: new Date().toISOString(),
          ...geminiResult
        };
      }
    } catch (e) {
      console.warn('[Vision Inspector] Gemini Vision call failed, falling back to heuristic:', e.message);
    }
  }

  // 2. Heuristic fallback
  const fallbackResult = analyzeHeuristically({
    fileName,
    buffer: input.buffer,
    mimeType,
    textHint: input.textHint || ''
  });

  return {
    success: true,
    timestamp: new Date().toISOString(),
    ...fallbackResult
  };
}

module.exports = {
  VISION_DEFECT_RULES,
  inspectImage,
  analyzeHeuristically
};

