import { nanoid } from 'nanoid';
import { pool, query, tx } from './db.js';
import type {
  Board,
  Card,
  Column,
  BoardSnapshot,
  Label,
  BoardMember,
  CardEvent,
} from './types.js';

// ------------- Boards -------------

const SEED_COLUMN_TITLES = ['To Do', 'In Progress', 'Done'];
const DEFAULT_LABELS: Array<{ name: string; color: string }> = [
  { name: 'Bug', color: '#ef4444' },
  { name: 'Feature', color: '#22c55e' },
  { name: 'Urgent', color: '#f97316' },
  { name: 'Idea', color: '#8b5cf6' },
];

function boardRowToBoard(r: { id: string; title: string; owner_id: string; created_at: Date; background: string | null }): Board {
  return {
    id: r.id,
    title: r.title,
    ownerId: r.owner_id,
    createdAt: r.created_at.toISOString(),
    background: r.background,
  };
}

export async function createBoard(ownerId: string, title: string): Promise<Board> {
  return tx(async (c) => {
    const id = nanoid(10);
    const boardRes = await c.query<{ id: string; title: string; owner_id: string; created_at: Date; background: string | null }>(
      `INSERT INTO boards (id, title, owner_id) VALUES ($1, $2, $3) RETURNING *`,
      [id, title, ownerId]
    );
    await c.query(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [id, ownerId]
    );
    for (let i = 0; i < SEED_COLUMN_TITLES.length; i++) {
      await c.query(
        `INSERT INTO columns (id, board_id, title, "order") VALUES ($1, $2, $3, $4)`,
        [nanoid(10), id, SEED_COLUMN_TITLES[i], i]
      );
    }
    for (const l of DEFAULT_LABELS) {
      await c.query(
        `INSERT INTO labels (id, board_id, name, color) VALUES ($1, $2, $3, $4)`,
        [nanoid(10), id, l.name, l.color]
      );
    }
    return boardRowToBoard(boardRes.rows[0]);
  });
}

