// Civic Resolve AI: Photo Management Routes
// Enforces PRD FR-11: Private storage, max 5 photos/report, max 5MB, JPEG/PNG/WebP validation.

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// Upload directory for local demo storage
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
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

    const photoId = 'pho-' + crypto.randomUUID().slice(0, 8);
    const relativePath = `/uploads/${req.file.filename}`;
    const isResolutionPhoto = req.body.isResolutionPhoto === 'true' || req.body.isResolutionPhoto === true ? 1 : 0;

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

module.exports = router;
