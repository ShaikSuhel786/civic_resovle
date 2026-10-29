// Civic Resolve AI: Deterministic Simulated AI Analyzer
// Implements PRD FR-04 and DESIGN Screen 3 & 5 requirements

const CATEGORY_RULES = [
  {
    id: 'cat-roads',
    name: 'Roads and potholes',
    departmentId: 'dept-roads',
    departmentName: 'Roads & Transport',
    keywords: ['pothole', 'potholes', 'crater', 'asphalt', 'road damage', 'damaged road', 'tar', 'speed breaker', 'bump', 'divider', 'road surface', 'uneven road', 'road cave-in']
  },
  {
    id: 'cat-streetlights',
    name: 'Streetlights',
    departmentId: 'dept-electrical',
    departmentName: 'Electrical Services',
    keywords: ['streetlight', 'streetlights', 'street light', 'lamp post', 'dark street', 'pole', 'light not working', 'bulb', 'sparking wire', 'hanging wire', 'electric pole', 'street lamp', 'lighting']
  },
  {
    
    
    id: 'cat-garbage',
    name: 'Garbage and sanitation',
    departmentId: 'dept-sanitation',
    departmentName: 'Sanitation',
    keywords: ['garbage', 'trash', 'waste', 'dump', 'debris', 'litter', 'overflowing bin', 'foul smell', 'dead animal', 'cleaning', 'dumpster', 'sanitation', 'plastic waste']
  },
  {
    id: 'cat-water',
    name: 'Water supply and leakage',
    departmentId: 'dept-water',
    departmentName: 'Water & Drainage',
    keywords: ['water pipe', 'pipeline leak', 'water leakage', 'no water', 'low pressure', 'drinking water', 'burst pipe', 'water wasting', 'pipe burst', 'water main', 'contaminated water']
  },
  {
    id: 'cat-drainage',
    name: 'Drainage and sewage',
    departmentId: 'dept-water',
    departmentName: 'Water & Drainage',
    keywords: ['drainage', 'sewage', 'sewer', 'manhole', 'overflow', 'clogged drain', 'gutter', 'stagnant water', 'blocked drain', 'septic', 'drain overflow', 'open gutter']
  },
  {
    id: 'cat-publicworks',
    name: 'Public property damage',
    departmentId: 'dept-publicworks',
    departmentName: 'Public Works',
    keywords: ['footpath', 'pavement', 'railing', 'park bench', 'bus shelter', 'broken wall', 'public property', 'sidewalk', 'curb', 'median barrier', 'pedestrian subway']
  },
  {
    id: 'cat-trafficsigns',
    name: 'Traffic signs and road safety',
    departmentId: 'dept-roads',
    departmentName: 'Roads & Transport',
    keywords: ['traffic signal', 'traffic light', 'stop sign', 'zebra crossing', 'missing sign', 'broken signal', 'road sign', 'signal not working', 'speed limit sign', 'reflective marker']
  }
];

const HAZARD_RULES = [
  { keyword: 'sparking', reason: 'High voltage electrical sparking hazard' },
  { keyword: 'exposed wire', reason: 'Uninsulated live electrical wire exposed to public' },
  { keyword: 'live wire', reason: 'Live wire in pedestrian or vehicular pathway' },
  { keyword: 'electric shock', reason: 'Reported electric current leakage or shock risk' },
  { keyword: 'open manhole', reason: 'Uncovered deep manhole posing fatal fall hazard' },
  { keyword: 'gas leak', reason: 'Potential combustible gas leakage reported' },
  { keyword: 'sinkhole', reason: 'Active ground collapse or sinkhole' },
  { keyword: 'building collapse', reason: 'Structural instability or falling masonry risk' },
  { keyword: 'toxic', reason: 'Hazardous or toxic substance spill' },
  { keyword: 'deep crater', reason: 'Severe road crater causing acute vehicular hazard' },
  { keyword: 'flooding', reason: 'Severe street flooding impeding movement or submerging hazards' }
];

// Haversine formula to compute distance in meters
function computeDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371e3; // Earth radius in meters
  const toRad = deg => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Tokenize text for similarity calculation
