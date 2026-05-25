// Sets the canvas font via drawingContext so numeric font-weight is honored —
// p5.textStyle only exposes NORMAL/BOLD/ITALIC and would drop weights like 500/600.
export function drawStyledText(
  p,
  text,
  x,
  y,
  { weight = 400, size, family = "Nunito", fill = 0, alpha = 255 } = {},
) {
  p.drawingContext.font = `${weight} ${size}px "${family}", system-ui, sans-serif`;
  p.fill(fill, alpha);
  p.text(text, x, y);
}
