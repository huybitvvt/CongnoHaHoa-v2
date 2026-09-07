const MEDIA_PREFIX = "\u001eHAHOA_ZALO_MEDIA_V1:";
const MAX_IMAGES = 4;
const MAX_DATA_URL_LENGTH = 900_000;
const MAX_TOTAL_DATA_URL_LENGTH = 3_400_000;

export interface ZaloMediaUpload {
  dataUrl: string;
  contentType?: string;
  sourceUrl?: string;
}

export interface ParsedZaloMessageBody {
  text: string;
  imageDataUrls: string[];
}

export function encodeZaloMessageBody(text: string, uploads: ZaloMediaUpload[] = []) {
  const visibleText = cleanVisibleText(text);
  const imageDataUrls: string[] = [];
  let totalLength = 0;

  for (const upload of uploads) {
    const value = String(upload.dataUrl || "").trim();
    if (!isSupportedImageDataUrl(value) || value.length > MAX_DATA_URL_LENGTH) continue;
    if (imageDataUrls.length >= MAX_IMAGES || totalLength + value.length > MAX_TOTAL_DATA_URL_LENGTH) break;
    imageDataUrls.push(value);
    totalLength += value.length;
  }

  if (!imageDataUrls.length) return visibleText || "[Ảnh]";
  return `${MEDIA_PREFIX}${JSON.stringify({ text: visibleText, images: imageDataUrls })}`;
}

export function parseZaloMessageBody(value: string): ParsedZaloMessageBody {
  const raw = String(value || "");
  if (!raw.startsWith(MEDIA_PREFIX)) return { text: raw, imageDataUrls: [] };

  try {
    const parsed = JSON.parse(raw.slice(MEDIA_PREFIX.length)) as { text?: unknown; images?: unknown };
    const images = Array.isArray(parsed.images)
      ? parsed.images.filter((item): item is string => typeof item === "string" && isSupportedImageDataUrl(item)).slice(0, MAX_IMAGES)
      : [];
    const text = typeof parsed.text === "string" ? cleanVisibleText(parsed.text) : "";
    return { text: text || (images.length ? "[Ảnh]" : ""), imageDataUrls: images };
  } catch {
    return { text: "[Ảnh]", imageDataUrls: [] };
  }
}

export function collectZaloImages(messages: Array<{ body: string; media_data_urls?: string[] }>, limit = MAX_IMAGES) {
  const result: string[] = [];
  for (const message of [...messages].reverse()) {
    const parsed = message.media_data_urls?.length
      ? { imageDataUrls: message.media_data_urls }
      : parseZaloMessageBody(message.body);
    for (const image of [...parsed.imageDataUrls].reverse()) {
      if (!result.includes(image)) result.push(image);
      if (result.length >= limit) return result.reverse();
    }
  }
  return result.reverse();
}

function cleanVisibleText(value: string) {
  const text = String(value || "").trim();
  return text === "[Ảnh]" ? "" : text.slice(0, 4_000);
}

function isSupportedImageDataUrl(value: string) {
  return /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value);
}
