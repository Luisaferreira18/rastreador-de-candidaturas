/** Momento do último "soltar": evita abrir o card logo depois de arrastá-lo. */
let lastDragEndedAt = 0;

export function markDragEnded() {
  lastDragEndedAt = Date.now();
}

/** O card acabou de ser solto? Então o clique foi do arrastar, não para abrir. */
export function justDragged(): boolean {
  return Date.now() - lastDragEndedAt < 250;
}
