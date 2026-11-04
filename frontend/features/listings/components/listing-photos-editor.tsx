'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listingsApi, type Listing, type ListingPhoto } from '../api';
import { moveToFront, pickPhotos } from '../photos';
import { listingPhotosSaved } from '../queries';
import { PhotoGrid } from './photo-grid';

type ListingPhotosEditorProps = {
  listing: Listing;
  userId: string;
};

// The photos of a posted job. Every change is saved at once.
export function ListingPhotosEditor({
  listing,
  userId,
}: ListingPhotosEditorProps) {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const photos = listing.photos;

  const saved = (next: ListingPhoto[]) =>
    listingPhotosSaved(queryClient, userId, listing.id, next);

  // One at a time, so each finished photo shows up and the limit holds.
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      let current = photos;
      const failures: string[] = [];
      setPendingCount(files.length);
      for (const file of files) {
        try {
          const photo = await listingsApi.addPhoto(listing.id, file);
          current = [...current, photo];
          saved(current);
        } catch (error) {
          failures.push(
            `${file.name}: ${error instanceof Error ? error.message : 'slika nije dodana.'}`,
          );
        }
        setPendingCount((count) => count - 1);
      }
      return failures;
    },
    onSuccess: (failures) => setErrors(failures),
    onSettled: () => setPendingCount(0),
  });

  const remove = useMutation({
    mutationFn: (photo: ListingPhoto) =>
      listingsApi.deletePhoto(listing.id, photo.id),
    onSuccess: (_, photo) => {
      saved(photos.filter((item) => item.id !== photo.id));
      toast.success('Slika je uklonjena.');
    },
    onError: (error) => toast.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => listingsApi.reorderPhotos(listing.id, ids),
    onSuccess: (next) => {
      saved(next);
      toast.success('Naslovna slika je promijenjena.');
    },
    onError: (error) => toast.error(error.message),
  });

  const busy = upload.isPending || remove.isPending || reorder.isPending;

  return (
    <PhotoGrid
      items={photos.map((photo, index) => ({
        key: photo.id,
        src: photo.thumbnailUrl,
        alt: `Slika ${index + 1} oglasa ${listing.title}`,
      }))}
      pendingCount={pendingCount}
      disabled={busy}
      errors={errors}
      onAdd={(picked) => {
        const { accepted, errors: pickErrors } = pickPhotos(
          picked,
          photos.length,
        );
        setErrors(pickErrors);
        if (accepted.length > 0) upload.mutate(accepted);
      }}
      onRemove={(index) => {
        if (!window.confirm('Ukloniti ovu sliku iz oglasa?')) return;
        setErrors([]);
        remove.mutate(photos[index]);
      }}
      onMakeCover={(index) =>
        reorder.mutate(moveToFront(photos, index).map((photo) => photo.id))
      }
    />
  );
}
