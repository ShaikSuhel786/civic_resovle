// Civic Resolve AI: Photo Management Routes
// Enforces PRD FR-11: Private storage, magic-byte inspection, role-gated evidence downloads, and short-lived signed URLs.

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { supabaseClient, isSupabaseConfigured } = require('../db');
const { JWT_SECRET, requireAuth, optionalAuth } = require('../middleware/auth');
const { inspectImage } = require('../services/vision');

const isProduction = process.env.NODE_ENV === 'production';
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'civic-photos';

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
    const isWebP = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

    return isJpeg || isPng || isWebP;
  } catch (err) {
    return false;
  }
}

/**
 * POST /api/reports/:id/photos
 * Secure photo evidence upload with mandatory server-side binary inspection and AI defect detection
 */
router.post('/reports/:id/photos', requireAuth, async (req, res) => {
  const reportId = req.params.id;

  try {
    // Check report exists
    const report = await db.get('SELECT * FROM reports WHERE id = ?', [reportId]);
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    // Authorization check
    if (req.user.role === 'citizen' && report.citizen_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: You can only upload photos for your own report.' });
    } else if (req.user.role === 'staff' && report.assigned_staff_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: You are not assigned to this report.' });
    }

    // Check photo quota (max 5 photos per report)
    const countRes = await db.get('SELECT COUNT(*) as c FROM photo_metadata WHERE report_id = ?', [reportId]);
    const currentPhotoCount = countRes?.c || 0;
    if (currentPhotoCount >= 5) {
      return res.status(400).json({ error: 'Maximum photo limit reached (max 5 photos per report).' });
    }

        // Fail-fast in production if durable photo storage is not configured (unless running in demo preview mode)
    const isDemo = process.env.ALLOW_DEMO_MODE === 'true' || 
                   process.env.ALLOW_EPHEMERAL_DEMO === 'true' ||
                   Boolean((process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL_ENV) && process.env.REQUIRE_PRODUCTION_DB !== 'true');

    if (isProduction && !isSupabaseConfigured && !isDemo) {
      return res.status(503).json({
        error: 'Durable photo storage is not configured. In production, Supabase Storage credentials (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are required to prevent data loss.'
      });
    }

    // Handle single photo upload
    upload.single('photo')(req, res, async (err) => {
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
      let storagePath = `/uploads/${req.file.filename}`;
      const isResolutionPhoto = Boolean(req.body.isResolutionPhoto === 'true' || req.body.isResolutionPhoto === true);

      // Persist to durable Supabase Storage if configured
      if (isSupabaseConfigured && supabaseClient) {
        try {
          const remoteKey = `reports/${reportId}/${req.file.filename}`;
          const fileBuffer = fs.readFileSync(filePath);
          const { error: uploadError } = await supabaseClient.storage
            .from(bucketName)
            .upload(remoteKey, fileBuffer, {
              contentType: req.file.mimetype,
              upsert: false
            });

          if (uploadError) {
            try { fs.unlinkSync(filePath); } catch (_) {}
            return res.status(500).json({
              error: `Failed to upload photo to durable storage: ${uploadError.message}`
            });
          }
          storagePath = `supabase://${bucketName}/${remoteKey}`;
        } catch (sErr) {
          try { fs.unlinkSync(filePath); } catch (_) {}
          return res.status(500).json({
            error: `Failed to upload photo to durable storage: ${sErr.message}`
          });
        }
      }

      // Run AI vision inspection on the uploaded image
      try {
        const vRes = await inspectImage({
          filePath,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype
        });

        const visionCluesJson = vRes && vRes.detectedDefects ? JSON.stringify(vRes.detectedDefects) : null;
        const confidenceScore = vRes && vRes.overallConfidence ? vRes.overallConfidence : null;

        await db.run(`
          INSERT INTO photo_metadata (id, report_id, uploader_id, storage_path, file_name, content_type, size_bytes, is_resolution_photo, vision_clues_json, confidence_score, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          photoId,
          reportId,
          req.user.id,
          storagePath,
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
            storagePath,
            fileName: req.file.originalname,
            sizeBytes: req.file.size,
            isResolutionPhoto: Boolean(isResolutionPhoto),
            visionClues: vRes ? vRes.detectedDefects : [],
            confidenceScore: confidenceScore,
            suggestedCategory: vRes?.suggestedCategoryName || null
          }
        });
      } catch (vErr) {
        console.warn('[Photo Upload] Vision inspection warning:', vErr.message);
        await db.run(`
          INSERT INTO photo_metadata (id, report_id, uploader_id, storage_path, file_name, content_type, size_bytes, is_resolution_photo, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          photoId,
          reportId,
          req.user.id,
          storagePath,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          isResolutionPhoto
        ]);

        res.status(201).json({
          success: true,
          photo: {
            id: photoId,
            storagePath,
            fileName: req.file.originalname,
            sizeBytes: req.file.size
          }
        });
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process photo upload: ' + err.message });
  }
});

/**
 * GET /api/reports/:id/photos/:photoId/signed-url
 * Generates a short-lived (60s) single-purpose HMAC signed URL for an image.
 * Prevents long-lived session tokens from being exposed in URLs or referrer logs.
 */
router.get('/reports/:id/photos/:photoId/signed-url', requireAuth, async (req, res) => {
  const { id: reportId, photoId } = req.params;

  try {
    const photo = await db.get(`
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
    const isPublicResolution = (photo.is_resolution_photo === 1 || photo.is_resolution_photo === true) && photo.report_status === 'Resolved';

    if (!isAdmin && !isOwner && !isAssignedStaff && !isPublicResolution) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to access this photo.' });
    }

    if (photo.storage_path && photo.storage_path.startsWith('supabase://') && isSupabaseConfigured && supabaseClient) {
      const fullPath = photo.storage_path.replace('supabase://', '');
      const slashIndex = fullPath.indexOf('/');
      const targetBucket = slashIndex !== -1 ? fullPath.slice(0, slashIndex) : bucketName;
      const targetKey = slashIndex !== -1 ? fullPath.slice(slashIndex + 1) : fullPath;

      const { data, error } = await supabaseClient.storage
        .from(targetBucket)
        .createSignedUrl(targetKey, 60);

      if (error || !data?.signedUrl) {
        return res.status(500).json({ error: 'Failed to generate signed URL from durable storage: ' + (error?.message || 'Unknown error') });
      }

      return res.json({
        success: true,
        photoId: photo.id,
        signedUrl: data.signedUrl,
        expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
        expiresInSeconds: 60
      });
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate signed URL: ' + err.message });
  }
});

/**
 * GET /uploads/:filename
 * Secure photo evidence delivery.
 * Authenticated via:
 * 1. Standard Authorization: Bearer <token> header, OR
 * 2. Short-lived (60s) HMAC media signature (sig, exp, pid query parameters)
 */
router.get('/uploads/:filename', optionalAuth, async (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadDir, safeFilename);
  const { sig, exp, pid } = req.query;

  try {
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
        if (isSupabaseConfigured && supabaseClient) {
          const photoRecord = await db.get(`
            SELECT * FROM photo_metadata
            WHERE id = ? OR storage_path LIKE ? OR file_name = ?
          `, [pid, `%${safeFilename}%`, safeFilename]);

          if (photoRecord && photoRecord.storage_path.startsWith('supabase://')) {
            const fullPath = photoRecord.storage_path.replace('supabase://', '');
            const slashIndex = fullPath.indexOf('/');
            const targetBucket = slashIndex !== -1 ? fullPath.slice(0, slashIndex) : bucketName;
            const targetKey = slashIndex !== -1 ? fullPath.slice(slashIndex + 1) : fullPath;

            const { data: fileBlob, error: dlErr } = await supabaseClient.storage
              .from(targetBucket)
              .download(targetKey);

            if (!dlErr && fileBlob) {
              const buffer = Buffer.from(await fileBlob.arrayBuffer());
              res.setHeader('Content-Type', photoRecord.content_type || 'image/jpeg');
              return res.send(buffer);
            }
          }
        }
        return res.status(404).json({ error: 'Requested photo file does not exist.' });
      }

      return res.sendFile(filePath);
    }

    // 3. Path 2: Standard Authorization: Bearer token verification
    // Look up photo record in database
    const photo = await db.get(`
      SELECT p.*, r.citizen_id, r.assigned_staff_id, r.department_id, r.status as report_status
      FROM photo_metadata p
      LEFT JOIN reports r ON p.report_id = r.id
      WHERE p.storage_path = ? OR p.storage_path LIKE ? OR p.file_name = ?
    `, [`/uploads/${safeFilename}`, `%${safeFilename}%`, safeFilename]);

    if (photo) {
      const isAdmin = req.user.role === 'admin';
      const isOwner = req.user.role === 'citizen' && photo.citizen_id === req.user.id;
      const isAssignedStaff = req.user.role === 'staff' && (photo.assigned_staff_id === req.user.id || photo.department_id === req.user.department_id);
      const isPublicResolutionPhoto = (photo.is_resolution_photo === 1 || photo.is_resolution_photo === true) && photo.report_status === 'Resolved';

      if (!isAdmin && !isOwner && !isAssignedStaff && !isPublicResolutionPhoto) {
        return res.status(403).json({
          error: 'Access denied: You do not have permission to view this civic evidence photo.'
        });
      }
    }

    if (!fs.existsSync(filePath)) {
      if (isSupabaseConfigured && supabaseClient && photo && photo.storage_path.startsWith('supabase://')) {
        const fullPath = photo.storage_path.replace('supabase://', '');
        const slashIndex = fullPath.indexOf('/');
        const targetBucket = slashIndex !== -1 ? fullPath.slice(0, slashIndex) : bucketName;
        const targetKey = slashIndex !== -1 ? fullPath.slice(slashIndex + 1) : fullPath;

        const { data: fileBlob, error: dlErr } = await supabaseClient.storage
          .from(targetBucket)
          .download(targetKey);

        if (!dlErr && fileBlob) {
          const buffer = Buffer.from(await fileBlob.arrayBuffer());
          res.setHeader('Content-Type', photo.content_type || 'image/jpeg');
          return res.send(buffer);
        }
      }
      return res.status(404).json({ error: 'Requested photo file does not exist.' });
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Failed to deliver photo evidence: ' + err.message });
  }
});

module.exports = router;
