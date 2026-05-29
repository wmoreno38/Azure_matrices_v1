import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';

const account    = process.env.AZURE_STORAGE_ACCOUNT;
const accountKey = process.env.AZURE_STORAGE_KEY;
const container  = process.env.AZURE_STORAGE_CONTAINER || 'evidencias';

function getClient() {
  const credential = new StorageSharedKeyCredential(account, accountKey);
  return new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    credential
  );
}

export async function uploadBlob(blobPath, buffer, contentType = 'application/octet-stream') {
  const client          = getClient();
  const containerClient = client.getContainerClient(container);
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
  return blobPath;
}

export async function deleteBlobs(blobPaths = []) {
  if (!blobPaths.length) return;
  const client          = getClient();
  const containerClient = client.getContainerClient(container);
  await Promise.all(
    blobPaths.map(p => containerClient.getBlockBlobClient(p).deleteIfExists())
  );
}

export function getBlobUrl(blobPath) {
  const credential = new StorageSharedKeyCredential(account, accountKey);
  const sasToken   = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName:      blobPath,
      permissions:   BlobSASPermissions.parse('r'),
      expiresOn:     new Date(Date.now() + 60 * 60 * 1000),
    },
    credential
  ).toString();
  return `https://${account}.blob.core.windows.net/${container}/${blobPath}?${sasToken}`;
}
