// Reads an image File and returns a base64 data URL. The static demo has no
// upload endpoint, so the data URL is stored directly in the editor doc — it
// renders in the Konva preview AND the export, and being same-origin it never
// taints the export canvas.
export async function uploadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read the image file"));
    reader.readAsDataURL(file);
  });
}
