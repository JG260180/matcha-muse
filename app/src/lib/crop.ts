// Pure math for the photo crop/position dialog (PhotoAdjust). The image is
// shown behind a fixed frame at `coverScale * zoom`, displaced from the frame
// centre by (offsetX, offsetY) display pixels. These helpers keep the frame
// fully covered and translate the view into a canvas drawImage source rect.

export interface Size {
  width: number;
  height: number;
}

export interface CropView {
  zoom: number; // 1 = image just covers the frame
  offsetX: number; // display px, 0 = centred
  offsetY: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export function coverScale(img: Size, frame: Size): number {
  return Math.max(frame.width / img.width, frame.height / img.height);
}

export function clampView(view: CropView, img: Size, frame: Size): CropView {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom));
  const s = coverScale(img, frame) * zoom;
  const slackX = Math.max(0, (img.width * s - frame.width) / 2);
  const slackY = Math.max(0, (img.height * s - frame.height) / 2);
  const clamp = (v: number, slack: number) =>
    slack === 0 ? 0 : Math.min(slack, Math.max(-slack, v));
  return {
    zoom,
    offsetX: clamp(view.offsetX, slackX),
    offsetY: clamp(view.offsetY, slackY),
  };
}

export function sourceRect(
  view: CropView,
  img: Size,
  frame: Size
): { sx: number; sy: number; sw: number; sh: number } {
  const s = coverScale(img, frame) * view.zoom;
  const sw = frame.width / s;
  const sh = frame.height / s;
  return {
    sx: img.width / 2 - view.offsetX / s - sw / 2,
    sy: img.height / 2 - view.offsetY / s - sh / 2,
    sw,
    sh,
  };
}
