const express = require('express');
const mongoose = require('mongoose');
const Note = require('../models/Note');
const { verifyToken } = require('../middleware/auth');
const appEvents = require('../events/appEvents');

const router = express.Router();

// ALL routes behind verifyToken
router.use(verifyToken);

/**
 * POST /api/notes
 * Create a new note
 * body { title, content } -> 201, returns the note document: { _id, title, content, owner, createdAt, updatedAt }
 */
router.post('/', async (req, res, next) => {
  try {
    const { title, content } = req.body;

    if (!title || !content || typeof title !== 'string' || typeof content !== 'string') {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle || !trimmedContent) {
      return res.status(400).json({ message: 'Title and content cannot be empty' });
    }

    const note = await Note.create({
      title: trimmedTitle,
      content: trimmedContent,
      owner: req.user.id
    });

    // Emit event: note:created -> <title> by <owner>
    appEvents.emit('note:created', {
      title: note.title,
      owner: req.user.id
    });

    return res.status(201).json({
      _id: note._id,
      title: note.title,
      content: note.content,
      owner: note.owner,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notes
 * Return array of ONLY the logged-in user's notes (admin may see all)
 */
router.get('/', async (req, res, next) => {
  try {
    let filter = { owner: req.user.id };
    if (req.user.role === 'admin') {
      filter = {};
    }

    const notes = await Note.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(notes);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notes/:id
 * Single note; 404 if missing; 403 if not owner (unless admin)
 */
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid note ID format' });
    }

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // 403 if not owner (unless admin)
    if (note.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: insufficient permissions' });
    }

    return res.status(200).json(note);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/notes/:id
 * Update title/content, owner-only
 */
router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid note ID format' });
    }

    const { title, content } = req.body;
    if (title === undefined && content === undefined) {
      return res.status(400).json({ message: 'At least title or content must be provided' });
    }

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Owner-only
    if (note.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: owner only' });
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ message: 'Title cannot be empty' });
      }
      note.title = title.trim();
    }

    if (content !== undefined) {
      if (typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ message: 'Content cannot be empty' });
      }
      note.content = content.trim();
    }

    await note.save();
    return res.status(200).json(note);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notes/:id
 * Owner-only, returns { "message": "Note deleted" }
 */
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid note ID format' });
    }

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Owner-only
    if (note.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: owner only' });
    }

    await Note.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: 'Note deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
