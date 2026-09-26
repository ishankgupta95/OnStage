/**
 * Read dropped screenshots as data URLs. Same-origin by construction, so they
 * render in the canvas AND never taint the export canvas.
 */
function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read the image file"));
    reader.readAsDataURL(file);
  });
}

export async function readImageFiles(files: FileList | File[]): Promise<string[]> {
  const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
  return Promise.all(images.map(readImageFile));
}
