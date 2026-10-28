// Civic Resolve AI: AI Vision Inspector Route (PRD F1)
// Endpoint: POST /api/ai/vision-inspect

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { inspectImage } = require('../services/vision');

// Configure multer for in-memory buffer handling for instant inspection
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max per PRD FR-11
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Invalid image type. Only JPEG, PNG, and WebP are supported.'));
    }
    cb(null, true);
  }
});

// Middleware to support either multipart or JSON body
function handleImageUpload(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'image', maxCount: 1 }])(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  } else {
    next();
  }
}

/**
 * POST /api/ai/vision-inspect
 * Accepts either:
 * 1) multipart/form-data with file field 'photo' or 'image'
 * 2) JSON body with { imageBase64, mimeType, fileName, textHint } or { reportId }
 */
router.post('/vision-inspect', handleImageUpload, async (req, res) => {
  try {
    let inspectPayload = {};

    // 1. Check for multipart file
    const file = (req.files && (req.files.photo?.[0] || req.files.image?.[0])) || req.file;
    if (file) {
      inspectPayload = {
        buffer: file.buffer,
        mimeType: file.mimetype,
        fileName: file.originalname,
        textHint: req.body?.textHint || ''
      };
    } 
    // 2. Check for reportId lookup
    else if (req.body?.reportId) {
      const photo = db.get('SELECT * FROM photo_metadata WHERE report_id = ? ORDER BY created_at ASC LIMIT 1', [req.body.reportId]);
      if (!photo) {
        return res.status(404).json({ success: false, error: 'No photos found for this report.' });
      }
      const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
      const uploadDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads');
      const filename = path.basename(photo.storage_path);
      const filePath = path.join(uploadDir, filename);

      inspectPayload = {
        filePath,
        fileName: photo.file_name,
        mimeType: photo.content_type,
        textHint: req.body?.textHint || ''
      };
    }
    // 3. Check for base64 or direct filename in JSON
    else if (req.body?.imageBase64 || req.body?.fileName) {
      inspectPayload = {
        imageBase64: req.body.imageBase64,
        mimeType: req.body.mimeType || 'image/jpeg',
        fileName: req.body.fileName || 'civic_photo.jpg',
        textHint: req.body.textHint || ''
      };
    } else {
      return res.status(400).json({
        success: false,
        error: 'Missing image. Provide a photo file (multipart/form-data) or JSON with imageBase64/fileName.'
      });
    }

    const result = await inspectImage(inspectPayload);

    // Format suggested category structure for clean frontend consumption
    const formattedResponse = {
      success: true,
      provider: result.provider,
      disclaimer: result.disclaimer,
      detectedDefects: result.detectedDefects || [],
      suggestedCategory: {
        id: result.suggestedCategoryId,
        name: result.suggestedCategoryName,
        departmentId: result.suggestedDepartmentId,
        departmentName: result.suggestedDepartmentName
      },
      hazardFlag: Boolean(result.hazardFlag),
      hazardReason: result.hazardReason || null,
      overallConfidence: result.overallConfidence || 80,
      defectDescription: result.defectDescription,
      timestamp: result.timestamp
    };

    return res.json(formattedResponse);

  } catch (error) {
    console.error('[Vision Inspector Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Vision inspection processing error: ' + error.message
    });
  }
});

module.exports = router;

