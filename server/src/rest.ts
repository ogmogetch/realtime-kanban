import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  requireAuth,
  registerUser,
  loginUser,
  signToken,
  signInviteToken,
  verifyInviteToken,
  getUserById,
  type AuthenticatedRequest,
} from './auth.js';
import {
  createBoard,
  listBoardsForUser,
  getBoard,
  getSnapshot,
  isBoardMember,
  deleteBoard,
  joinBoardViaInvite,
} from './store.js';
import { config } from './config.js';

export const rest = Router();

rest.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// ---------- Auth ----------

const registerSchema = z.object({
  email: z.string().email().max(120),
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(6).max(200),
});

rest.post('/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });
  try {
    const user = await registerUser(parsed.data.email, parsed.data.username, parsed.data.password);
    const token = signToken({ userId: user.id, username: user.username });
    res.status(201).json({ user, token });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'email_taken' || msg === 'username_taken') {
      return res.status(409).json({ error: msg });
    }
    console.error(e);
    res.status(500).json({ error: 'internal' });
  }
});

const loginSchema = z.object({
  identifier: z.string().min(3).max(120),
  password: z.string().min(1).max(200),
});

rest.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });
  const user = await loginUser(parsed.data.identifier, parsed.data.password);
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const token = signToken({ userId: user.id, username: user.username });
  res.json({ user, token });
});

rest.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = await getUserById(req.auth!.userId);
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json({ user });
});

// ---------- Boards ----------

rest.get('/boards', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const boards = await listBoardsForUser(req.auth!.userId);
  res.json(boards);
});

const createBoardSchema = z.object({ title: z.string().min(1).max(80) });

rest.post('/boards', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createBoardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });
  const board = await createBoard(req.auth!.userId, parsed.data.title.trim());
  res.status(201).json(board);
});

rest.get('/boards/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const board = await getBoard(req.params.id);
  if (!board) return res.status(404).json({ error: 'not found' });
  const member = await isBoardMember(board.id, req.auth!.userId);
  if (!member) return res.status(403).json({ error: 'forbidden' });
  res.json(board);
});

rest.get('/boards/:id/snapshot', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const member = await isBoardMember(req.params.id, req.auth!.userId);
  if (!member) return res.status(403).json({ error: 'forbidden' });
  const snap = await getSnapshot(req.params.id);
  if (!snap) return res.status(404).json({ error: 'not found' });
  res.json(snap);
});

rest.delete('/boards/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const ok = await deleteBoard(req.params.id, req.auth!.userId);
  if (!ok) return res.status(403).json({ error: 'forbidden or not found' });
  res.json({ ok: true });
});

rest.post('/boards/:id/invite-link', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const board = await getBoard(req.params.id);
  if (!board) return res.status(404).json({ error: 'not found' });
  if (board.ownerId !== req.auth!.userId) return res.status(403).json({ error: 'owner only' });
  const token = signInviteToken(board.id);
  const url = `${config.clientOrigin.replace(/\/$/, '')}/join/${token}`;
  res.json({ token, url });
});

const acceptSchema = z.object({ token: z.string().min(10) });

rest.post('/invites/accept', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });
  const payload = verifyInviteToken(parsed.data.token);
  if (!payload) return res.status(400).json({ error: 'invalid or expired invite' });
  const member = await joinBoardViaInvite(payload.boardId, req.auth!.userId);
  if (!member) return res.status(404).json({ error: 'board not found' });
  res.json({ boardId: payload.boardId, member });
});
