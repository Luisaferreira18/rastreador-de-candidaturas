/**
 * Lógica pura do quadro Kanban: agrupar por etapa, mover cards e calcular a
 * nova posição. Fica separada dos componentes para ser fácil de testar.
 *
 * As posições são números com casas decimais: ao soltar um card entre dois
 * outros, ele recebe a média das posições vizinhas. Assim só o card movido
 * precisa ser salvo no banco.
 */

import { STAGE_KEYS, type StageKey } from "@/lib/stages";

export const POSITION_GAP = 1024;

export type PositionedCard = { id: string; stage: StageKey; position: number };

export type Columns<T extends PositionedCard> = Record<StageKey, T[]>;

export function emptyColumns<T extends PositionedCard>(): Columns<T> {
  return Object.fromEntries(STAGE_KEYS.map((key) => [key, [] as T[]])) as unknown as Columns<T>;
}

export function groupByStage<T extends PositionedCard>(cards: readonly T[]): Columns<T> {
  const columns = emptyColumns<T>();
  for (const card of cards) columns[card.stage].push(card);
  for (const key of STAGE_KEYS) columns[key].sort((a, b) => a.position - b.position);
  return columns;
}

/** Posição no topo de uma coluna (mesma regra do valor padrão no banco). */
export function topPosition(now: number = Date.now()): number {
  return -now / 1000;
}

/** Posição para ficar entre `before` e `after` (qualquer um pode faltar). */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return after! - POSITION_GAP;
  if (after === undefined) return before + POSITION_GAP;
  return (before + after) / 2;
}

/** Em qual coluna está o card (ou `undefined` se não existir). */
export function findStageOf<T extends PositionedCard>(
  columns: Columns<T>,
  cardId: string,
): StageKey | undefined {
  return STAGE_KEYS.find((key) => columns[key].some((card) => card.id === cardId));
}

/**
 * Move um card para `toStage`, na posição `toIndex` (fim da coluna se omitido).
 * Devolve novas colunas (não altera as originais). O campo `position` não é
 * recalculado aqui; use `positionForIndex` depois de soltar o card.
 */
export function moveCard<T extends PositionedCard>(
  columns: Columns<T>,
  cardId: string,
  toStage: StageKey,
  toIndex?: number,
): Columns<T> {
  const fromStage = findStageOf(columns, cardId);
  if (!fromStage) return columns;

  const card = columns[fromStage].find((item) => item.id === cardId)!;
  const next = { ...columns, [fromStage]: columns[fromStage].filter((item) => item.id !== cardId) };
  const target = [...next[toStage]];
  const index = toIndex === undefined ? target.length : Math.max(0, Math.min(toIndex, target.length));
  target.splice(index, 0, { ...card, stage: toStage });
  next[toStage] = target;
  return next;
}

/** Posição que o card deve receber para ficar onde está agora na coluna. */
export function positionForIndex<T extends PositionedCard>(cards: readonly T[], cardId: string): number {
  const index = cards.findIndex((card) => card.id === cardId);
  if (index === -1) throw new Error("Card não encontrado na coluna.");
  return positionBetween(cards[index - 1]?.position, cards[index + 1]?.position);
}

/**
 * Coloca o card na etapa `stage` com a posição `position`, inserindo-o no
 * lugar certo da coluna (usado no "Mover para..." e no "Desfazer").
 */
export function placeCard<T extends PositionedCard>(
  columns: Columns<T>,
  cardId: string,
  stage: StageKey,
  position: number,
): Columns<T> {
  const fromStage = findStageOf(columns, cardId);
  if (!fromStage) return columns;
  const card = { ...columns[fromStage].find((item) => item.id === cardId)!, stage, position };
  const next = { ...columns, [fromStage]: columns[fromStage].filter((item) => item.id !== cardId) };
  next[stage] = [...next[stage], card].sort((a, b) => a.position - b.position);
  return next;
}

/** Atualiza o `position` (e a etapa) de um card nas colunas. */
export function setCardPosition<T extends PositionedCard>(
  columns: Columns<T>,
  cardId: string,
  position: number,
): Columns<T> {
  const stage = findStageOf(columns, cardId);
  if (!stage) return columns;
  return {
    ...columns,
    [stage]: columns[stage].map((card) => (card.id === cardId ? { ...card, position, stage } : card)),
  };
}