function getTokens(text) {
  return (text || '').toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function calculateJaccardSimilarity(text1, text2) {
  const set1 = new Set(getTokens(text1));
  const set2 = new Set(getTokens(text2));
  if (set1.size === 0 || set2.size === 0) return 0;
  
  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }
  const union = new Set([...set1, ...set2]).size;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

/**
 * Deterministic Simulated AI Analyzer
 * @param {Object} reportInput - { description, userCategoryId, latitude, longitude, locationText }
 * @param {Array} existingReports - List of existing reports for duplicate candidate detection
 * @returns {Object} Deterministic analysis result
 */
function analyzeReport(reportInput, existingReports = []) {
  const text = (reportInput.description || '').toLowerCase();
  
  // 1. Detect Category & Department
  let bestCategory = null;
  let maxKeywordMatches = 0;
  let matchedKeywords = [];

  for (const cat of CATEGORY_RULES) {
    const matches = cat.keywords.filter(kw => text.includes(kw));
    if (matches.length > maxKeywordMatches) {
      maxKeywordMatches = matches.length;
      bestCategory = cat;
      matchedKeywords = matches;
    }
  }

  // Calculate Heuristic Confidence (0 - 100)
  let confidenceScore = 60;
  let suggestedCategoryId = null;
  let suggestedDepartmentId = null;
  let analysisReasoning = '';

  if (bestCategory && maxKeywordMatches >= 2) {
    confidenceScore = Math.min(95, 75 + maxKeywordMatches * 8);
    suggestedCategoryId = bestCategory.id;
    suggestedDepartmentId = bestCategory.departmentId;
    analysisReasoning = `Strong keyword match (${matchedKeywords.join(', ')}) identified category as ${bestCategory.name} under ${bestCategory.departmentName}.`;
  } else if (bestCategory && maxKeywordMatches === 1) {
    confidenceScore = 78; // Just below 80 threshold -> triggers Admin review
    suggestedCategoryId = bestCategory.id;
    suggestedDepartmentId = bestCategory.departmentId;
    analysisReasoning = `Moderate match (${matchedKeywords[0]}) for ${bestCategory.name}. Administrator review recommended.`;
  } else {
    confidenceScore = 55;
    suggestedCategoryId = 'cat-other';
    suggestedDepartmentId = null;
    analysisReasoning = 'Uncertain classification. Issue contains non-standard civic terminology; requires Admin routing.';
  }

  // If user explicitly selected a category that differs from AI suggestion, adjust review
  if (reportInput.userCategoryId && reportInput.userCategoryId !== suggestedCategoryId) {
    confidenceScore = Math.max(50, confidenceScore - 15);
    analysisReasoning += ` (Citizen selected different category, manual review flagged).`;
  }

  // 2. Detect Serious Safety Hazards
  let safetyFlag = 0;
  let safetyFlagReason = null;
  for (const hazard of HAZARD_RULES) {
    if (text.includes(hazard.keyword)) {
      safetyFlag = 1;
      safetyFlagReason = `CRITICAL HAZARD: ${hazard.reason} (keyword '${hazard.keyword}')`;
      break;
    }
  }

  // 3. Deterministic Priority Factors (0 - 100)
  // Severity Factor
  let severityFactor = 50;
  if (text.includes('huge') || text.includes('severe') || text.includes('massive') || text.includes('burst') || text.includes('completely blocked') || text.includes('deep')) {
    severityFactor = 85;
  } else if (text.includes('minor') || text.includes('small') || text.includes('slight')) {
    severityFactor = 30;
  }

  // Safety Risk Factor
  let safetyRiskFactor = safetyFlag ? 95 : 40;
  if (!safetyFlag) {
    if (text.includes('accident') || text.includes('injured') || text.includes('danger') || text.includes('falling') || text.includes('risk')) {
      safetyRiskFactor = 80;
    } else if (text.includes('safe') || text.includes('no immediate danger')) {
      safetyRiskFactor = 20;
    }
  }

  // People Affected Factor
  let peopleAffectedFactor = 60;
  if (text.includes('main road') || text.includes('junction') || text.includes('school') || text.includes('hospital') || text.includes('market') || text.includes('metro') || text.includes('highway') || text.includes('busy')) {
    peopleAffectedFactor = 90;
  } else if (text.includes('colony') || text.includes('residential') || text.includes('lane')) {
    peopleAffectedFactor = 55;
  } else if (text.includes('isolated') || text.includes('alley') || text.includes('dead end')) {
    peopleAffectedFactor = 30;
  }

  // Issue Duration Factor
  let issueDurationFactor = 45;
  if (text.includes('month') || text.includes('weeks') || text.includes('months')) {
    issueDurationFactor = 85;
  } else if (text.includes('days') || text.includes('since 2 days') || text.includes('few days')) {
    issueDurationFactor = 60;
  } else if (text.includes('today') || text.includes('just now') || text.includes('hours')) {
    issueDurationFactor = 35;
  }

  // Exact PRD Priority Formula:
  // Priority = 0.40 * Severity + 0.30 * SafetyRisk + 0.20 * PeopleAffected + 0.10 * IssueDuration
  const rawPriority = (
    0.40 * severityFactor +
    0.30 * safetyRiskFactor +
    0.20 * peopleAffectedFactor +
    0.10 * issueDurationFactor
  );
  const priorityScore = Math.min(100, Math.max(0, Math.round(rawPriority)));

  let priorityLevel = 'Medium';
  if (priorityScore >= 85 || safetyFlag) {
    priorityLevel = 'Urgent';
  } else if (priorityScore >= 70) {
    priorityLevel = 'High';
  } else if (priorityScore >= 40) {
    priorityLevel = 'Medium';
  } else {
    priorityLevel = 'Low';
  }

  // 4. Duplicate Candidate Matching
  const duplicateCandidates = [];
  if (Array.isArray(existingReports) && existingReports.length > 0) {
    for (const other of existingReports) {
      if (other.id === reportInput.id) continue;
      
      const textSim = calculateJaccardSimilarity(reportInput.description, other.description);
      let distMeters = null;
      if (reportInput.latitude && reportInput.longitude && other.latitude && other.longitude) {
        distMeters = computeDistanceMeters(reportInput.latitude, reportInput.longitude, other.latitude, other.longitude);
      }

      const sameCategory = other.category_id && suggestedCategoryId && (other.category_id === suggestedCategoryId);
      
      let candidateMatch = false;
      let matchScore = textSim;
      let rationale = '';

      if (distMeters !== null && distMeters <= 300 && (textSim >= 35 || sameCategory)) {
        candidateMatch = true;
        matchScore = Math.max(matchScore, Math.round(85 - (distMeters / 10)));
        rationale = `Located within ${distMeters}m with similar civic context.`;
      } else if (textSim >= 65) {
        candidateMatch = true;
        matchScore = textSim;
        rationale = `High textual similarity (${textSim}%) in description.`;
      }

      if (candidateMatch) {
        duplicateCandidates.push({
          id: other.id,
          referenceNumber: other.reference_number,
          title: other.title,
          categoryName: other.category_name || 'Civic Issue',
          locationText: other.location_text,
          distanceMeters: distMeters,
          similarityScore: matchScore,
          rationale
        });
      }
    }
  }

  // Sort duplicate candidates by highest similarity
  duplicateCandidates.sort((a, b) => b.similarityScore - a.similarityScore);

  // 5. Review Required Logic
  const reviewRequired = (confidenceScore < 80 || safetyFlag === 1 || suggestedCategoryId === 'cat-other' || !suggestedDepartmentId) ? 1 : 0;
  let reviewReason = null;
  if (safetyFlag) {
    reviewReason = `Urgent Hazard Review: ${safetyFlagReason}`;
  } else if (confidenceScore < 80) {
    reviewReason = `Low AI confidence heuristic (${confidenceScore}% < 80% threshold). Manual routing needed.`;
  } else if (!suggestedDepartmentId) {
    reviewReason = `No department mapped for category '${suggestedCategoryId}'. Admin must assign.`;
  }

  return {
    analysisState: 'Completed',
    suggestedCategoryId,
    suggestedDepartmentId,
    confidenceScore,
    priorityScore,
    priorityLevel,
    severityFactor,
    safetyFactor: safetyRiskFactor,
    peopleFactor: peopleAffectedFactor,
    durationFactor: issueDurationFactor,
    safetyFlag,
    safetyFlagReason,
    reviewRequired,
    reviewReason,
    analysisReasoning,
    duplicateCandidates: duplicateCandidates.slice(0, 3) // Top 3 candidates
  };
}

module.exports = {
  CATEGORY_RULES,
  HAZARD_RULES,
  analyzeReport,
  computeDistanceMeters,
  calculateJaccardSimilarity
};
