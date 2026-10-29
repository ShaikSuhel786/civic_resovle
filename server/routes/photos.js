// Civic Resolve AI: Photo Management Routes
// Enforces PRD FR-11: Private storage, magic-byte inspection, role-gated evidence downloads, and short-lived signed URLs.

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { JWT_SECRET, requireAuth, optionalAuth } = require('../middleware/auth');
const { inspectImage } = require('../services/vision');

// Upload directory for local demo storage
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

// File filter for JPEG, PNG, WebP only and max 5MB
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(file.mimetype)) {
      return cb(new Error('Invalid file format. Only JPEG, PNG, and WebP images are permitted.'));
    }
    cb(null, true);
  }
});

/**
 * Validates actual binary magic bytes of the uploaded file to prevent MIME-type spoofing
 */
function validateImageMagicBytes(filePath) {
  try {
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    // JPEG: 0xFF, 0xD8, 0xFF
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    // PNG: 0x89, 0x50, 0x4E, 0x47
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    // WebP: RIFF ... WEBP
    const isWebP = buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';

    return isJpeg || isPng || isWebP;
  } catch (err) {
    return false;
  }
}

// POST /api/reports/:id/photos - Upload photo for a report
router.post('/reports/:id/photos', requireAuth, (req, res) => {
  const reportId = req.params.id;

  // Check report exists
  const report = db.get('SELECT * FROM reports WHERE id = ?', [reportId]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  // Authorization check
  if (req.user.role === 'citizen' && report.citizen_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied: You can only upload photos for your own report.' });
  } else if (req.user.role === 'staff' && report.assigned_staff_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied: You are not assigned to this report.' });
  }

  // Check photo quota (max 5 photos per report)
  const currentPhotoCount = db.get('SELECT COUNT(*) as c FROM photo_metadata WHERE report_id = ?', [reportId]).c;
  if (currentPhotoCount >= 5) {
    return res.status(400).json({ error: 'Maximum photo limit reached (max 5 photos per report).' });
  }

  // Handle single photo upload
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Photo upload failed.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided.' });
    }

    const filePath = path.join(uploadDir, req.file.filename);

    // Enforce binary magic-byte inspection
    if (!validateImageMagicBytes(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
      return res.status(400).json({
        error: 'Invalid file signature: uploaded file binary content does not match a valid JPEG, PNG, or WebP image.'
      });
    }

    const photoId = 'pho-' + crypto.randomUUID().slice(0, 8);
    const relativePath = `/uploads/${req.file.filename}`;
    const isResolutionPhoto = req.body.isResolutionPhoto === 'true' || req.body.isResolutionPhoto === true ? 1 : 0;

    // Run AI vision inspection on the uploaded image
    inspectImage({
      filePath,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype
    }).then(vRes => {
      const visionCluesJson = vRes && vRes.detectedDefects ? JSON.stringify(vRes.detectedDefects) : null;
      const confidenceScore = vRes && vRes.overallConfidence ? vRes.overallConfidence : null;

      db.run(`
        INSERT INTO photo_metadata (id, report_id, uploader_id, storage_path, file_name, content_type, size_bytes, is_resolution_photo, vision_clues_json, confidence_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        photoId,
        reportId,
        req.user.id,
        relativePath,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        isResolutionPhoto,
        visionCluesJson,
        confidenceScore
      ]);

      res.status(201).json({
        success: true,
        photo: {
          id: photoId,
          storagePath: relativePath,
          fileName: req.file.originalname,
          sizeBytes: req.file.size,
          isResolutionPhoto: Boolean(isResolutionPhoto),
          visionClues: vRes ? vRes.detectedDefects : [],
          confidenceScore: confidenceScore,
          suggestedCategory: vRes?.suggestedCategoryName || null
        }
      });
    }).catch(vErr => {
      console.warn('[Photo Upload] Vision inspection warning:', vErr.message);
      db.run(`
        INSERT INTO photo_metadata (id, report_id, uploader_id, storage_path, file_name, content_type, size_bytes, is_resolution_photo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        photoId,
        reportId,
        req.user.id,
        relativePath,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        isResolutionPhoto
      ]);

      res.status(201).json({
        success: true,
        photo: {
          id: photoId,
          storagePath: relativePath,
          fileName: req.file.originalname,
          sizeBytes: req.file.size
        }
      });
    });
  });
});

