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
  updateUserProfile,
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
  updateBoardBackground,
  setMemberRole,
  removeMember,
} from './store.js';
import { query } from './db.js';
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

const profileSchema = z.object({
  displayName: z.string().min(0).max(40).nullable().optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  background: z.string().max(200).nullable().optional(),
});

rest.patch('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });
  const user = await updateUserProfile(req.auth!.userId, parsed.data);
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

const boardPatchSchema = z.object({
  background: z.string().max(5_000_000).nullable().optional(),
  visibility: z.enum(['private', 'public']).optional(),
});

rest.patch('/boards/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = boardPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });
  const board = await getBoard(req.params.id);
  if (!board) return res.status(404).json({ error: 'not found' });
  if (board.ownerId !== req.auth!.userId) return res.status(403).json({ error: 'owner only' });
  if (parsed.data.background !== undefined) {
    await updateBoardBackground(board.id, req.auth!.userId, parsed.data.background);
  }
  if (parsed.data.visibility !== undefined) {
    await query(`UPDATE boards SET visibility = $1 WHERE id = $2`, [parsed.data.visibility, board.id]);
  }
  const updated = await getBoard(board.id);
  res.json(updated);
});

const roleSchema = z.object({ role: z.enum(['member', 'viewer']) });

rest.patch('/boards/:id/members/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });
  const member = await setMemberRole(req.params.id, req.auth!.userId, req.params.userId, parsed.data.role);
  if (!member) return res.status(403).json({ error: 'owner only or member not found' });
  res.json(member);
});

rest.delete('/boards/:id/members/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const ok = await removeMember(req.params.id, req.auth!.userId, req.params.userId);
  if (!ok) return res.status(403).json({ error: 'owner only or member not found' });
  res.json({ ok: true });
});

rest.delete('/boards/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const ok = await deleteBoard(req.params.id, req.auth!.userId);
  if (!ok) return res.status(403).json({ error: 'forbidden or not found' });
  res.json({ ok: true });
});

// ---------- Invites ----------

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

// ---------- Public read-only view ----------

rest.get('/public/boards/:token/snapshot', async (req, res) => {
  const payload = verifyInviteToken(req.params.token);
  if (!payload) return res.status(400).json({ error: 'invalid invite' });
  const board = await getBoard(payload.boardId);
  if (!board) return res.status(404).json({ error: 'not found' });
  const { rows } = await query<{ visibility: string }>(
    `SELECT visibility FROM boards WHERE id = $1`,
    [board.id]
  );
  const vis = rows[0]?.visibility;
  if (vis !== 'public' && vis !== 'link') {
    return res.status(403).json({ error: 'board is private' });
  }
  const snap = await getSnapshot(board.id);
  if (!snap) return res.status(404).json({ error: 'not found' });
  res.json(snap);
});