export async function listBoardsForUser(userId: string): Promise<Board[]> {
  const { rows } = await query<{ id: string; title: string; owner_id: string; created_at: Date; background: string | null }>(
    `SELECT b.* FROM boards b
     JOIN board_members m ON m.board_id = b.id
     WHERE m.user_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return rows.map(boardRowToBoard);
}

export async function getBoard(boardId: string): Promise<Board | null> {
  const { rows } = await query<{ id: string; title: string; owner_id: string; created_at: Date; background: string | null }>(
    `SELECT * FROM boards WHERE id = $1`,
    [boardId]
  );
  const r = rows[0];
  if (!r) return null;
  return boardRowToBoard(r);
}

export async function deleteBoard(boardId: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(
    `DELETE FROM boards WHERE id = $1 AND owner_id = $2`,
    [boardId, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function isBoardMember(boardId: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(
    `SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2`,
    [boardId, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function joinBoardViaInvite(boardId: string, userId: string): Promise<BoardMember | null> {
  const boardCheck = await query(`SELECT 1 FROM boards WHERE id = $1`, [boardId]);
  if ((boardCheck.rowCount ?? 0) === 0) return null;
  const userRes = await query<{ username: string; display_name: string | null; avatar_color: string }>(
    `SELECT username, display_name, avatar_color FROM users WHERE id = $1`,
    [userId]
  );
  const u = userRes.rows[0];
  if (!u) return null;
  await query(
    `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'member')
     ON CONFLICT (board_id, user_id) DO NOTHING`,
    [boardId, userId]
  );
  return { userId, username: u.username, displayName: u.display_name, avatarColor: u.avatar_color, role: 'member' };
}

export async function updateBoardBackground(boardId: string, ownerId: string, background: string | null): Promise<Board | null> {
  const { rows } = await query<{ id: string; title: string; owner_id: string; created_at: Date; background: string | null }>(
    `UPDATE boards SET background = $1 WHERE id = $2 AND owner_id = $3 RETURNING *`,
    [background, boardId, ownerId]
  );
  const r = rows[0];
  return r ? boardRowToBoard(r) : null;
}

// ------------- Snapshot -------------

export async function getSnapshot(boardId: string): Promise<BoardSnapshot | null> {
  const board = await getBoard(boardId);
  if (!board) return null;

  const [colRes, cardRes, labelRes, memRes, cardLabelRes, cardAssigneeRes] = await Promise.all([
    query<{ id: string; board_id: string; title: string; order: number }>(
      `SELECT * FROM columns WHERE board_id = $1 ORDER BY "order" ASC`,
      [boardId]
    ),
    query<{ id: string; column_id: string; title: string; description: string; order: number }>(
      `SELECT c.* FROM cards c
       JOIN columns col ON col.id = c.column_id
       WHERE col.board_id = $1
       ORDER BY c."order" ASC`,
      [boardId]
    ),
    query<{ id: string; board_id: string; name: string; color: string }>(
      `SELECT * FROM labels WHERE board_id = $1 ORDER BY name ASC`,
      [boardId]
    ),
    query<{ user_id: string; username: string; display_name: string | null; avatar_color: string; role: string }>(
      `SELECT m.user_id, u.username, u.display_name, u.avatar_color, m.role
       FROM board_members m JOIN users u ON u.id = m.user_id
       WHERE m.board_id = $1`,
      [boardId]
    ),
    query<{ card_id: string; label_id: string }>(
      `SELECT cl.card_id, cl.label_id
       FROM card_labels cl
       JOIN cards c ON c.id = cl.card_id
       JOIN columns col ON col.id = c.column_id
       WHERE col.board_id = $1`,
      [boardId]
    ),
    query<{ card_id: string; user_id: string }>(
      `SELECT ca.card_id, ca.user_id
       FROM card_assignees ca
       JOIN cards c ON c.id = ca.card_id
       JOIN columns col ON col.id = c.column_id
       WHERE col.board_id = $1`,
      [boardId]
    ),
  ]);

  const labelsByCard = new Map<string, string[]>();
  for (const r of cardLabelRes.rows) {
    const list = labelsByCard.get(r.card_id) ?? [];
    list.push(r.label_id);
    labelsByCard.set(r.card_id, list);
  }
  const assigneesByCard = new Map<string, string[]>();
  for (const r of cardAssigneeRes.rows) {
    const list = assigneesByCard.get(r.card_id) ?? [];
    list.push(r.user_id);
    assigneesByCard.set(r.card_id, list);
  }

  const cards: Card[] = cardRes.rows.map((r) => ({
    id: r.id,
    columnId: r.column_id,
    title: r.title,
    description: r.description,
    order: r.order,
    labelIds: labelsByCard.get(r.id) ?? [],
    assigneeIds: assigneesByCard.get(r.id) ?? [],
  }));

  const columns: Column[] = colRes.rows.map((r) => ({
    id: r.id,
    boardId: r.board_id,
    title: r.title,
    order: r.order,
  }));

  const labels: Label[] = labelRes.rows.map((r) => ({
    id: r.id,
    boardId: r.board_id,
    name: r.name,
    color: r.color,
  }));

  const members: BoardMember[] = memRes.rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    displayName: r.display_name,
    avatarColor: r.avatar_color,
    role: r.role,
  }));

  return { board, columns, cards, labels, members };
}

// ------------- Columns -------------

export async function createColumn(boardId: string, title: string): Promise<Column | null> {
  const boardCheck = await query(`SELECT 1 FROM boards WHERE id = $1`, [boardId]);
  if ((boardCheck.rowCount ?? 0) === 0) return null;
  const orderRes = await query<{ next: number }>(
    `SELECT COALESCE(MAX("order"), -1) + 1 AS next FROM columns WHERE board_id = $1`,
    [boardId]
  );
  const order = orderRes.rows[0].next;
  const id = nanoid(10);
  await query(
    `INSERT INTO columns (id, board_id, title, "order") VALUES ($1, $2, $3, $4)`,
    [id, boardId, title, order]
  );
  return { id, boardId, title, order };
}

export async function deleteColumn(columnId: string): Promise<string | null> {
  const boardIdRes = await query<{ board_id: string }>(
    `SELECT board_id FROM columns WHERE id = $1`,
    [columnId]
  );
  const boardId = boardIdRes.rows[0]?.board_id;
  if (!boardId) return null;
  await query(`DELETE FROM columns WHERE id = $1`, [columnId]);
  return boardId;
}

export async function moveColumn(columnId: string, toIndex: number): Promise<string | null> {
  return tx(async (c) => {
    const boardRes = await c.query<{ board_id: string }>(
      `SELECT board_id FROM columns WHERE id = $1 FOR UPDATE`,
      [columnId]
    );
    const boardId = boardRes.rows[0]?.board_id;
    if (!boardId) return null;
    const otherRes = await c.query<{ id: string }>(
      `SELECT id FROM columns WHERE board_id = $1 AND id <> $2 ORDER BY "order" ASC`,
      [boardId, columnId]
    );
    const order = otherRes.rows.map((r) => r.id);
    const clamped = Math.max(0, Math.min(toIndex, order.length));
    order.splice(clamped, 0, columnId);
    for (let i = 0; i < order.length; i++) {
      await c.query(`UPDATE columns SET "order" = $1 WHERE id = $2`, [i, order[i]]);
    }
    return boardId;
  });
}

export async function updateColumnTitle(columnId: string, title: string): Promise<Column | null> {
  const { rows } = await query<{ id: string; board_id: string; title: string; order: number }>(
    `UPDATE columns SET title = $1 WHERE id = $2 RETURNING *`,
    [title, columnId]
  );
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, boardId: r.board_id, title: r.title, order: r.order };
}

// ------------- Cards -------------

async function fetchCard(cardId: string): Promise<Card | null> {
  const { rows } = await query<{ id: string; column_id: string; title: string; description: string; order: number }>(
    `SELECT * FROM cards WHERE id = $1`,
    [cardId]
  );
  const r = rows[0];
  if (!r) return null;
  const [labels, assignees] = await Promise.all([
    query<{ label_id: string }>(`SELECT label_id FROM card_labels WHERE card_id = $1`, [cardId]),
    query<{ user_id: string }>(`SELECT user_id FROM card_assignees WHERE card_id = $1`, [cardId]),
  ]);
  return {
    id: r.id,
    columnId: r.column_id,
    title: r.title,
    description: r.description,
    order: r.order,
    labelIds: labels.rows.map((x) => x.label_id),
    assigneeIds: assignees.rows.map((x) => x.user_id),
  };
}

export async function createCard(columnId: string, title: string): Promise<Card | null> {
  const colCheck = await query(`SELECT 1 FROM columns WHERE id = $1`, [columnId]);
  if ((colCheck.rowCount ?? 0) === 0) return null;
  const orderRes = await query<{ next: number }>(
    `SELECT COALESCE(MAX("order"), -1) + 1 AS next FROM cards WHERE column_id = $1`,
    [columnId]
  );
  const order = orderRes.rows[0].next;
  const id = nanoid(10);
  await query(
    `INSERT INTO cards (id, column_id, title, "order") VALUES ($1, $2, $3, $4)`,
    [id, columnId, title, order]
  );
  return { id, columnId, title, description: '', order, labelIds: [], assigneeIds: [] };
}

export async function deleteCard(cardId: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM cards WHERE id = $1`, [cardId]);
  return (rowCount ?? 0) > 0;
}

