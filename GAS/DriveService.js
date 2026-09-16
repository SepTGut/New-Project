/**
 * Google Drive Service
 * Manages photo decoding, upload, and sharing permissions.
 */
function uploadFileToDrive(fileData, targetFolder) {
  if (!fileData || !fileData.base64) {
    return '';
  }

  try {
    const folder = targetFolder || DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const decoded = Utilities.base64Decode(fileData.base64);
    const mimeType = fileData.mimeType || 'image/jpeg';
    const fileName = fileData.fileName || ('photo_' + new Date().getTime() + '.jpg');

    const blob = Utilities.newBlob(decoded, mimeType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    Logger.log('Gagal upload file ke Drive: ' + err.toString());
    throw new Error('Gagal mengupload gambar ke Drive: ' + err.message);
  }
}
