import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * Capture a photo using the device camera or photo library
 * Returns a File object ready for upload
 */
export async function capturePhotoAsFile(): Promise<File | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt, // Let user choose camera or library
      correctOrientation: true,
    });

    if (!photo.webPath) return null;

    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    const fileName = `yardpass-photo-${Date.now()}.jpeg`;

    return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
  } catch (error) {
    console.error('Camera capture error:', error);
    throw error;
  }
}

/**
 * Pick multiple photos from the library
 * Returns an array of File objects
 */
export async function pickPhotos(limit: number = 10): Promise<File[]> {
  try {
    const images = await Camera.pickImages({
      quality: 80,
      limit,
    });

    if (!images.photos.length) return [];

    const files = await Promise.all(
      images.photos.map(async (photo, index) => {
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        const fileName = `yardpass-photo-${Date.now()}-${index}.jpeg`;
        return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      })
    );

    return files;
  } catch (error) {
    console.error('Photo picker error:', error);
    throw error;
  }
}

/**
 * Capture photo directly from camera (no prompt)
 */
export async function takePicture(): Promise<File | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera, // Camera only
      correctOrientation: true,
    });

    if (!photo.webPath) return null;

    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    const fileName = `yardpass-photo-${Date.now()}.jpeg`;

    return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
  } catch (error) {
    console.error('Camera capture error:', error);
    throw error;
  }
}