/**
 * GET /api/reports/:id/photos/:photoId/signed-url
 * Generates a short-lived (60s) single-purpose HMAC signed URL for an image.
 * Prevents long-lived session tokens from being exposed in URLs or referrer logs.
 */
router.get('/reports/:id/photos/:photoId/signed-url', requireAuth, (req, res) => {
  const { id: reportId, photoId } = req.params;

  const photo = db.get(`
    SELECT p.*, r.citizen_id, r.assigned_staff_id, r.department_id, r.status as report_status
    FROM photo_metadata p
    JOIN reports r ON p.report_id = r.id
    WHERE p.id = ? AND p.report_id = ?
  `, [photoId, reportId]);

  if (!photo) {
    return res.status(404).json({ error: 'Photo record not found.' });
  }

  // Authorization check
  const isAdmin = req.user.role === 'admin';
  const isOwner = req.user.role === 'citizen' && photo.citizen_id === req.user.id;
  const isAssignedStaff = req.user.role === 'staff' && (photo.assigned_staff_id === req.user.id || photo.department_id === req.user.department_id);
  const isPublicResolution = photo.is_resolution_photo === 1 && photo.report_status === 'Resolved';

  if (!isAdmin && !isOwner && !isAssignedStaff && !isPublicResolution) {
    return res.status(403).json({ error: 'Access denied: You do not have permission to access this photo.' });
  }

  const safeFilename = path.basename(photo.storage_path);
  const expiresAt = Date.now() + 60 * 1000; // 60 seconds validity
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${photo.id}:${safeFilename}:${expiresAt}`)
    .digest('hex');

  const signedUrl = `/uploads/${safeFilename}?sig=${signature}&exp=${expiresAt}&pid=${photo.id}`;

  res.json({
    success: true,
    photoId: photo.id,
    signedUrl,
    expiresAt: new Date(expiresAt).toISOString(),
    expiresInSeconds: 60
  });
});

/**
 * GET /uploads/:filename
 * Secure photo evidence delivery.
 * Authenticated via:
 * 1. Standard Authorization: Bearer <token> header, OR
 * 2. Short-lived (60s) HMAC media signature (sig, exp, pid query parameters)
 */
router.get('/uploads/:filename', optionalAuth, (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadDir, safeFilename);
  const { sig, exp, pid } = req.query;

  // 1. Authenticate caller (either Bearer token via req.user OR HMAC signed URL)
  if (!req.user && !(sig && exp && pid)) {
    return res.status(401).json({
      error: 'Authentication required to access private evidence photos. Provide Authorization: Bearer header or a valid signed media URL.'
    });
  }

  // 2. Path 1: Short-lived HMAC signed URL verification
  if (sig && exp && pid) {
    const expiresNum = parseInt(exp, 10);
    if (isNaN(expiresNum) || Date.now() > expiresNum) {
      return res.status(401).json({ error: 'Signed media URL has expired. Please request a fresh signed URL.' });
    }

    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${pid}:${safeFilename}:${exp}`)
      .digest('hex');

    const sigBuf = Buffer.from(sig, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(403).json({ error: 'Invalid or forged media signature.' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Requested photo file does not exist.' });
    }

    return res.sendFile(filePath);
  }

  // 3. Path 2: Standard Authorization: Bearer token verification
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Requested photo file does not exist.' });
  }

  // Look up photo record in database
  const photo = db.get(`
    SELECT p.*, r.citizen_id, r.assigned_staff_id, r.department_id, r.status as report_status
    FROM photo_metadata p
    LEFT JOIN reports r ON p.report_id = r.id
    WHERE p.storage_path = ? OR p.storage_path LIKE ?
  `, [`/uploads/${safeFilename}`, `%${safeFilename}%`]);

  if (photo) {
    const isAdmin = req.user.role === 'admin';
    const isOwner = req.user.role === 'citizen' && photo.citizen_id === req.user.id;
    const isAssignedStaff = req.user.role === 'staff' && (photo.assigned_staff_id === req.user.id || photo.department_id === req.user.department_id);
    const isPublicResolutionPhoto = photo.is_resolution_photo === 1 && photo.report_status === 'Resolved';

    if (!isAdmin && !isOwner && !isAssignedStaff && !isPublicResolutionPhoto) {
      return res.status(403).json({
        error: 'Access denied: You do not have permission to view this civic evidence photo.'
      });
    }
  }

  res.sendFile(filePath);
});

module.exports = router;
