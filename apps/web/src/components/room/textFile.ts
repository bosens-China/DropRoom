import type { FileItem } from '@droproom/api/domain';

export function isTextFile(file: FileItem): boolean {
  return (
    file.mimeType.toLowerCase().startsWith('text/plain') ||
    file.name.toLowerCase().endsWith('.txt')
  );
}
