import { apiFetch } from '@/lib/api';

export type CollectionBucket = {
  id: number;
  name: string;
  startDpd: number;
  endDpd: number;
};

export function listCollectionBuckets() {
  return apiFetch<CollectionBucket[]>('/api/v1/collection-buckets');
}

export function createCollectionBucket(dto: {
  name: string;
  startDpd: number;
  endDpd: number;
}) {
  return apiFetch<CollectionBucket>('/api/v1/collection-buckets', {
    method: 'POST',
    body: dto,
  });
}

export function removeCollectionBucket(id: number) {
  return apiFetch<void>(`/api/v1/collection-buckets/${id}`, {
    method: 'DELETE',
  });
}

export type CollectionBucketPermission = {
  id: number;
  user: { id: number; name: string };
  userRole: { id: number; code: string; name: string } | null;
  bucket: CollectionBucket;
};

export function listCollectionBucketPermissions(userId?: number) {
  return apiFetch<CollectionBucketPermission[]>(
    `/api/v1/collection-bucket-permissions${userId ? `?userId=${userId}` : ''}`,
  );
}

export function grantCollectionBucketPermission(dto: {
  userId: number;
  bucketId: number;
  userRoleId?: number;
}) {
  return apiFetch<CollectionBucketPermission>(
    '/api/v1/collection-bucket-permissions',
    { method: 'POST', body: dto },
  );
}

export function revokeCollectionBucketPermission(id: number) {
  return apiFetch<void>(`/api/v1/collection-bucket-permissions/${id}`, {
    method: 'DELETE',
  });
}
