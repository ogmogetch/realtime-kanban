import { Router } from 'express';
import {
  createBoard,
  getBoard,
  listBoards,
  getSnapshot,
  createColumn,
  createCard,
} from './store.js';

export const rest = Router();

rest.get('/health', (_req, res) => {
  res.json({ ok: true });
});

rest.get('/boards', (_req, res) => {
  res.json(listBoards());
});

rest.post('/boards', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(400).json({ error: 'title required' });
  const board = createBoard(title);
  res.status(201).json(board);
});

rest.get('/boards/:id', (req, res) => {
  const board = getBoard(req.params.id);
  if (!board) return res.status(404).json({ error: 'not found' });
  res.json(board);
});

rest.get('/boards/:id/snapshot', (req, res) => {
  const snap = getSnapshot(req.params.id);
  if (!snap) return res.status(404).json({ error: 'not found' });
  res.json(snap);
});

rest.post('/boards/:id/columns', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(400).json({ error: 'title required' });
  const col = createColumn(req.params.id, title);
  if (!col) return res.status(404).json({ error: 'board not found' });
  res.status(201).json(col);
});

rest.post('/columns/:id/cards', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(400).json({ error: 'title required' });
  const card = createCard(req.params.id, title);
  if (!card) return res.status(404).json({ error: 'column not found' });
  res.status(201).json(card);
});
