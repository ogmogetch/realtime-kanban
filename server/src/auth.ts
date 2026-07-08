import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import type { Request, Response, NextFunction } from 'express';
import { query } from './db.js';
import { config } from './config.js';
import type { AuthPayload, User } from './types.js';

const TOKEN_TTL = '7d';
const INVITE_TTL = '30d';

interface InvitePayload {
  boardId: string;
  kind: 'board-invite';
}

export function signInviteToken(boardId: string): string {
  return jwt.sign({ boardId, kind: 'board-invite' } satisfies InvitePayload, config.jwtSecret, {
    expiresIn: INVITE_TTL,
  });
}

export function verifyInviteToken(token: string): InvitePayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as InvitePayload;
    if (decoded.kind !== 'board-invite' || !decoded.boardId) return null;
    return decoded;
  } catch {
    return null;
  }
}

interface UserRow {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_color: string;
  background: string | null;
}

function rowToUser(r: UserRow): User {
  return {
    id: r.id,
    email: r.email,
    username: r.username,
    displayName: r.display_name,
    avatarColor: r.avatar_color,
    background: r.background,
  };
}

const USER_SELECT = 'id, email, username, display_name, avatar_color, background';

export async function registerUser(email: string, username: string, password: string): Promise<User> {
  const hash = await bcrypt.hash(password, 10);
  const id = nanoid(12);
  try {
    const { rows } = await query<UserRow>(
      `INSERT INTO users (id, email, username, password_hash) VALUES ($1, $2, $3, $4)
       RETURNING ${USER_SELECT}`,
      [id, email.toLowerCase(), username, hash]
    );
    return rowToUser(rows[0]);
  } catch (e: unknown) {
    const err = e as { code?: string; constraint?: string };
    if (err.code === '23505') {
      const which = err.constraint?.includes('email') ? 'email' : 'username';
      throw new Error(`${which}_taken`);
    }
    throw e;
  }
}

export async function loginUser(identifier: string, password: string): Promise<User | null> {
  const { rows } = await query<UserRow & { password_hash: string }>(
    `SELECT ${USER_SELECT}, password_hash FROM users WHERE email = $1 OR username = $1`,
    [identifier.toLowerCase()]
  );
  const u = rows[0];
  if (!u) return null;
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return null;
  return rowToUser(u);
}

export async function updateUserProfile(userId: string, patch: { displayName?: string | null; avatarColor?: string; background?: string | null }): Promise<User | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (patch.displayName !== undefined) {
    fields.push(`display_name = $${i++}`);
    values.push(patch.displayName);
  }
  if (patch.avatarColor !== undefined) {
    fields.push(`avatar_color = $${i++}`);
    values.push(patch.avatarColor);
  }
  if (patch.background !== undefined) {
    fields.push(`background = $${i++}`);
    values.push(patch.background);
  }
  if (fields.length === 0) return getUserById(userId);
  values.push(userId);
  const { rows } = await query<UserRow>(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${USER_SELECT}`,
    values
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload;
    return decoded;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'invalid token' });
  req.auth = payload;
  next();
}

export async function getUserById(id: string): Promise<User | null> {
  const { rows } = await query<UserRow>(
    `SELECT ${USER_SELECT} FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}