export async function updateCard(cardId: string, patch: { title?: string; description?: string }): Promise<Card | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (patch.title !== undefined) {
    fields.push(`title = $${i++}`);
    values.push(patch.title);
  }
  if (patch.description !== undefined) {
    fields.push(`description = $${i++}`);
    values.push(patch.description);
  }
  if (fields.length === 0) return null;
  values.push(cardId);
  const { rowCount } = await query(
    `UPDATE cards SET ${fields.join(', ')} WHERE id = $${i}`,
    values
  );
  if (!rowCount) return null;
  return fetchCard(cardId);
}

export async function moveCard(
  cardId: string,
  toColumnId: string,
  toIndex: number
): Promise<{ boardId: string; fromColumnId: string; toColumnId: string } | null> {
  return tx(async (c) => {
    const cardRes = await c.query<{ column_id: string }>(
      `SELECT column_id FROM cards WHERE id = $1 FOR UPDATE`,
      [cardId]
    );
    const card = cardRes.rows[0];
    if (!card) return null;
    const fromColumnId = card.column_id;

    const fromBoardRes = await c.query<{ board_id: string }>(
      `SELECT board_id FROM columns WHERE id = $1`,
      [fromColumnId]
    );
    const toBoardRes = await c.query<{ board_id: string }>(
      `SELECT board_id FROM columns WHERE id = $1`,
      [toColumnId]
    );
    if (!fromBoardRes.rows[0] || !toBoardRes.rows[0]) return null;
    if (fromBoardRes.rows[0].board_id !== toBoardRes.rows[0].board_id) return null;
    const boardId = toBoardRes.rows[0].board_id;

    const targetRes = await c.query<{ id: string }>(
      `SELECT id FROM cards WHERE column_id = $1 AND id <> $2 ORDER BY "order" ASC`,
      [toColumnId, cardId]
    );
    const target = targetRes.rows.map((r) => r.id);
    const clamped = Math.max(0, Math.min(toIndex, target.length));
    target.splice(clamped, 0, cardId);

    await c.query(`UPDATE cards SET column_id = $1 WHERE id = $2`, [toColumnId, cardId]);
    for (let i = 0; i < target.length; i++) {
      await c.query(`UPDATE cards SET "order" = $1 WHERE id = $2`, [i, target[i]]);
    }

    if (fromColumnId !== toColumnId) {
      const srcRes = await c.query<{ id: string }>(
        `SELECT id FROM cards WHERE column_id = $1 ORDER BY "order" ASC`,
        [fromColumnId]
      );
      const src = srcRes.rows.map((r) => r.id);
      for (let i = 0; i < src.length; i++) {
        await c.query(`UPDATE cards SET "order" = $1 WHERE id = $2`, [i, src[i]]);
      }
    }
    return { boardId, fromColumnId, toColumnId };
  });
}

