import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

const account   = process.env.AZURE_STORAGE_ACCOUNT;    // e.g. linea15storage
const accountKey = process.env.AZURE_STORAGE_KEY;
const container = process.env.AZURE_STORAGE_CONTAINER || 'evidencias';

// Cliente principal
function getClient() {
  const credential = new StorageSharedKeyCredential(account, accountKey);
  return new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential);
}

// Subir un archivo (buffer) al contenedor
export async function uploadBlob(blobPath, buffer, contentType = 'application/octet-stream') {
  const client = getClient();
  const containerClient = client.getContainerClient(container);
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType }
  });

  return blobPath;
}

// Eliminar uno o varios blobs
export async function deleteBlobs(blobPaths = []) {
  if (!blobPaths.length) return;
  const client = getClient();
  const containerClient = client.getContainerClient(container);
  await Promise.all(
    blobPaths.map(p => containerClient.getBlockBlobClient(p).deleteIfExists())
  );
}

// Generar URL pública con SAS token (válido 1 hora)
export function getBlobUrl(blobPath) {
  const credential = new StorageSharedKeyCredential(account, accountKey);
  const sasToken = generateBlobSASQueryParameters({
    containerName: container,
    blobName: blobPath,
    permissions: BlobSASPermissions.parse('r'),
    expiresOn: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
  }, credential).toString();

  return `https://${account}.blob.core.windows.net/${container}/${blobPath}?${sasToken}`;
}