// ------------- Labels -------------

export async function createLabel(boardId: string, name: string, color: string): Promise<Label | null> {
  const check = await query(`SELECT 1 FROM boards WHERE id = $1`, [boardId]);
  if ((check.rowCount ?? 0) === 0) return null;
  const id = nanoid(10);
  await query(
    `INSERT INTO labels (id, board_id, name, color) VALUES ($1, $2, $3, $4)`,
    [id, boardId, name, color]
  );
  return { id, boardId, name, color };
}

export async function deleteLabel(labelId: string): Promise<string | null> {
  const boardRes = await query<{ board_id: string }>(
    `SELECT board_id FROM labels WHERE id = $1`,
    [labelId]
  );
  const boardId = boardRes.rows[0]?.board_id;
  if (!boardId) return null;
  await query(`DELETE FROM labels WHERE id = $1`, [labelId]);
  return boardId;
}

export async function toggleCardLabel(cardId: string, labelId: string): Promise<{ boardId: string; attached: boolean; labelName: string } | null> {
  const boardCard = await query<{ board_id: string }>(
    `SELECT col.board_id FROM cards c JOIN columns col ON col.id = c.column_id WHERE c.id = $1`,
    [cardId]
  );
  const boardLabel = await query<{ board_id: string; name: string }>(
    `SELECT board_id, name FROM labels WHERE id = $1`,
    [labelId]
  );
  if (!boardCard.rows[0] || !boardLabel.rows[0]) return null;
  if (boardCard.rows[0].board_id !== boardLabel.rows[0].board_id) return null;
  const boardId = boardCard.rows[0].board_id;
  const labelName = boardLabel.rows[0].name;

  const existing = await query(
    `SELECT 1 FROM card_labels WHERE card_id = $1 AND label_id = $2`,
    [cardId, labelId]
  );
  if ((existing.rowCount ?? 0) > 0) {
    await query(`DELETE FROM card_labels WHERE card_id = $1 AND label_id = $2`, [cardId, labelId]);
    return { boardId, attached: false, labelName };
  }
  await query(
    `INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2)`,
    [cardId, labelId]
  );
  return { boardId, attached: true, labelName };
}

// ------------- Assignees -------------

export async function toggleCardAssignee(cardId: string, userId: string): Promise<{ boardId: string; attached: boolean; username: string } | null> {
  const boardCard = await query<{ board_id: string }>(
    `SELECT col.board_id FROM cards c JOIN columns col ON col.id = c.column_id WHERE c.id = $1`,
    [cardId]
  );
  const boardId = boardCard.rows[0]?.board_id;
  if (!boardId) return null;

  const memberCheck = await query<{ username: string }>(
    `SELECT u.username FROM board_members m JOIN users u ON u.id = m.user_id
     WHERE m.board_id = $1 AND m.user_id = $2`,
    [boardId, userId]
  );
  const username = memberCheck.rows[0]?.username;
  if (!username) return null;

  const existing = await query(
    `SELECT 1 FROM card_assignees WHERE card_id = $1 AND user_id = $2`,
    [cardId, userId]
  );
  if ((existing.rowCount ?? 0) > 0) {
    await query(`DELETE FROM card_assignees WHERE card_id = $1 AND user_id = $2`, [cardId, userId]);
    return { boardId, attached: false, username };
  }
  await query(
    `INSERT INTO card_assignees (card_id, user_id) VALUES ($1, $2)`,
    [cardId, userId]
  );
  return { boardId, attached: true, username };
}

// ------------- Card events (activity log) -------------

export async function logCardEvent(
  cardId: string,
  boardId: string,
  userId: string | null,
  kind: string,
  meta: Record<string, unknown> = {}
): Promise<void> {
  const id = nanoid(12);
  await query(
    `INSERT INTO card_events (id, card_id, board_id, user_id, kind, meta) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, cardId, boardId, userId, kind, JSON.stringify(meta)]
  );
}

export async function listCardEvents(cardId: string, limit = 50): Promise<CardEvent[]> {
  const { rows } = await query<{ id: string; card_id: string; user_id: string | null; username: string | null; kind: string; meta: Record<string, unknown>; created_at: Date }>(
    `SELECT e.id, e.card_id, e.user_id, u.username, e.kind, e.meta, e.created_at
     FROM card_events e LEFT JOIN users u ON u.id = e.user_id
     WHERE e.card_id = $1
     ORDER BY e.created_at DESC
     LIMIT $2`,
    [cardId, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    cardId: r.card_id,
    userId: r.user_id,
    username: r.username,
    kind: r.kind,
    meta: r.meta ?? {},
    createdAt: r.created_at.toISOString(),
  }));
}

// ------------- Lookups -------------

export async function boardIdForColumn(columnId: string): Promise<string | null> {
  const { rows } = await query<{ board_id: string }>(
    `SELECT board_id FROM columns WHERE id = $1`,
    [columnId]
  );
  return rows[0]?.board_id ?? null;
}

export async function boardIdForCard(cardId: string): Promise<string | null> {
  const { rows } = await query<{ board_id: string }>(
    `SELECT col.board_id FROM cards c JOIN columns col ON col.id = c.column_id WHERE c.id = $1`,
    [cardId]
  );
  return rows[0]?.board_id ?? null;
}

export async function closeStore() {
  await pool.end();
}
